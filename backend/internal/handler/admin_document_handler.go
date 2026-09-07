package handler

import (
	"strconv"

	"knowledge-base/backend/internal/middleware"
	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/internal/service"
	"knowledge-base/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminDocumentHandler struct {
	docService *service.DocumentService
}

func NewAdminDocumentHandler(docService *service.DocumentService) *AdminDocumentHandler {
	return &AdminDocumentHandler{docService: docService}
}

func (h *AdminDocumentHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "15"))
	status := c.Query("status")
	categoryID, _ := strconv.ParseInt(c.Query("category_id"), 10, 64)
	tag := c.Query("tag")
	keyword := c.Query("keyword")

	filter := repository.DocumentFilter{
		Status:     status,
		CategoryID: categoryID,
		Tag:        tag,
		Keyword:    keyword,
		Page:       page,
		PageSize:   pageSize,
	}

	list, total, err := h.docService.List(filter)
	if err != nil {
		response.ServerError(c, "获取文档列表失败")
		return
	}

	response.SuccessPage(c, list, total, page, pageSize)
}

func (h *AdminDocumentHandler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的文档ID")
		return
	}

	doc, err := h.docService.GetByID(id)
	if err != nil || doc == nil {
		response.NotFound(c, "文档不存在")
		return
	}

	response.Success(c, doc)
}

func (h *AdminDocumentHandler) Create(c *gin.Context) {
	userID, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		response.Unauthorized(c, "未登录")
		return
	}

	var req model.DocumentSaveReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数校验失败: "+err.Error())
		return
	}

	doc, err := h.docService.Create(userID.(int64), req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessMsg(c, "创建文档成功", doc)
}

func (h *AdminDocumentHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的文档ID")
		return
	}

	var req model.DocumentSaveReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数校验失败: "+err.Error())
		return
	}

	doc, err := h.docService.Update(id, req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessMsg(c, "更新文档成功", doc)
}

func (h *AdminDocumentHandler) UpdateStatus(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的文档ID")
		return
	}

	var req model.DocumentStatusReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数校验失败: "+err.Error())
		return
	}

	doc, err := h.docService.UpdateStatus(id, req.Status)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessMsg(c, "更新文档状态成功", doc)
}

func (h *AdminDocumentHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的文档ID")
		return
	}

	if err := h.docService.Delete(id); err != nil {
		response.ServerError(c, "删除文档失败")
		return
	}

	response.SuccessMsg(c, "删除文档成功", nil)
}
