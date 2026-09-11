package handler

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/internal/service"
	"knowledge-base/backend/internal/storage"
)

func TestAdminMediaListFoldersReturnsServerErrorWhenStatsFail(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, dependency := range []string{"media_document_refs", "documents"} {
		t.Run(dependency, func(t *testing.T) {
			cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "media.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "test", JWTSecret: "test-secret", JWTExpireHrs: 1, MaxImageMB: 20, MaxVideoMB: 1024, MaxFileMB: 100, MaxUploadMB: 1024}
			db, err := repository.InitDB(cfg)
			if err != nil {
				t.Fatalf("init database: %v", err)
			}
			defer db.Close()
			if _, err := db.Exec(fmt.Sprintf(`DROP TABLE %s`, dependency)); err != nil {
				t.Fatalf("drop %s: %v", dependency, err)
			}

			mediaService := service.NewMediaService(repository.NewMediaRepository(db), repository.NewMediaFolderRepository(db), repository.NewDocumentRepository(db), storage.NewLocalStorage(cfg.UploadDir, "/uploads"), cfg)
			h := NewAdminMediaHandler(mediaService)
			r := gin.New()
			r.GET("/media/folders", h.ListFolders)

			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/media/folders", nil))
			if w.Code != http.StatusInternalServerError {
				t.Fatalf("ListFolders status=%d body=%s, want %d", w.Code, w.Body.String(), http.StatusInternalServerError)
			}
		})
	}
}
