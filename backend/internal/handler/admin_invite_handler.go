package handler

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"knowledge-base/backend/internal/middleware"
	"knowledge-base/backend/internal/service"
	"knowledge-base/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminInviteHandler struct{ service *service.InviteService }

func NewAdminInviteHandler(s *service.InviteService) *AdminInviteHandler {
	return &AdminInviteHandler{s}
}

type createInviteRequest struct {
	Count      int        `json:"count"`
	CustomCode string     `json:"custom_code"`
	MaxUses    int        `json:"max_uses"`
	ValidDays  int        `json:"valid_days"`
	ExpiresAt  *time.Time `json:"expires_at"`
	Remark     string     `json:"remark"`
}

func (h *AdminInviteHandler) Create(c *gin.Context) {
	var req createInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "邀请码参数无效")
		return
	}
	userID := c.GetInt64(middleware.ContextUserIDKey)

	// Batch creation
	if req.Count > 1 {
		codes, err := h.service.GenerateBatch(userID, req.Count, req.MaxUses, req.ValidDays, req.Remark)
		if err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		response.Success(c, gin.H{
			"codes": codes,
			"count": len(codes),
		})
		return
	}

	// Single creation (random or custom)
	code, id, err := h.service.GenerateSingle(userID, req.CustomCode, req.MaxUses, req.ValidDays, req.ExpiresAt, req.Remark)
	if err != nil {
		if errors.Is(err, service.ErrInviteCodeExists) {
			response.Error(c, http.StatusConflict, 409, "该邀请码已存在，请更换其他字符")
			return
		}
		response.BadRequest(c, err.Error())
		return
	}

	max := req.MaxUses
	if max <= 0 {
		max = 1
	}

	var expiry *time.Time
	if req.ValidDays > 0 {
		t := time.Now().Add(time.Duration(req.ValidDays) * 24 * time.Hour)
		expiry = &t
	} else {
		expiry = req.ExpiresAt
	}

	response.Success(c, gin.H{
		"id":         id,
		"code":       code,
		"remark":     req.Remark,
		"status":     "active",
		"max_uses":   max,
		"used_count": 0,
		"expires_at": expiry,
	})
}

type inviteListItem struct {
	ID        int64      `json:"id"`
	Code      string     `json:"code"`
	CreatedBy int64      `json:"created_by"`
	Remark    string     `json:"remark"`
	Status    string     `json:"status"`
	MaxUses   *int       `json:"max_uses"`
	UsedCount int        `json:"used_count"`
	ExpiresAt *time.Time `json:"expires_at"`
	CreatedAt time.Time  `json:"created_at"`
}

func (h *AdminInviteHandler) List(c *gin.Context) {
	items, err := h.service.List()
	if err != nil {
		response.ServerError(c, "获取邀请码列表失败")
		return
	}
	out := make([]inviteListItem, 0, len(items))
	for _, v := range items {
		out = append(out, inviteListItem{
			ID:        v.ID,
			Code:      v.Code,
			CreatedBy: v.CreatedBy,
			Remark:    v.Remark,
			Status:    v.Status,
			MaxUses:   v.MaxUses,
			UsedCount: v.UsedCount,
			ExpiresAt: v.ExpiresAt,
			CreatedAt: v.CreatedAt,
		})
	}
	response.Success(c, gin.H{"items": out})
}

type updateInviteRequest struct {
	Remark    string     `json:"remark"`
	MaxUses   int        `json:"max_uses"`
	ValidDays *int       `json:"valid_days"`
	ExpiresAt *time.Time `json:"expires_at"`
	Status    string     `json:"status"`
}

func (h *AdminInviteHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		response.BadRequest(c, "邀请码 ID 无效")
		return
	}
	var req updateInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "更新参数无效")
		return
	}

	if err := h.service.Update(id, req.Remark, req.MaxUses, req.ValidDays, req.ExpiresAt, req.Status); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, gin.H{"id": id, "updated": true})
}

func (h *AdminInviteHandler) UpdateStatus(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		response.BadRequest(c, "邀请码 ID 无效")
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.Status == "active" {
		if err := h.service.Enable(id); err != nil {
			if err.Error() == "invite not found" {
				response.NotFound(c, "邀请码不存在")
				return
			}
			response.ServerError(c, "启用邀请码失败")
			return
		}
		response.Success(c, gin.H{"id": id, "status": "active"})
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

func (h *AdminInviteHandler) Disable(c *gin.Context) {
	h.UpdateStatus(c)
}

func (h *AdminInviteHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		response.BadRequest(c, "邀请码 ID 无效")
		return
	}
	if err := h.service.Delete(id); err != nil {
		response.ServerError(c, err.Error())
		return
	}
	response.Success(c, gin.H{"id": id, "deleted": true})
}

func (h *AdminInviteHandler) BatchDelete(c *gin.Context) {
	var req struct {
		IDs []int64 `json:"ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.IDs) == 0 {
		response.BadRequest(c, "未选择要删除的邀请码")
		return
	}
	count, err := h.service.BatchDelete(req.IDs)
	if err != nil {
		response.ServerError(c, "批量删除邀请码失败")
		return
	}
	response.Success(c, gin.H{"deleted_count": count})
}

func (h *AdminInviteHandler) BatchStatus(c *gin.Context) {
	var req struct {
		IDs    []int64 `json:"ids"`
		Status string  `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.IDs) == 0 {
		response.BadRequest(c, "未选择要更新的邀请码")
		return
	}
	count, err := h.service.BatchUpdateStatus(req.IDs, req.Status)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}
	response.Success(c, gin.H{"updated_count": count, "status": req.Status})
}

func (h *AdminInviteHandler) GetUsers(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		response.BadRequest(c, "邀请码 ID 无效")
		return
	}
	users, err := h.service.GetUsersByInviteID(id)
	if err != nil {
		response.ServerError(c, "获取使用者列表失败")
		return
	}
	response.Success(c, gin.H{"items": users})
}
