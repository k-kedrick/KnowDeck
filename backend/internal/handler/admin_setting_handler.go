package handler

import (
	"knowledge-base/backend/internal/service"
	"knowledge-base/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminSettingHandler struct {
	settingService *service.SettingService
}

func NewAdminSettingHandler(settingService *service.SettingService) *AdminSettingHandler {
	return &AdminSettingHandler{settingService: settingService}
}

func (h *AdminSettingHandler) GetAll(c *gin.Context) {
	settings, err := h.settingService.GetAllSettings()
	if err != nil {
		response.ServerError(c, "获取系统配置失败")
		return
	}
	response.Success(c, settings)
}

func (h *AdminSettingHandler) Save(c *gin.Context) {
	var settings map[string]string
	if err := c.ShouldBindJSON(&settings); err != nil {
		response.BadRequest(c, "参数格式错误")
		return
	}

	if err := h.settingService.SaveSettings(settings); err != nil {
		response.ServerError(c, "保存系统配置失败")
		return
	}

	response.SuccessMsg(c, "配置保存成功", settings)
}
