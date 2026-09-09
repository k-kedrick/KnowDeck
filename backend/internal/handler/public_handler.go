package handler

import (
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"knowledge-base/backend/internal/middleware"
	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/internal/service"
	"knowledge-base/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type PublicHandler struct {
	docService          *service.DocumentService
	catService          *service.CategoryService
	tagRepo             *repository.TagRepository
	searchRepo          *repository.SearchRepository
	mediaService        *service.MediaService
	settingService      *service.SettingService
	externalImageClient *http.Client
}

const maxExternalImageBytes = 20 << 20

var allowedExternalImageTypes = map[string]struct{}{
	"image/png":  {},
	"image/jpeg": {},
	"image/gif":  {},
	"image/webp": {},
	"image/avif": {},
}

func isAllowedExternalImageURL(rawURL string) (*url.URL, bool) {
	parsed, err := url.ParseRequestURI(rawURL)
	if err != nil || parsed.Scheme != "https" || parsed.User != nil {
		return nil, false
	}
	if !strings.EqualFold(parsed.Hostname(), "scnyv437r6d7.feishu.cn") {
		return nil, false
	}
	if parsed.Port() != "" && parsed.Port() != "443" {
		return nil, false
	}
	if parsed.Path != "/space/api/box/stream/download/asynccode/" || parsed.Query().Get("code") == "" {
		return nil, false
	}
	return parsed, true
}

func newExternalImageClient() *http.Client {
	return &http.Client{
		Timeout: 25 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return http.ErrUseLastResponse
			}
			if _, ok := isAllowedExternalImageURL(req.URL.String()); !ok {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}
}

func NewPublicHandler(
	docService *service.DocumentService,
	catService *service.CategoryService,
	tagRepo *repository.TagRepository,
	searchRepo *repository.SearchRepository,
	mediaService *service.MediaService,
	settingService *service.SettingService,
) *PublicHandler {
	return &PublicHandler{
		docService:          docService,
		catService:          catService,
		tagRepo:             tagRepo,
		searchRepo:          searchRepo,
		mediaService:        mediaService,
		settingService:      settingService,
		externalImageClient: newExternalImageClient(),
	}
}

// GetSiteInfo 获取站点基础信息
func (h *PublicHandler) GetSiteInfo(c *gin.Context) {
	info, err := h.settingService.GetPublicSiteInfo()
	if err != nil {
		response.ServerError(c, "获取站点配置失败")
		return
	}
	response.Success(c, info)
}

// GetKnowledgeTree 获取前台只读知识库层级目录树
func (h *PublicHandler) GetKnowledgeTree(c *gin.Context) {
	tree, err := h.catService.GetPublicKnowledgeTree()
	if err != nil {
		response.ServerError(c, "获取知识库目录树失败")
		return
	}
	response.Success(c, tree)
}

// ListDocuments 分页获取已发布文档列表
func (h *PublicHandler) ListDocuments(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	page, pageSize = normalizePublicPagination(page, pageSize)
	categoryID, _ := strconv.ParseInt(c.Query("category_id"), 10, 64)
	categorySlug := c.Query("category_slug")
	tags := c.QueryArray("tag")
	keyword := c.Query("keyword")

	if categorySlug != "" && categoryID == 0 {
		if cat, _ := h.catService.GetBySlug(categorySlug); cat != nil {
			categoryID = cat.ID
		}
	}

	filter := repository.DocumentFilter{
		Status:     "published",
		CategoryID: categoryID,
		Tags:       tags,
		Keyword:    keyword,
		Page:       page,
		PageSize:   pageSize,
	}

	list, total, err := h.docService.List(filter)
	if err != nil {
		response.ServerError(c, "获取文档列表失败")
		return
	}

	user, _ := c.Get(middleware.ContextUserKey)
	currentUser, _ := user.(*model.User)

	for _, doc := range list {
		if !service.CanReadDocument(doc, currentUser) {
			doc.Excerpt = ""
		}
	}

	response.SuccessPage(c, list, total, page, pageSize)
}

func normalizePublicPagination(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

// GetDocumentBySlug 获取单篇文档详情 (按 Slug 或 ID)
func (h *PublicHandler) GetDocumentBySlug(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		response.BadRequest(c, "缺少文档标识")
		return
	}

	doc, neighbor, err := h.docService.GetBySlug(slug, true)
	if err != nil {
		// Try parsing as ID if not found by slug
		if id, parseErr := strconv.ParseInt(slug, 10, 64); parseErr == nil {
			if docByID, _ := h.docService.GetByID(id); docByID != nil && docByID.Status == "published" {
				doc, neighbor, _ = h.docService.GetBySlug(docByID.Slug, true)
			}
		}
	}

	if doc == nil {
		response.NotFound(c, "未找到该文档或文档未发布")
		return
	}

	user, _ := c.Get(middleware.ContextUserKey)
	currentUser, _ := user.(*model.User)
	type DocDetailResp struct {
		Document interface{}             `json:"document"`
		Neighbor *model.DocumentNeighbor `json:"neighbor"`
		Locked   bool                    `json:"locked"`
	}
	if !service.CanReadDocument(doc, currentUser) {
		type lockedDocument struct {
			ID           int64      `json:"id"`
			Title        string     `json:"title"`
			Slug         string     `json:"slug"`
			Cover        string     `json:"cover"`
			Status       string     `json:"status"`
			AccessLevel  string     `json:"access_level"`
			CategoryID   int64      `json:"category_id"`
			CategoryName string     `json:"category_name,omitempty"`
			CategorySlug string     `json:"category_slug,omitempty"`
			Tags         []string   `json:"tags,omitempty"`
			PublishedAt  *time.Time `json:"published_at,omitempty"`
		}
		response.Success(c, DocDetailResp{Document: lockedDocument{doc.ID, doc.Title, doc.Slug, doc.Cover, doc.Status, doc.AccessLevel, doc.CategoryID, doc.CategoryName, doc.CategorySlug, doc.Tags, doc.PublishedAt}, Locked: true})
		return
	}

	response.Success(c, DocDetailResp{
		Document: doc,
		Neighbor: neighbor,
		Locked:   false,
	})
}

// ListCategories 获取所有分类
func (h *PublicHandler) ListCategories(c *gin.Context) {
	tree, err := h.catService.GetTree()
	if err != nil {
		response.ServerError(c, "获取分类列表失败")
		return
	}
	response.Success(c, tree)
}

// ListTags 获取热门标签列表
func (h *PublicHandler) ListTags(c *gin.Context) {
	tags, err := h.tagRepo.ListPublished()
	if err != nil {
		response.ServerError(c, "获取标签列表失败")
		return
	}
	response.Success(c, tags)
}

// Search 全文搜索
func (h *PublicHandler) Search(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		response.Success(c, []*model.SearchResult{})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	_, authenticated := c.Get(middleware.ContextUserKey)
	results, err := h.searchRepo.Search(query, limit, !authenticated)
	if err != nil {
		response.ServerError(c, "搜索出错")
		return
	}

	response.Success(c, results)
}

// DownloadMedia 安全下载附件
func (h *PublicHandler) DownloadMedia(c *gin.Context) {
	allowDownload := h.settingService.GetBool("allow_download", true)
	if !allowDownload {
		response.Forbidden(c, "系统已关闭访客附件下载功能")
		return
	}

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的附件ID")
		return
	}

	media, err := h.mediaService.GetByID(id)
	if err != nil || media == nil {
		response.NotFound(c, "附件不存在")
		return
	}

	absPath, err := h.mediaService.GetAbsolutePath(media.Path)
	if err != nil {
		response.BadRequest(c, "附件路径无效")
		return
	}
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		response.NotFound(c, "附件文件已丢失")
		return
	}

	escapedName := strings.ReplaceAll(media.OriginalName, `"`, "")
	encodedName := url.PathEscape(media.OriginalName)
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"; filename*=UTF-8''%s", escapedName, encodedName))
	c.Header("Content-Type", media.MimeType)
	c.File(absPath)
}

// ProxyExternalImage exposes only the currently used Feishu raster-image
// endpoint through same-origin delivery. The strict host/path/MIME/size checks
// prevent this endpoint from becoming a general-purpose SSRF proxy.
func (h *PublicHandler) ProxyExternalImage(c *gin.Context) {
	upstreamURL, ok := isAllowedExternalImageURL(strings.TrimSpace(c.Query("url")))
	if !ok {
		response.BadRequest(c, "不支持的外部图片地址")
		return
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, upstreamURL.String(), nil)
	if err != nil {
		response.BadRequest(c, "外部图片地址无效")
		return
	}
	req.Header.Set("Accept", "image/avif,image/webp,image/png,image/jpeg,image/gif")
	req.Header.Set("User-Agent", "KnowledgeBase-ImageProxy/1.0")
	if rangeHeader := c.GetHeader("Range"); strings.HasPrefix(rangeHeader, "bytes=") && !strings.Contains(rangeHeader, ",") {
		req.Header.Set("Range", rangeHeader)
	}

	upstream, err := h.externalImageClient.Do(req)
	if err != nil {
		response.ServerError(c, "外部图片暂时无法访问")
		return
	}
	defer upstream.Body.Close()

	if upstream.StatusCode != http.StatusOK && upstream.StatusCode != http.StatusPartialContent {
		c.Status(http.StatusBadGateway)
		return
	}
	mediaType, _, err := mime.ParseMediaType(upstream.Header.Get("Content-Type"))
	if err != nil {
		c.Status(http.StatusBadGateway)
		return
	}
	if _, ok := allowedExternalImageTypes[strings.ToLower(mediaType)]; !ok {
		c.Status(http.StatusUnsupportedMediaType)
		return
	}
	if upstream.ContentLength > maxExternalImageBytes {
		c.Status(http.StatusRequestEntityTooLarge)
		return
	}

	body, err := io.ReadAll(io.LimitReader(upstream.Body, maxExternalImageBytes+1))
	if err != nil {
		c.Status(http.StatusBadGateway)
		return
	}
	if len(body) > maxExternalImageBytes {
		c.Status(http.StatusRequestEntityTooLarge)
		return
	}

	c.Header("Cache-Control", "public, max-age=3600")
	c.Header("X-Content-Type-Options", "nosniff")
	if contentRange := upstream.Header.Get("Content-Range"); contentRange != "" {
		c.Header("Content-Range", contentRange)
	}
	c.Data(upstream.StatusCode, mediaType, body)
}
