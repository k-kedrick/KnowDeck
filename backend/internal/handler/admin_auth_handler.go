package handler

import (
	"knowledge-base/backend/internal/middleware"
	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/service"
	"knowledge-base/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminAuthHandler struct {
	authService *service.AuthService
}

func NewAdminAuthHandler(authService *service.AuthService) *AdminAuthHandler {
	return &AdminAuthHandler{authService: authService}
}

// Login 管理员登录
func (h *AdminAuthHandler) Login(c *gin.Context) {
	var req model.LoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入用户名和密码")
		return
	}

	resp, err := h.authService.Login(req.Username, req.Password)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	response.SuccessMsg(c, "登录成功", resp)
}

// Me 获取当前登录管理员信息
func (h *AdminAuthHandler) Me(c *gin.Context) {
	userID, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		response.Unauthorized(c, "未登录")
		return
	}

	user, err := h.authService.GetUserByID(userID.(int64))
	if err != nil || user == nil {
		response.Unauthorized(c, "用户不存在")
		return
	}

	response.Success(c, user)
}

// UpdateProfile 更新个人资料与密码
func (h *AdminAuthHandler) UpdateProfile(c *gin.Context) {
	userID, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		response.Unauthorized(c, "未登录")
		return
	}

	var req model.UpdateProfileReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数格式错误")
		return
	}

	if err := h.authService.UpdateProfile(userID.(int64), req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessMsg(c, "资料更新成功", nil)
}

// Logout 退出登录
func (h *AdminAuthHandler) Logout(c *gin.Context) {
	response.SuccessMsg(c, "退出登录成功", nil)
}
