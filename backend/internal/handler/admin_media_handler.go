package handler

import (
	"net/http"
	"strconv"

	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/internal/service"
	"knowledge-base/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminMediaHandler struct {
	mediaService *service.MediaService
}

func NewAdminMediaHandler(mediaService *service.MediaService) *AdminMediaHandler {
	return &AdminMediaHandler{mediaService: mediaService}
}

func (h *AdminMediaHandler) Upload(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, h.mediaService.MaxRequestBytes())
	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "未接收到有效文件: "+err.Error())
		return
	}

	folderID, _ := strconv.ParseInt(c.PostForm("folder_id"), 10, 64)
	documentID, _ := strconv.ParseInt(c.PostForm("document_id"), 10, 64)
	docTitle := c.PostForm("doc_title")

	media, err := h.mediaService.Upload(file, folderID, documentID, docTitle)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessMsg(c, "上传成功", media)
}

func (h *AdminMediaHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	mediaType := c.Query("media_type")
	keyword := c.Query("keyword")

	filter := repository.MediaFilter{
		MediaType: mediaType,
		Keyword:   keyword,
		Page:      page,
		PageSize:  pageSize,
	}

	if fidStr := c.Query("folder_id"); fidStr != "" {
		fid, err := strconv.ParseInt(fidStr, 10, 64)
		if err == nil && fid >= 0 {
			filter.FolderID = &fid
		}
	}

	list, total, err := h.mediaService.List(filter)
	if err != nil {
		response.ServerError(c, "获取媒体列表失败")
		return
	}

	response.SuccessPage(c, list, total, page, pageSize)
}

func (h *AdminMediaHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的媒体ID")
		return
	}

	if err := h.mediaService.Delete(id); err != nil {
		response.ServerError(c, "删除媒体失败: "+err.Error())
		return
	}

	response.SuccessMsg(c, "删除媒体成功", nil)
}

// 文件夹相关控制器

func (h *AdminMediaHandler) ListFolders(c *gin.Context) {
	folders, err := h.mediaService.ListFolders()
	if err != nil {
		response.ServerError(c, "获取文件夹列表失败")
		return
	}

	totalMedia, unclassified, _ := h.mediaService.GetFolderStats()

	response.Success(c, gin.H{
		"folders":            folders,
		"total_media":        totalMedia,
		"unclassified_media": unclassified,
	})
}

type CreateFolderReq struct {
	Name       string `json:"name" binding:"required"`
	DocumentID int64  `json:"document_id"`
}

func (h *AdminMediaHandler) CreateFolder(c *gin.Context) {
	var req CreateFolderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入合法的文件夹名称")
		return
	}

	folder, err := h.mediaService.CreateFolder(req.Name, req.DocumentID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessMsg(c, "创建文件夹成功", folder)
}

type UpdateFolderReq struct {
	Name string `json:"name" binding:"required"`
}

func (h *AdminMediaHandler) UpdateFolder(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的文件夹ID")
		return
	}

	var req UpdateFolderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入合法的文件夹名称")
		return
	}

	if err := h.mediaService.UpdateFolder(id, req.Name); err != nil {
		response.ServerError(c, "更新文件夹失败: "+err.Error())
		return
	}

	response.SuccessMsg(c, "修改文件夹名称成功", nil)
}

func (h *AdminMediaHandler) DeleteFolder(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的文件夹ID")
		return
	}

	// 默认保留文件夹下的媒体，将其移入未分类 (0)
	keepMedia := c.DefaultQuery("keep_media", "true") == "true"

	if err := h.mediaService.DeleteFolder(id, keepMedia); err != nil {
		response.ServerError(c, "删除文件夹失败: "+err.Error())
		return
	}

	response.SuccessMsg(c, "删除文件夹成功", nil)
}

type MoveMediaReq struct {
	FolderID int64 `json:"folder_id"`
}

func (h *AdminMediaHandler) MoveMedia(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的媒体ID")
		return
	}

	var req MoveMediaReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "无效的目标文件夹")
		return
	}

	if err := h.mediaService.MoveMedia(id, req.FolderID); err != nil {
		response.ServerError(c, "移动媒体失败: "+err.Error())
		return
	}

	response.SuccessMsg(c, "移动成功", nil)
}


type SaveExternalReq struct {
	URL        string `json:"url" binding:"required"`
	FolderID   int64  `json:"folder_id"`
	DocumentID int64  `json:"document_id"`
	DocTitle   string `json:"doc_title"`
}

func (h *AdminMediaHandler) SaveExternal(c *gin.Context) {
	var req SaveExternalReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入有效的图片地址")
		return
	}
	media, err := h.mediaService.SaveExternalImage(req.URL, req.FolderID, req.DocumentID, req.DocTitle)
	if err != nil {
		response.BadRequest(c, "转存图片失败: "+err.Error())
		return
	}
	response.SuccessMsg(c, "图片成功转存至资源库", media)
}

type LocalizeImagesReq struct {
	Content    string `json:"content" binding:"required"`
	DocumentID int64  `json:"document_id"`
	DocTitle   string `json:"doc_title"`
}

func (h *AdminMediaHandler) LocalizeImages(c *gin.Context) {
	var req LocalizeImagesReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数无效")
		return
	}
	newContent, count, err := h.mediaService.LocalizeContentImages(req.Content, req.DocumentID, req.DocTitle)
	if err != nil {
		response.ServerError(c, "转存失败: "+err.Error())
		return
	}
	response.Success(c, gin.H{
		"content":         newContent,
		"localized_count": count,
	})
}
