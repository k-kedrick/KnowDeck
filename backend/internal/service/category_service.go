package service

import (
	"errors"
	"strings"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/pkg/utils"
)

type CategoryService struct {
	catRepo *repository.CategoryRepository
	docRepo *repository.DocumentRepository
}

func NewCategoryService(catRepo *repository.CategoryRepository, docRepo *repository.DocumentRepository) *CategoryService {
	return &CategoryService{
		catRepo: catRepo,
		docRepo: docRepo,
	}
}

func (s *CategoryService) ListAll() ([]*model.Category, error) {
	return s.catRepo.ListAll()
}

func (s *CategoryService) GetTree() ([]*model.Category, error) {
	all, err := s.catRepo.ListAll()
	if err != nil {
		return nil, err
	}

	categoryMap := make(map[int64]*model.Category)
	for _, c := range all {
		c.Children = []*model.Category{}
		categoryMap[c.ID] = c
	}

	root := make([]*model.Category, 0)
	for _, c := range all {
		if c.ParentID == 0 {
			root = append(root, c)
		} else if parent, exists := categoryMap[c.ParentID]; exists {
			parent.Children = append(parent.Children, c)
		} else {
			root = append(root, c)
		}
	}
	return root, nil
}

// GetPublicKnowledgeTree 构建带有文档的只读知识库导航树
func (s *CategoryService) GetPublicKnowledgeTree() ([]*model.CategoryTreeNode, error) {
	categories, err := s.catRepo.ListAll()
	if err != nil {
		return nil, err
	}

	// 目录必须包含全部已发布文章，使用不读取正文和标签的专用摘要查询。
	docs, err := s.docRepo.ListPublishedForTree()
	if err != nil {
		return nil, err
	}

	// categoryID -> []DocumentSummary
	docMap := make(map[int64][]*model.DocumentSummary)
	for _, d := range docs {
		sum := &model.DocumentSummary{
			ID:        d.ID,
			Title:     d.Title,
			Slug:      d.Slug,
			Excerpt:   d.Excerpt,
			Cover:     d.Cover,
			Views:     d.Views,
			UpdatedAt: d.UpdatedAt,
		}
		docMap[d.CategoryID] = append(docMap[d.CategoryID], sum)
	}

	nodeMap := make(map[int64]*model.CategoryTreeNode)
	for _, c := range categories {
		icon := c.Icon
		if icon == "" {
			icon = "BookOpen"
		}
		nodeMap[c.ID] = &model.CategoryTreeNode{
			ID:        c.ID,
			Name:      c.Name,
			Slug:      c.Slug,
			Icon:      icon,
			Children:  []*model.CategoryTreeNode{},
			Documents: docMap[c.ID],
		}
		if nodeMap[c.ID].Documents == nil {
			nodeMap[c.ID].Documents = []*model.DocumentSummary{}
		}
	}

	root := make([]*model.CategoryTreeNode, 0)
	for _, c := range categories {
		node := nodeMap[c.ID]
		if c.ParentID == 0 {
			root = append(root, node)
		} else if parent, exists := nodeMap[c.ParentID]; exists {
			parent.Children = append(parent.Children, node)
		} else {
			root = append(root, node)
		}
	}

	return root, nil
}

func (s *CategoryService) GetByID(id int64) (*model.Category, error) {
	return s.catRepo.GetByID(id)
}

func (s *CategoryService) GetBySlug(slug string) (*model.Category, error) {
	return s.catRepo.GetBySlug(slug)
}

func (s *CategoryService) Create(req model.CategorySaveReq) (*model.Category, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("分类名称不能为空")
	}

	slug := strings.TrimSpace(req.Slug)
	if slug == "" {
		slug = utils.Slugify(name)
	}

	// 检查 slug 是否冲突
	if existing, _ := s.catRepo.GetBySlug(slug); existing != nil {
		slug = utils.Slugify(name + "-" + utils.GenerateRandomHex(3))
	}

	icon := req.Icon
	if icon == "" {
		icon = "BookOpen"
	}

	category := &model.Category{
		Name:        name,
		Slug:        slug,
		Description: req.Description,
		Icon:        icon,
		ParentID:    req.ParentID,
		SortOrder:   req.SortOrder,
	}

	id, err := s.catRepo.Create(category)
	if err != nil {
		return nil, err
	}
	category.ID = id
	return category, nil
}

func (s *CategoryService) Update(id int64, req model.CategorySaveReq) (*model.Category, error) {
	cat, err := s.catRepo.GetByID(id)
	if err != nil || cat == nil {
		return nil, errors.New("分类不存在")
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("分类名称不能为空")
	}

	slug := strings.TrimSpace(req.Slug)
	if slug == "" {
		slug = utils.Slugify(name)
	}

	// 检查重复 slug
	if existing, _ := s.catRepo.GetBySlug(slug); existing != nil && existing.ID != id {
		slug = utils.Slugify(name + "-" + utils.GenerateRandomHex(3))
	}

	// 不能将自己作为自己的父节点
	if req.ParentID == id {
		req.ParentID = 0
	}

	icon := req.Icon
	if icon == "" {
		icon = cat.Icon
	}

	cat.Name = name
	cat.Slug = slug
	cat.Description = req.Description
	cat.Icon = icon
	cat.ParentID = req.ParentID
	cat.SortOrder = req.SortOrder

	if err := s.catRepo.Update(cat); err != nil {
		return nil, err
	}
	return cat, nil
}

func (s *CategoryService) Delete(id int64) error {
	return s.catRepo.Delete(id)
}
