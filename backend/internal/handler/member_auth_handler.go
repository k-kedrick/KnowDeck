package handler

import (
	"errors"
	"net/http"

	"knowledge-base/backend/internal/middleware"
	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/service"
	"knowledge-base/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type MemberAuthHandler struct{ authService *service.AuthService }

func NewMemberAuthHandler(authService *service.AuthService) *MemberAuthHandler {
	return &MemberAuthHandler{authService: authService}
}

func (h *MemberAuthHandler) Me(c *gin.Context) {
	user, exists := c.Get(middleware.ContextUserKey)
	if !exists {
		response.Unauthorized(c, "未登录")
		return
	}
	current := user.(*model.User)
	response.Success(c, gin.H{"id": current.ID, "username": current.Username, "role": current.Role, "status": current.Status})
}

func (h *MemberAuthHandler) Login(c *gin.Context) {
	var req model.LoginReq
	if err := c.ShouldBindJSON(&req); err != nil || req.Username == "" || req.Password == "" {
		response.BadRequest(c, "登录参数无效")
		return
	}
	login, err := h.authService.Login(req.Username, req.Password)
	if err == nil {
		response.Success(c, gin.H{"token": login.Token, "user": gin.H{"id": login.User.ID, "username": login.User.Username, "role": login.User.Role, "status": login.User.Status}})
		return
	}
	if errors.Is(err, service.ErrInvalidCredentials) {
		response.Unauthorized(c, "用户名或密码错误")
		return
	}
	if errors.Is(err, service.ErrAccountDisabled) {
		response.Forbidden(c, "账号已禁用")
		return
	}
	response.Error(c, http.StatusInternalServerError, http.StatusInternalServerError, "登录失败")
}
