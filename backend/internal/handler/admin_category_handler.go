package handler

import (
	"strconv"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/service"
	"knowledge-base/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminCategoryHandler struct {
	catService *service.CategoryService
}

func NewAdminCategoryHandler(catService *service.CategoryService) *AdminCategoryHandler {
	return &AdminCategoryHandler{catService: catService}
}

func (h *AdminCategoryHandler) List(c *gin.Context) {
	tree, err := h.catService.GetTree()
	if err != nil {
		response.ServerError(c, "获取分类列表失败")
		return
	}
	response.Success(c, tree)
}

func (h *AdminCategoryHandler) Create(c *gin.Context) {
	var req model.CategorySaveReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数校验失败: "+err.Error())
		return
	}

	cat, err := h.catService.Create(req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessMsg(c, "创建分类成功", cat)
}

func (h *AdminCategoryHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的分类ID")
		return
	}

	var req model.CategorySaveReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数校验失败: "+err.Error())
		return
	}

	cat, err := h.catService.Update(id, req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessMsg(c, "更新分类成功", cat)
}

func (h *AdminCategoryHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的分类ID")
		return
	}

	if err := h.catService.Delete(id); err != nil {
		response.ServerError(c, "删除分类失败")
		return
	}

	response.SuccessMsg(c, "删除分类成功", nil)
}
