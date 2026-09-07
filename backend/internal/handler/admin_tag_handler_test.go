package handler

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"testing"

	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

func TestAdminTagDeleteRequiresExplicitForceForUsedTag(t *testing.T) {
	directory := t.TempDir()
	db, err := repository.InitDB(&config.Config{
		DBPath:       filepath.Join(directory, "tag-handler.db"),
		UploadDir:    filepath.Join(directory, "uploads"),
		AdminUser:    "admin",
		AdminPass:    "test-admin-password",
		JWTSecret:    "test-secret",
		JWTExpireHrs: 1,
		MaxUploadMB:  10,
		SiteName:     "test",
	})
	if err != nil {
		t.Fatalf("initialize database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if _, err := db.Exec("DELETE FROM document_tags; DELETE FROM documents; DELETE FROM tags"); err != nil {
		t.Fatalf("clear seed data: %v", err)
	}
	tagResult, err := db.Exec("INSERT INTO tags (name, slug) VALUES ('Used', 'used')")
	if err != nil {
		t.Fatalf("insert tag: %v", err)
	}
	tagID, _ := tagResult.LastInsertId()
	documentResult, err := db.Exec("INSERT INTO documents (title, slug, status) VALUES ('Keep', 'keep', 'draft')")
	if err != nil {
		t.Fatalf("insert document: %v", err)
	}
	documentID, _ := documentResult.LastInsertId()
	if _, err := db.Exec("INSERT INTO document_tags (document_id, tag_id) VALUES (?, ?)", documentID, tagID); err != nil {
		t.Fatalf("link tag: %v", err)
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.DELETE("/api/admin/tags/:id", NewAdminTagHandler(repository.NewTagRepository(db)).Delete)

	blocked := httptest.NewRecorder()
	router.ServeHTTP(blocked, httptest.NewRequest(http.MethodDelete, "/api/admin/tags/"+strconv.FormatInt(tagID, 10), nil))
	if blocked.Code != http.StatusBadRequest {
		t.Fatalf("unforced delete status = %d, want 400: %s", blocked.Code, blocked.Body.String())
	}

	forced := httptest.NewRecorder()
	router.ServeHTTP(forced, httptest.NewRequest(http.MethodDelete, "/api/admin/tags/"+strconv.FormatInt(tagID, 10)+"?force=true", nil))
	if forced.Code != http.StatusOK {
		t.Fatalf("forced delete status = %d, want 200: %s", forced.Code, forced.Body.String())
	}

	var documentCount int
	if err := db.QueryRow("SELECT COUNT(*) FROM documents WHERE id = ?", documentID).Scan(&documentCount); err != nil {
		t.Fatalf("count remaining documents: %v", err)
	}
	if documentCount != 1 {
		t.Fatalf("document count = %d, want 1", documentCount)
	}
}
