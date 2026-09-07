package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/internal/service"
	"knowledge-base/backend/pkg/response"
	"strconv"
	"strings"
)

type AdminUserHandler struct {
	users   *repository.UserRepository
	service *service.AdminUserService
}

func NewAdminUserHandler(users *repository.UserRepository) *AdminUserHandler {
	return &AdminUserHandler{users: users, service: service.NewAdminUserService(users)}
}
func (h *AdminUserHandler) Create(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if c.ShouldBindJSON(&req) != nil {
		response.BadRequest(c, "参数格式错误")
		return
	}
	u, err := h.service.CreateUser(req.Username, req.Password, req.Role)
	if err == nil {
		c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "success", "data": gin.H{"id": u.ID, "username": u.Username, "role": u.Role, "status": u.Status}})
		return
	}
	if errors.Is(err, service.ErrUsernameExists) {
		response.Error(c, http.StatusConflict, http.StatusConflict, "用户名已存在")
		return
	}
	if errors.Is(err, service.ErrInvalidUsername) || errors.Is(err, service.ErrWeakPassword) || errors.Is(err, service.ErrInvalidRole) {
		response.BadRequest(c, "用户参数无效")
		return
	}
	response.ServerError(c, "创建用户失败")
}
func (h *AdminUserHandler) UpdateStatus(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		response.BadRequest(c, "用户 ID 无效")
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if c.ShouldBindJSON(&req) != nil {
		response.BadRequest(c, "状态参数无效")
		return
	}
	err = h.service.UpdateStatus(c.GetInt64("user_id"), id, req.Status)
	if err == nil {
		response.Success(c, gin.H{"id": id, "status": req.Status})
		return
	}
	if errors.Is(err, service.ErrInvalidStatus) {
		response.BadRequest(c, "状态参数无效")
		return
	}
	if errors.Is(err, service.ErrCannotDisableSelf) || errors.Is(err, repository.ErrLastActiveAdmin) {
		response.Error(c, 409, 409, "无法禁用用户")
		return
	}
	if errors.Is(err, repository.ErrUserNotFound) {
		response.NotFound(c, "用户不存在")
		return
	}
	response.ServerError(c, "更新用户状态失败")
}
func (h *AdminUserHandler) UpdateRole(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		response.BadRequest(c, "用户 ID 无效")
		return
	}
	var req struct {
		Role string `json:"role"`
	}
	if c.ShouldBindJSON(&req) != nil {
		response.BadRequest(c, "角色参数无效")
		return
	}
	err = h.service.UpdateRole(c.GetInt64("user_id"), id, req.Role)
	if err == nil {
		response.Success(c, gin.H{"id": id, "role": req.Role})
		return
	}
	if errors.Is(err, service.ErrInvalidRole) {
		response.BadRequest(c, "角色参数无效")
		return
	}
	if errors.Is(err, service.ErrCannotChangeOwnRole) || errors.Is(err, repository.ErrLastActiveAdmin) {
		response.Error(c, 409, 409, "无法修改用户角色")
		return
	}
	if errors.Is(err, repository.ErrUserNotFound) {
		response.NotFound(c, "用户不存在")
		return
	}
	response.ServerError(c, "更新用户角色失败")
}
func (h *AdminUserHandler) ResetPassword(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		response.BadRequest(c, "用户 ID 无效")
		return
	}
	var req struct {
		Password string `json:"password"`
	}
	if c.ShouldBindJSON(&req) != nil {
		response.BadRequest(c, "密码参数无效")
		return
	}
	err = h.service.ResetPassword(id, req.Password)
	if err == nil {
		response.Success(c, gin.H{"id": id})
		return
	}
	if errors.Is(err, service.ErrWeakPassword) {
		response.BadRequest(c, "密码至少需要 12 个字符")
		return
	}
	if errors.Is(err, repository.ErrUserNotFound) {
		response.NotFound(c, "用户不存在")
		return
	}
	response.ServerError(c, "重置密码失败")
}
func (h *AdminUserHandler) List(c *gin.Context) {
	f := repository.UserListFilter{Query: strings.TrimSpace(c.Query("q")), Role: c.Query("role"), Status: c.Query("status"), Page: 1, PageSize: 20}
	if f.Role != "" && f.Role != "admin" && f.Role != "member" {
		response.BadRequest(c, "role 参数无效")
		return
	}
	if f.Status != "" && f.Status != "active" && f.Status != "disabled" {
		response.BadRequest(c, "status 参数无效")
		return
	}
	var err error
	if c.Query("page") != "" {
		f.Page, err = strconv.Atoi(c.Query("page"))
		if err != nil || f.Page < 1 {
			response.BadRequest(c, "page 参数无效")
			return
		}
	}
	if c.Query("page_size") != "" {
		f.PageSize, err = strconv.Atoi(c.Query("page_size"))
		if err != nil || f.PageSize < 1 || f.PageSize > 100 {
			response.BadRequest(c, "page_size 参数无效")
			return
		}
	}
	users, total, err := h.users.ListUsers(f)
	if err != nil {
		response.ServerError(c, "获取用户失败")
		return
	}
	items := make([]gin.H, 0, len(users))
	for _, u := range users {
		items = append(items, gin.H{"id": u.ID, "username": u.Username, "role": u.Role, "status": u.Status, "created_at": u.CreatedAt, "updated_at": u.UpdatedAt})
	}
	response.Success(c, gin.H{"items": items, "total": total, "page": f.Page, "page_size": f.PageSize})
}
