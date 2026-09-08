package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/middleware"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/internal/service"
)

func TestAdminDocumentAccessLevelHTTP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "documents.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "x", JWTSecret: "secret", JWTExpireHrs: 1}
	db, err := repository.InitDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	users := repository.NewUserRepository(db)
	auth := service.NewAuthService(users, cfg)
	documents := repository.NewDocumentRepository(db)
	h := NewAdminDocumentHandler(service.NewDocumentService(documents, repository.NewCategoryRepository(db)))
	r := gin.New()
	g := r.Group("/api/admin")
	g.Use(middleware.AuthMiddleware(auth), middleware.RequireAdmin())
	g.POST("/documents", h.Create)
	g.GET("/documents/:id", h.Get)
	g.PUT("/documents/:id", h.Update)
	admin, _ := users.GetByUsername("admin")
	token, _ := auth.GenerateToken(admin)

	call := func(method, path, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}
	decodeData := func(w *httptest.ResponseRecorder) map[string]any {
		var body map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		data, ok := body["data"].(map[string]any)
		if !ok {
			t.Fatalf("missing data: %#v", body)
		}
		return data
	}

	publicResponse := call(http.MethodPost, "/api/admin/documents", `{"title":"Public","slug":"admin-public","content":"body"}`)
	if publicResponse.Code != http.StatusOK || decodeData(publicResponse)["access_level"] != "public" {
		t.Fatalf("default public create: %d %s", publicResponse.Code, publicResponse.Body.String())
	}
	restrictedResponse := call(http.MethodPost, "/api/admin/documents", `{"title":"Restricted","slug":"admin-restricted","content":"secret","access_level":"authenticated"}`)
	if restrictedResponse.Code != http.StatusOK {
		t.Fatalf("authenticated create: %d %s", restrictedResponse.Code, restrictedResponse.Body.String())
	}
	restrictedData := decodeData(restrictedResponse)
	if restrictedData["access_level"] != "authenticated" {
		t.Fatalf("create access_level = %#v", restrictedData["access_level"])
	}
	id := int64(restrictedData["id"].(float64))

	getResponse := call(http.MethodGet, fmt.Sprintf("/api/admin/documents/%d", id), "")
	if getResponse.Code != http.StatusOK || decodeData(getResponse)["access_level"] != "authenticated" {
		t.Fatalf("admin get: %d %s", getResponse.Code, getResponse.Body.String())
	}
	updateResponse := call(http.MethodPut, fmt.Sprintf("/api/admin/documents/%d", id), `{"title":"Restricted","slug":"admin-restricted","content":"secret","access_level":"public"}`)
	if updateResponse.Code != http.StatusOK || decodeData(updateResponse)["access_level"] != "public" {
		t.Fatalf("admin update: %d %s", updateResponse.Code, updateResponse.Body.String())
	}
	invalidResponse := call(http.MethodPost, "/api/admin/documents", `{"title":"Invalid","slug":"admin-invalid","access_level":"private"}`)
	if invalidResponse.Code != http.StatusBadRequest {
		t.Fatalf("invalid access_level: %d %s", invalidResponse.Code, invalidResponse.Body.String())
	}
}
