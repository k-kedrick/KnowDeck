package handler

import (
	"errors"
	"strconv"
	"strings"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/pkg/response"
	"knowledge-base/backend/pkg/utils"

	"github.com/gin-gonic/gin"
)

type AdminTagHandler struct {
	tagRepo *repository.TagRepository
}

func NewAdminTagHandler(tagRepo *repository.TagRepository) *AdminTagHandler {
	return &AdminTagHandler{tagRepo: tagRepo}
}

func (h *AdminTagHandler) List(c *gin.Context) {
	tags, err := h.tagRepo.ListAll()
	if err != nil {
		response.ServerError(c, "获取标签列表失败")
		return
	}
	response.Success(c, tags)
}

func (h *AdminTagHandler) Create(c *gin.Context) {
	var req model.TagSaveReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数校验失败: "+err.Error())
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		response.BadRequest(c, "标签名称不能为空")
		return
	}

	slug := strings.TrimSpace(req.Slug)
	if slug == "" {
		slug = utils.Slugify(name)
	}

	tag, err := h.tagRepo.GetOrCreate(name, slug)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessMsg(c, "创建标签成功", tag)
}

func (h *AdminTagHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的标签ID")
		return
	}

	var req model.TagSaveReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数校验失败: "+err.Error())
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		response.BadRequest(c, "标签名称不能为空")
		return
	}

	slug := strings.TrimSpace(req.Slug)
	if slug == "" {
		slug = utils.Slugify(name)
	}

	tag, err := h.tagRepo.Update(id, name, slug)
	if err != nil {
		if errors.Is(err, repository.ErrTagNameExists) {
			response.BadRequest(c, err.Error())
			return
		}
		response.ServerError(c, "更新标签失败")
		return
	}

	response.SuccessMsg(c, "更新标签成功", tag)
}

func (h *AdminTagHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的标签ID")
		return
	}

	documentCount, err := h.tagRepo.CountDocuments(id)
	if err != nil {
		response.ServerError(c, "检查标签关联失败")
		return
	}
	if documentCount > 0 && c.Query("force") != "true" {
		response.BadRequest(c, "标签仍有关联文档，请确认影响后再删除")
		return
	}

	if err := h.tagRepo.Delete(id); err != nil {
		response.ServerError(c, "删除标签失败")
		return
	}

	response.SuccessMsg(c, "删除标签成功", nil)
}
