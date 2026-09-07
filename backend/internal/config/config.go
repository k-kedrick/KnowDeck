package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	developmentJWTSecret = "feishu-kb-secret-key-change-in-production-2026"
	developmentAdminPass = "change-me"
)

type Config struct {
	Environment       string
	Port              int
	Host              string
	DBPath            string
	UploadDir         string
	JWTSecret         string
	JWTExpireHrs      int
	MaxUploadMB       int64
	MaxImageMB        int64
	MaxVideoMB        int64
	MaxFileMB         int64
	AdminUser         string
	AdminPass         string
	SiteName          string
	SiteURL           string
	FrontendIndexPath string
	FrontendIndexURL  string
	CORSOrigins       []string
	TrustedProxies    []string
}

func LoadConfig() *Config {
	loadDotEnv(".env")

	environment := strings.ToLower(getEnv("APP_ENV", "development"))
	port := getEnvInt("PORT", 3799)
	host := getEnv("HOST", "0.0.0.0")

	// Determine data directory (default to ../data or ./data)
	baseDataDir := getEnv("DATA_DIR", "./data")
	if _, err := os.Stat(baseDataDir); os.IsNotExist(err) {
		_ = os.MkdirAll(baseDataDir, 0755)
	}

	dbPath := getEnv("DB_PATH", filepath.Join(baseDataDir, "app.db"))
	uploadDir := getEnv("UPLOAD_DIR", "./uploads")
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		_ = os.MkdirAll(uploadDir, 0755)
	}

	jwtSecret := getEnv("JWT_SECRET", developmentJWTSecret)
	jwtExpireHrs := getEnvInt("JWT_EXPIRE_HOURS", 72)
	maxUploadMB := int64(getEnvInt("MAX_UPLOAD_MB", 1024))
	maxImageMB := int64(getEnvInt("MAX_IMAGE_MB", 20))
	maxVideoMB := int64(getEnvInt("MAX_VIDEO_MB", 1024))
	maxFileMB := int64(getEnvInt("MAX_FILE_MB", 100))

	adminUser := getEnv("ADMIN_USER", "change-me")
	adminPass := getEnv("ADMIN_PASSWORD", developmentAdminPass)
	siteName := getEnv("SITE_NAME", "知识库")
	siteURL := strings.TrimRight(getEnv("SITE_URL", "http://127.0.0.1:3799"), "/")
	frontendIndexPath := getEnv("FRONTEND_INDEX_PATH", "../frontend/dist/index.html")
	frontendIndexURL := getEnv("FRONTEND_INDEX_URL", "")
	corsOrigins := getEnvList("CORS_ALLOWED_ORIGINS", []string{
		"http://localhost:3788",
		"http://127.0.0.1:3788",
	})
	trustedProxies := getEnvList("TRUSTED_PROXIES", []string{"127.0.0.1", "::1"})

	return &Config{
		Environment:       environment,
		Port:              port,
		Host:              host,
		DBPath:            dbPath,
		UploadDir:         uploadDir,
		JWTSecret:         jwtSecret,
		JWTExpireHrs:      jwtExpireHrs,
		MaxUploadMB:       maxUploadMB,
		MaxImageMB:        maxImageMB,
		MaxVideoMB:        maxVideoMB,
		MaxFileMB:         maxFileMB,
		AdminUser:         adminUser,
		AdminPass:         adminPass,
		SiteName:          siteName,
		SiteURL:           siteURL,
		FrontendIndexPath: frontendIndexPath,
		FrontendIndexURL:  frontendIndexURL,
		CORSOrigins:       corsOrigins,
		TrustedProxies:    trustedProxies,
	}
}

func (c *Config) IsProduction() bool {
	return strings.EqualFold(c.Environment, "production")
}

// Validate rejects unsafe production defaults before the database is opened.
func (c *Config) Validate() error {
	if c.Port < 1 || c.Port > 65535 {
		return fmt.Errorf("PORT 必须在 1 到 65535 之间")
	}
	if c.MaxUploadMB < 1 || c.MaxImageMB < 1 || c.MaxVideoMB < 1 || c.MaxFileMB < 1 {
		return errors.New("上传大小限制必须为正整数")
	}
	if c.MaxImageMB > c.MaxUploadMB || c.MaxVideoMB > c.MaxUploadMB || c.MaxFileMB > c.MaxUploadMB {
		return errors.New("分类上传上限不能超过 MAX_UPLOAD_MB")
	}
	if c.JWTExpireHrs < 1 || c.JWTExpireHrs > 168 {
		return errors.New("JWT_EXPIRE_HOURS 必须在 1 到 168 之间")
	}
	parsedSiteURL, err := url.Parse(c.SiteURL)
	if err != nil || parsedSiteURL.Host == "" || (parsedSiteURL.Scheme != "http" && parsedSiteURL.Scheme != "https") {
		return errors.New("SITE_URL 必须是包含 http 或 https 的完整站点地址")
	}
	if !c.IsProduction() {
		return nil
	}
	if strings.EqualFold(parsedSiteURL.Hostname(), "localhost") || parsedSiteURL.Hostname() == "127.0.0.1" {
		return errors.New("production 环境的 SITE_URL 不能使用 localhost")
	}
	if c.JWTSecret == developmentJWTSecret || len(c.JWTSecret) < 32 {
		return errors.New("production 环境必须配置至少 32 字符的非默认 JWT_SECRET")
	}
	if c.AdminPass == developmentAdminPass || len(c.AdminPass) < 12 {
		return errors.New("production 环境必须配置至少 12 字符的非默认 ADMIN_PASSWORD")
	}
	for _, origin := range c.CORSOrigins {
		if origin == "*" {
			return errors.New("production 环境禁止使用通配 CORS origin")
		}
	}
	for _, proxy := range c.TrustedProxies {
		if proxy == "*" || proxy == "0.0.0.0/0" || proxy == "::/0" {
			return errors.New("production 环境禁止信任全部代理地址")
		}
	}
	return nil
}

func loadDotEnv(path string) {
	content, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(content), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		key = strings.TrimSpace(key)
		if !found || key == "" || os.Getenv(key) != "" {
			continue
		}
		value = strings.Trim(strings.TrimSpace(value), "\"'")
		_ = os.Setenv(key, value)
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if n, err := strconv.Atoi(val); err == nil {
			return n
		}
	}
	return defaultVal
}

func getEnvList(key string, defaultVal []string) []string {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}

	parts := strings.Split(val, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			items = append(items, item)
		}
	}
	if len(items) == 0 {
		return defaultVal
	}
	return items
}
