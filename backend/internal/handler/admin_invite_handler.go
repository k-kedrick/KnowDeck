package handler

import (
	"github.com/gin-gonic/gin"
	"knowledge-base/backend/internal/middleware"
	"knowledge-base/backend/internal/service"
	"knowledge-base/backend/pkg/response"
	"strconv"
	"time"
)

type AdminInviteHandler struct{ service *service.InviteService }

func NewAdminInviteHandler(s *service.InviteService) *AdminInviteHandler {
	return &AdminInviteHandler{s}
}

type createInviteRequest struct {
	MaxUses   int        `json:"max_uses"`
	ExpiresAt *time.Time `json:"expires_at"`
}

func (h *AdminInviteHandler) Create(c *gin.Context) {
	var req createInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "邀请码参数无效")
		return
	}
	code, id, err := h.service.Generate(c.GetInt64(middleware.ContextUserIDKey), req.MaxUses, req.ExpiresAt)
	if err != nil {
		response.BadRequest(c, "邀请码参数无效")
		return
	}
	max := req.MaxUses
	if max == 0 {
		max = 1
	}
	response.Success(c, gin.H{"id": id, "code": code, "status": "active", "max_uses": max, "used_count": 0, "expires_at": req.ExpiresAt})
}

type inviteListItem struct {
	ID        int64      `json:"id"`
	CreatedBy int64      `json:"created_by"`
	Status    string     `json:"status"`
	MaxUses   *int       `json:"max_uses"`
	UsedCount int        `json:"used_count"`
	ExpiresAt *time.Time `json:"expires_at"`
}

func (h *AdminInviteHandler) List(c *gin.Context) {
	items, err := h.service.List()
	if err != nil {
		response.ServerError(c, "获取邀请码失败")
		return
	}
	out := make([]inviteListItem, 0, len(items))
	for _, v := range items {
		out = append(out, inviteListItem{v.ID, v.CreatedBy, v.Status, v.MaxUses, v.UsedCount, v.ExpiresAt})
	}
	response.Success(c, gin.H{"items": out})
}

func (h *AdminInviteHandler) Disable(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		response.BadRequest(c, "邀请码 ID 无效")
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Status != "disabled" {
		response.BadRequest(c, "邀请码状态无效")
		return
	}
	if err := h.service.Disable(id); err != nil {
		if err.Error() == "invite not found" {
			response.NotFound(c, "邀请码不存在")
			return
		}
		response.ServerError(c, "禁用邀请码失败")
		return
	}
	response.Success(c, gin.H{"id": id, "status": "disabled"})
}
