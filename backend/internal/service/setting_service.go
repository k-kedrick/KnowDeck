package service

import (
	"strconv"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
)

type SettingService struct {
	settingRepo *repository.SettingRepository
	docRepo     *repository.DocumentRepository
	catRepo     *repository.CategoryRepository
	tagRepo     *repository.TagRepository
}

func NewSettingService(
	settingRepo *repository.SettingRepository,
	docRepo *repository.DocumentRepository,
	catRepo *repository.CategoryRepository,
	tagRepo *repository.TagRepository,
) *SettingService {
	return &SettingService{
		settingRepo: settingRepo,
		docRepo:     docRepo,
		catRepo:     catRepo,
		tagRepo:     tagRepo,
	}
}

func (s *SettingService) GetPublicSiteInfo() (*model.SiteInfoResp, error) {
	settings, err := s.settingRepo.GetAll()
	if err != nil {
		return nil, err
	}

	docCount, _ := s.docRepo.CountPublished()
	catCount, _ := s.catRepo.Count()
	tagCount, _ := s.tagRepo.Count()

	allowDownload := true
	if val, ok := settings["allow_download"]; ok && val == "false" {
		allowDownload = false
	}

	return &model.SiteInfoResp{
		SiteName:      getMapVal(settings, "site_name", "知识库"),
		SiteSubtitle:  getMapVal(settings, "site_subtitle", "简洁、清晰的只读知识库与博客系统"),
		SiteLogo:      getMapVal(settings, "site_logo", ""),
		FooterText:    getMapVal(settings, "footer_text", "© 2026 知识库. All Rights Reserved."),
		AllowDownload: allowDownload,
		DocCount:      docCount,
		CategoryCount: catCount,
		TagCount:      tagCount,
	}, nil
}

func (s *SettingService) GetAllSettings() (map[string]string, error) {
	return s.settingRepo.GetAll()
}

func (s *SettingService) SaveSettings(settings map[string]string) error {
	return s.settingRepo.SetBatch(settings)
}

func (s *SettingService) GetBool(key string, defaultVal bool) bool {
	val, err := s.settingRepo.Get(key)
	if err != nil || val == "" {
		return defaultVal
	}
	b, err := strconv.ParseBool(val)
	if err != nil {
		return defaultVal
	}
	return b
}

func getMapVal(m map[string]string, key, defaultVal string) string {
	if val, ok := m[key]; ok && val != "" {
		return val
	}
	return defaultVal
}
