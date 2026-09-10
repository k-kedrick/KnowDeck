package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/handler"
	"knowledge-base/backend/internal/middleware"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/internal/service"
	"knowledge-base/backend/internal/storage"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.LoadConfig()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("❌ 配置校验失败: %v", err)
	}

	log.Printf("==================================================")
	log.Printf("🚀 正在启动只读知识库系统后端服务...")
	log.Printf("   数据库路径: %s", cfg.DBPath)
	log.Printf("   媒体存储目录: %s", cfg.UploadDir)
	log.Printf("   服务监听端口: %d", cfg.Port)
	log.Printf("==================================================")

	// 1. 初始化数据库与自动迁移
	db, err := repository.InitDB(cfg)
	if err != nil {
		log.Fatalf("❌ 数据库初始化失败: %v", err)
	}
	defer db.Close()

	// 2. 初始化存储引擎
	localStorage := storage.NewLocalStorage(cfg.UploadDir, "/uploads")

	// 3. 初始化仓储层
	userRepo := repository.NewUserRepository(db)
	catRepo := repository.NewCategoryRepository(db)
	tagRepo := repository.NewTagRepository(db)
	docRepo := repository.NewDocumentRepository(db)
	mediaRepo := repository.NewMediaRepository(db)
	mediaFolderRepo := repository.NewMediaFolderRepository(db)
	settingRepo := repository.NewSettingRepository(db)
	searchRepo := repository.NewSearchRepository(db)
	inviteRepo := repository.NewInviteRepository(db)

	// 4. 初始化服务层
	authService := service.NewAuthService(userRepo, cfg)
	catService := service.NewCategoryService(catRepo, docRepo)
	docService := service.NewDocumentService(docRepo, catRepo, mediaRepo)
	mediaService := service.NewMediaService(mediaRepo, mediaFolderRepo, docRepo, localStorage, cfg)
	if count, err := mediaService.RebuildReferences(); err != nil {
		log.Printf("[WARN] 启动时媒体引用修复失败: %v", err)
	} else {
		log.Printf("[media-reconcile] documents=%d", count)
	}
	settingService := service.NewSettingService(settingRepo, docRepo, catRepo, tagRepo)

	// 5. 初始化控制器
	publicHandler := handler.NewPublicHandler(docService, catService, tagRepo, searchRepo, mediaService, settingService)
	seoHandler := handler.NewSEOHandler(docRepo, settingService, cfg)
	adminAuthHandler := handler.NewAdminAuthHandler(authService)
	adminCategoryHandler := handler.NewAdminCategoryHandler(catService)
	adminTagHandler := handler.NewAdminTagHandler(tagRepo)
	adminDocHandler := handler.NewAdminDocumentHandler(docService)
	adminMediaHandler := handler.NewAdminMediaHandler(mediaService)
	adminSettingHandler := handler.NewAdminSettingHandler(settingService)
	adminInviteHandler := handler.NewAdminInviteHandler(service.NewInviteService(inviteRepo))
	registrationHandler := handler.NewRegistrationHandler(service.NewRegistrationService(userRepo, inviteRepo))
	adminUserHandler := handler.NewAdminUserHandler(userRepo)
	memberAuthHandler := handler.NewMemberAuthHandler(authService)

	// 6. 初始化限流器
	loginLimiter := middleware.NewRateLimiter(10, 1*time.Minute)
	searchLimiter := middleware.NewRateLimiter(60, 1*time.Minute)
	imageProxyLimiter := middleware.NewRateLimiter(300, 1*time.Minute)

	// 7. 配置 Gin 路由
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		log.Fatalf("❌ TRUSTED_PROXIES 配置无效: %v", err)
	}
	r.Use(gin.Recovery())
	r.Use(middleware.CORSMiddleware(cfg.CORSOrigins))
	r.Use(middleware.SecurityHeaders())

	// 静态上传目录服务 (方便开发与单体运行)
	r.Static("/uploads", cfg.UploadDir)

	// 健康检查
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "healthy",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// Public SEO HTML shells and discovery endpoints. React still renders the page body.
	r.GET("/", seoHandler.Home)
	r.GET("/blog", seoHandler.Blog)
	r.GET("/docs/:slug", seoHandler.Article)
	r.GET("/robots.txt", seoHandler.Robots)
	r.GET("/sitemap.xml", seoHandler.Sitemap)

	// 公开只读 API 分组 (严格 GET / 检索)
	apiPublic := r.Group("/api/public")
	{
		apiPublic.GET("/site/info", publicHandler.GetSiteInfo)
		apiPublic.GET("/categories/tree", publicHandler.GetKnowledgeTree)
		apiPublic.GET("/categories", publicHandler.ListCategories)
		apiPublic.GET("/tags", publicHandler.ListTags)
		apiPublic.GET("/documents", middleware.OptionalAuthMiddleware(authService), publicHandler.ListDocuments)
		apiPublic.GET("/documents/:slug", middleware.OptionalAuthMiddleware(authService), publicHandler.GetDocumentBySlug)
		apiPublic.GET("/search", middleware.OptionalAuthMiddleware(authService), searchLimiter.Middleware("搜索过于频繁，请稍后再试"), publicHandler.Search)
		apiPublic.GET("/media/download/:id", publicHandler.DownloadMedia)
		apiPublic.GET("/external-image", imageProxyLimiter.Middleware("图片请求过于频繁，请稍后再试"), publicHandler.ProxyExternalImage)
	}

	apiAuth := r.Group("/api/auth")
	{
		apiAuth.POST("/register", registrationHandler.Register)
		apiAuth.POST("/login", loginLimiter.Middleware("登录尝试过于频繁，请稍后再试"), memberAuthHandler.Login)
	}
	apiAuthProtected := r.Group("/api/auth")
	apiAuthProtected.Use(middleware.AuthMiddleware(authService))
	{
		apiAuthProtected.GET("/me", memberAuthHandler.Me)
		apiAuthProtected.PATCH("/password", memberAuthHandler.ChangePassword)
	}

	// 管理员认证 API
	apiAdminAuth := r.Group("/api/admin/auth")
	{
		apiAdminAuth.POST("/login", loginLimiter.Middleware("登录尝试过于频繁，请稍后再试"), adminAuthHandler.Login)
		apiAdminAuth.POST("/logout", adminAuthHandler.Logout)
	}

	// 管理员受保护业务 API (需要 JWT Token)
	apiAdmin := r.Group("/api/admin")
	apiAdmin.Use(middleware.AuthMiddleware(authService), middleware.RequireAdmin())
	{
		apiAdmin.GET("/users", adminUserHandler.List)
		apiAdmin.POST("/users", adminUserHandler.Create)
		apiAdmin.PATCH("/users/:id/status", adminUserHandler.UpdateStatus)
		apiAdmin.PATCH("/users/:id/role", adminUserHandler.UpdateRole)
		apiAdmin.POST("/users/:id/reset-password", adminUserHandler.ResetPassword)
		// 资料与状态
		apiAdmin.GET("/auth/me", adminAuthHandler.Me)
		apiAdmin.PATCH("/auth/credentials", adminAuthHandler.UpdateCredentials)

		// 分类管理
		apiAdmin.GET("/categories", adminCategoryHandler.List)
		apiAdmin.POST("/categories", adminCategoryHandler.Create)
		apiAdmin.PUT("/categories/:id", adminCategoryHandler.Update)
		apiAdmin.DELETE("/categories/:id", adminCategoryHandler.Delete)

		// 标签管理
		apiAdmin.GET("/tags", adminTagHandler.List)
		apiAdmin.POST("/tags", adminTagHandler.Create)
		apiAdmin.PUT("/tags/:id", adminTagHandler.Update)
		apiAdmin.DELETE("/tags/:id", adminTagHandler.Delete)

		// 文档管理
		apiAdmin.GET("/documents", adminDocHandler.List)
		apiAdmin.GET("/documents/:id", adminDocHandler.Get)
		apiAdmin.POST("/documents", adminDocHandler.Create)
		apiAdmin.PATCH("/documents/:id/status", adminDocHandler.UpdateStatus)
		apiAdmin.PUT("/documents/:id", adminDocHandler.Update)
		apiAdmin.DELETE("/documents/:id", adminDocHandler.Delete)

		// 媒体与文件夹管理
		apiAdmin.POST("/media/upload", adminMediaHandler.Upload)
		apiAdmin.POST("/media/upload-sessions", adminMediaHandler.StartChunkUpload)
		apiAdmin.PUT("/media/upload-sessions/:id/chunks/:index", adminMediaHandler.UploadChunk)
		apiAdmin.POST("/media/upload-sessions/:id/complete", adminMediaHandler.CompleteChunkUpload)
		apiAdmin.GET("/media", adminMediaHandler.List)
		apiAdmin.POST("/media/rebuild-references", adminMediaHandler.RebuildReferences)
		apiAdmin.POST("/media/batch-move", adminMediaHandler.BatchMove)
		apiAdmin.POST("/media/batch-delete", adminMediaHandler.BatchDelete)
		apiAdmin.GET("/media/:id/references", adminMediaHandler.References)
		apiAdmin.DELETE("/media/:id", adminMediaHandler.Delete)
		apiAdmin.PUT("/media/:id/move", adminMediaHandler.MoveMedia)
		apiAdmin.GET("/media/folders", adminMediaHandler.ListFolders)
		apiAdmin.POST("/media/folders", adminMediaHandler.CreateFolder)
		apiAdmin.PUT("/media/folders/:id", adminMediaHandler.UpdateFolder)
		apiAdmin.DELETE("/media/folders/:id", adminMediaHandler.DeleteFolder)
		apiAdmin.POST("/media/save-external", adminMediaHandler.SaveExternal)
		apiAdmin.POST("/media/localize-images", adminMediaHandler.LocalizeImages)

		// 邀请码
		apiAdmin.POST("/invites", adminInviteHandler.Create)
		apiAdmin.GET("/invites", adminInviteHandler.List)
		apiAdmin.PUT("/invites/:id", adminInviteHandler.Update)
		apiAdmin.DELETE("/invites/:id", adminInviteHandler.Delete)
		apiAdmin.PATCH("/invites/:id/status", adminInviteHandler.Disable)
		apiAdmin.POST("/invites/batch-delete", adminInviteHandler.BatchDelete)
		apiAdmin.POST("/invites/batch-status", adminInviteHandler.BatchStatus)
		apiAdmin.GET("/invites/:id/users", adminInviteHandler.GetUsers)

		// 系统设置
		apiAdmin.GET("/settings", adminSettingHandler.GetAll)
		apiAdmin.PUT("/settings", adminSettingHandler.Save)
	}

	// 8. 启动服务器与优雅关机
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Minute,
		WriteTimeout:      30 * time.Minute,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Printf("✨ 知识库后端服务成功启动: http://%s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ HTTP 服务异常退出: %v", err)
		}
	}()

	// 优雅关闭监听
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("🛑 收到退出信号，正在关闭服务...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("❌ 服务强制关闭: %v", err)
	}
	log.Println("✅ 知识库服务已安全退出")
}
