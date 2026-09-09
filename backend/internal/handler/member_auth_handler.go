package handler

import (
	"errors"
	"net/http"

	"knowledge-base/backend/internal/middleware"
	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
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

func (h *MemberAuthHandler) ChangePassword(c *gin.Context) {
	var req model.ChangePasswordReq
	if err := c.ShouldBindJSON(&req); err != nil || req.CurrentPassword == "" || req.NewPassword == "" {
		response.BadRequest(c, "密码参数无效")
		return
	}
	userID := c.GetInt64(middleware.ContextUserIDKey)
	login, err := h.authService.ChangePassword(userID, req.CurrentPassword, req.NewPassword)
	if err == nil {
		response.SuccessMsg(c, "密码修改成功", gin.H{
			"token": login.Token,
			"user": gin.H{
				"id": login.User.ID, "username": login.User.Username, "role": login.User.Role, "status": login.User.Status,
			},
		})
		return
	}
	switch {
	case errors.Is(err, service.ErrCurrentPasswordInvalid):
		response.BadRequest(c, "当前密码不正确")
	case errors.Is(err, service.ErrWeakPassword):
		response.BadRequest(c, "新密码至少需要 12 个字符")
	case errors.Is(err, service.ErrNewPasswordUnchanged):
		response.BadRequest(c, "新密码不能与当前密码相同")
	case errors.Is(err, repository.ErrUserNotFound):
		response.NotFound(c, "用户不存在")
	default:
		response.ServerError(c, "修改密码失败")
	}
}
