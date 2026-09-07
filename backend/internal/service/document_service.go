package service

import (
	"errors"
	stdhtml "html"
	"regexp"
	"strings"
	"time"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/pkg/utils"
)

var (
	htmlBlockPattern        = regexp.MustCompile(`(?is)<(?:script|style)[^>]*>.*?</(?:script|style)>`)
	htmlTagPattern          = regexp.MustCompile(`(?s)<[^>]*>`)
	malformedHTMLTagPattern = regexp.MustCompile(`(?i)<[/!]?[a-z][^<]*`)
	markdownImagePattern    = regexp.MustCompile(`!\[([^\]]*)\]\([^)]*\)`)
	markdownLinkPattern     = regexp.MustCompile(`\[([^\]]+)\]\([^)]*\)`)
	markdownPrefixPattern   = regexp.MustCompile(`(?m)^\s{0,3}(?:#{1,6}|>|[-+*]|\d+\.)\s*`)
)

type DocumentService struct {
	docRepo *repository.DocumentRepository
	catRepo *repository.CategoryRepository
}

func NewDocumentService(docRepo *repository.DocumentRepository, catRepo *repository.CategoryRepository) *DocumentService {
	return &DocumentService{
		docRepo: docRepo,
		catRepo: catRepo,
	}
}

func (s *DocumentService) List(filter repository.DocumentFilter) ([]*model.Document, int64, error) {
	list, total, err := s.docRepo.List(filter)
	if err != nil {
		return nil, 0, err
	}
	for _, doc := range list {
		doc.Excerpt = normalizeExcerpt(doc.Excerpt)
		doc.ReadingTime = utils.EstimateReadingTime(doc.Content)
	}
	return list, total, nil
}

func (s *DocumentService) GetByID(id int64) (*model.Document, error) {
	doc, err := s.docRepo.GetByID(id)
	if err != nil || doc == nil {
		return nil, err
	}
	doc.ReadingTime = utils.EstimateReadingTime(doc.Content)
	return doc, nil
}

func (s *DocumentService) GetBySlug(slug string, isPublic bool) (*model.Document, *model.DocumentNeighbor, error) {
	doc, err := s.docRepo.GetBySlug(slug)
	if err != nil || doc == nil {
		return nil, nil, errors.New("文档不存在")
	}

	if isPublic && doc.Status != "published" {
		return nil, nil, errors.New("文档未发布或已被归档")
	}

	if isPublic {
		go s.docRepo.IncrementViews(doc.ID)
		doc.Excerpt = normalizeExcerpt(doc.Excerpt)
	}

	doc.ReadingTime = utils.EstimateReadingTime(doc.Content)

	// 获取前后篇
	prev, next := s.docRepo.GetNeighbors(doc)
	neighbor := &model.DocumentNeighbor{
		Prev: prev,
		Next: next,
	}
	if isPublic {
		if neighbor.Prev != nil {
			neighbor.Prev.Excerpt = normalizeExcerpt(neighbor.Prev.Excerpt)
		}
		if neighbor.Next != nil {
			neighbor.Next.Excerpt = normalizeExcerpt(neighbor.Next.Excerpt)
		}
	}

	return doc, neighbor, nil
}

func (s *DocumentService) Create(authorID int64, req model.DocumentSaveReq) (*model.Document, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, errors.New("文档标题不能为空")
	}

	slug := strings.TrimSpace(req.Slug)
	if slug == "" {
		slug = utils.Slugify(title)
	}

	// 检查 slug 唯一性
	if existing, _ := s.docRepo.GetBySlug(slug); existing != nil {
		slug = utils.Slugify(title + "-" + utils.GenerateRandomHex(3))
	}

	status := req.Status
	if status == "" {
		status = "draft"
	}
	if !isValidDocumentStatus(status) {
		return nil, errors.New("文档状态无效")
	}

	excerpt := normalizeExcerpt(req.Excerpt)

	var publishedAt *time.Time
	if status == "published" {
		now := time.Now()
		publishedAt = &now
	}

	doc := &model.Document{
		Title:       title,
		Slug:        slug,
		Content:     req.Content,
		Excerpt:     excerpt,
		Cover:       req.Cover,
		Status:      status,
		CategoryID:  req.CategoryID,
		AuthorID:    authorID,
		SortOrder:   req.SortOrder,
		IsPinned:    req.IsPinned,
		Tags:        req.Tags,
		PublishedAt: publishedAt,
	}

	id, err := s.docRepo.Create(doc)
	if err != nil {
		return nil, err
	}
	doc.ID = id
	return doc, nil
}

func (s *DocumentService) Update(id int64, req model.DocumentSaveReq) (*model.Document, error) {
	doc, err := s.docRepo.GetByID(id)
	if err != nil || doc == nil {
		return nil, errors.New("文档不存在")
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, errors.New("文档标题不能为空")
	}

	slug := strings.TrimSpace(req.Slug)
	if slug == "" {
		slug = utils.Slugify(title)
	}

	if existing, _ := s.docRepo.GetBySlug(slug); existing != nil && existing.ID != id {
		slug = utils.Slugify(title + "-" + utils.GenerateRandomHex(3))
	}

	status := req.Status
	if status == "" {
		status = doc.Status
	}
	if !isValidDocumentStatus(status) {
		return nil, errors.New("文档状态无效")
	}

	excerpt := normalizeExcerpt(req.Excerpt)

	publishedAt := doc.PublishedAt
	if status == "published" && publishedAt == nil {
		now := time.Now()
		publishedAt = &now
	}

	doc.Title = title
	doc.Slug = slug
	doc.Content = req.Content
	doc.Excerpt = excerpt
	doc.Cover = req.Cover
	doc.Status = status
	doc.CategoryID = req.CategoryID
	doc.SortOrder = req.SortOrder
	doc.IsPinned = req.IsPinned
	doc.Tags = req.Tags
	doc.PublishedAt = publishedAt

	if err := s.docRepo.Update(doc); err != nil {
		return nil, err
	}

	return doc, nil
}

func (s *DocumentService) Delete(id int64) error {
	return s.docRepo.Delete(id)
}

func (s *DocumentService) UpdateStatus(id int64, status string) (*model.Document, error) {
	status = strings.TrimSpace(status)
	if !isValidDocumentStatus(status) {
		return nil, errors.New("文档状态无效")
	}

	doc, err := s.docRepo.GetByID(id)
	if err != nil || doc == nil {
		return nil, errors.New("文档不存在")
	}

	publishedAt := doc.PublishedAt
	if status == "published" && publishedAt == nil {
		now := time.Now()
		publishedAt = &now
	}

	updated, err := s.docRepo.UpdateStatus(id, status, publishedAt)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func isValidDocumentStatus(status string) bool {
	return status == "draft" || status == "published" || status == "archived"
}

func stripMarkdown(md string) string {
	cleaned := htmlBlockPattern.ReplaceAllString(md, " ")
	cleaned = htmlTagPattern.ReplaceAllString(cleaned, " ")
	// Older versions removed only the closing '>' and could persist fragments such
	// as "<p</p<div data...". Remove those fragments defensively as well.
	cleaned = malformedHTMLTagPattern.ReplaceAllString(cleaned, " ")
	cleaned = stdhtml.UnescapeString(cleaned)
	cleaned = markdownImagePattern.ReplaceAllString(cleaned, "$1")
	cleaned = markdownLinkPattern.ReplaceAllString(cleaned, "$1")
	cleaned = markdownPrefixPattern.ReplaceAllString(cleaned, "")
	cleaned = strings.NewReplacer("`", "", "*", "", "_", "", "~", "", "|", " ").Replace(cleaned)
	return strings.Join(strings.Fields(cleaned), " ")
}

func normalizeExcerpt(excerpt string) string {
	plainText := stripMarkdown(strings.TrimSpace(excerpt))
	runes := []rune(plainText)
	if len(runes) > 120 {
		return strings.TrimSpace(string(runes[:120])) + "..."
	}
	return plainText
}
