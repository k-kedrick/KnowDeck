package handler

import (
	"errors"
	"net/http"

	"knowledge-base/backend/internal/service"
	"knowledge-base/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type RegistrationHandler struct {
	registrationService *service.RegistrationService
}

func NewRegistrationHandler(registrationService *service.RegistrationService) *RegistrationHandler {
	return &RegistrationHandler{registrationService: registrationService}
}

type registerRequest struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	InviteCode string `json:"invite_code"`
}

type registeredUserResponse struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	Status   string `json:"status"`
}

func (h *RegistrationHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Username == "" || req.Password == "" || req.InviteCode == "" {
		response.BadRequest(c, "注册参数无效")
		return
	}

	user, err := h.registrationService.Register(req.Username, req.Password, req.InviteCode)
	if err == nil {
		response.Success(c, registeredUserResponse{ID: user.ID, Username: user.Username, Role: user.Role, Status: user.Status})
		return
	}

	switch {
	case errors.Is(err, service.ErrInvalidUsername):
		response.BadRequest(c, "用户名长度需为 3 到 32 个字符")
	case errors.Is(err, service.ErrWeakPassword):
		response.BadRequest(c, "密码至少需要 12 个字符")
	case errors.Is(err, service.ErrUsernameExists):
		response.Error(c, http.StatusConflict, http.StatusConflict, "用户名已存在")
	case errors.Is(err, service.ErrInvalidInviteCode):
		response.BadRequest(c, "邀请码无效")
	case errors.Is(err, service.ErrInviteCodeDisabled):
		response.BadRequest(c, "邀请码已禁用")
	case errors.Is(err, service.ErrInviteCodeExpired):
		response.BadRequest(c, "邀请码已过期")
	case errors.Is(err, service.ErrInviteCodeExhausted):
		response.BadRequest(c, "邀请码已用尽")
	default:
		response.ServerError(c, "注册失败")
	}
}
