package service

import (
	"errors"
	"fmt"
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
	parentIDs := normalizedCategoryParents(all)

	categoryMap := make(map[int64]*model.Category)
	for _, c := range all {
		c.Children = []*model.Category{}
		c.ParentID = parentIDs[c.ID]
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
	parentIDs := normalizedCategoryParents(categories)

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
			ID:          c.ID,
			Name:        c.Name,
			Slug:        c.Slug,
			Description: c.Description,
			Icon:        icon,
			Children:    []*model.CategoryTreeNode{},
			Documents:   docMap[c.ID],
		}
		if nodeMap[c.ID].Documents == nil {
			nodeMap[c.ID].Documents = []*model.DocumentSummary{}
		}
	}

	root := make([]*model.CategoryTreeNode, 0)
	for _, c := range categories {
		node := nodeMap[c.ID]
		parentID := parentIDs[c.ID]
		if parentID == 0 {
			root = append(root, node)
		} else if parent, exists := nodeMap[parentID]; exists {
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

	explicitSlug := strings.TrimSpace(req.Slug)
	slug := explicitSlug
	if slug == "" {
		slug = utils.Slugify(name)
	}

	if explicitSlug != "" {
		if existing, err := s.catRepo.GetBySlug(slug); err != nil {
			return nil, err
		} else if existing != nil {
			return nil, errors.New("分类 Slug 已存在")
		}
	} else {
		var err error
		slug, err = s.uniqueGeneratedSlug(slug)
		if err != nil {
			return nil, err
		}
	}

	if err := s.validateParent(req.ParentID, 0); err != nil {
		return nil, err
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

	explicitSlug := strings.TrimSpace(req.Slug)
	slug := explicitSlug
	if slug == "" {
		slug = utils.Slugify(name)
	}

	if existing, err := s.catRepo.GetBySlug(slug); err != nil {
		return nil, err
	} else if existing != nil && existing.ID != id {
		if explicitSlug != "" {
			return nil, errors.New("分类 Slug 已存在")
		}
		slug, err = s.uniqueGeneratedSlug(slug)
		if err != nil {
			return nil, err
		}
	}

	if err := s.validateParent(req.ParentID, id); err != nil {
		return nil, err
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

func (s *CategoryService) uniqueGeneratedSlug(base string) (string, error) {
	if existing, err := s.catRepo.GetBySlug(base); err != nil {
		return "", err
	} else if existing == nil {
		return base, nil
	}

	for range 10 {
		candidate := fmt.Sprintf("%s-%s", base, utils.GenerateRandomHex(3))
		if existing, err := s.catRepo.GetBySlug(candidate); err != nil {
			return "", err
		} else if existing == nil {
			return candidate, nil
		}
	}
	return "", errors.New("无法生成唯一分类 Slug，请手动填写")
}

func (s *CategoryService) validateParent(parentID, categoryID int64) error {
	if parentID == 0 {
		return nil
	}
	if parentID == categoryID {
		return errors.New("分类不能将自己设为父级分类")
	}

	all, err := s.catRepo.ListAll()
	if err != nil {
		return err
	}
	parentByID := make(map[int64]int64, len(all))
	for _, category := range all {
		parentByID[category.ID] = category.ParentID
	}
	if _, exists := parentByID[parentID]; !exists {
		return errors.New("父级分类不存在")
	}

	visited := make(map[int64]struct{}, len(all))
	for current := parentID; current != 0; current = parentByID[current] {
		if current == categoryID {
			return errors.New("不能将分类移动到自己的子分类下")
		}
		if _, seen := visited[current]; seen {
			return errors.New("父级分类层级存在循环，请先修复分类结构")
		}
		visited[current] = struct{}{}
		_, exists := parentByID[current]
		if !exists {
			return errors.New("父级分类层级引用了不存在的分类")
		}
	}
	return nil
}

// normalizedCategoryParents prevents legacy invalid parent links from hiding
// every node in a cycle. The oldest category in each cycle is exposed as a
// root in the response; persisted writes are still rejected by validateParent.
func normalizedCategoryParents(categories []*model.Category) map[int64]int64 {
	parents := make(map[int64]int64, len(categories))
	for _, category := range categories {
		parents[category.ID] = category.ParentID
	}

	for _, category := range categories {
		path := make([]int64, 0, 4)
		positions := make(map[int64]int, 4)
		current := category.ID
		for current != 0 {
			if position, seen := positions[current]; seen {
				cycle := path[position:]
				rootID := cycle[0]
				for _, id := range cycle[1:] {
					if id < rootID {
						rootID = id
					}
				}
				parents[rootID] = 0
				break
			}
			positions[current] = len(path)
			path = append(path, current)
			parentID, exists := parents[current]
			if !exists {
				break
			}
			if parentID != 0 {
				if _, exists := parents[parentID]; !exists {
					parents[current] = 0
					break
				}
			}
			current = parentID
		}
	}

	return parents
}
