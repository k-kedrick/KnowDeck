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

func TestAdminInvitePlaintextIsCreateOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "invites.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "x", JWTSecret: "secret", JWTExpireHrs: 1}
	db, err := repository.InitDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	users := repository.NewUserRepository(db)
	auth := service.NewAuthService(users, cfg)
	h := NewAdminInviteHandler(service.NewInviteService(repository.NewInviteRepository(db)))
	r := gin.New()
	g := r.Group("/api/admin")
	g.Use(middleware.AuthMiddleware(auth), middleware.RequireAdmin())
	g.POST("/invites", h.Create)
	g.GET("/invites", h.List)
	g.PATCH("/invites/:id/status", h.Disable)
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
	created := call(http.MethodPost, "/api/admin/invites", `{"max_uses":1}`)
	if created.Code != http.StatusOK {
		t.Fatalf("create: %d %s", created.Code, created.Body.String())
	}
	var createBody map[string]any
	if err := json.Unmarshal(created.Body.Bytes(), &createBody); err != nil {
		t.Fatal(err)
	}
	createData, ok := createBody["data"].(map[string]any)
	if !ok || createData["code"] == "" || createData["code_hash"] != nil {
		t.Fatalf("unsafe create response: %#v", createBody)
	}
	inviteID := int64(createData["id"].(float64))
	plaintext := createData["code"].(string)

	listed := call(http.MethodGet, "/api/admin/invites", "")
	if listed.Code != http.StatusOK {
		t.Fatalf("list: %d %s", listed.Code, listed.Body.String())
	}
	var listBody map[string]any
	if err := json.Unmarshal(listed.Body.Bytes(), &listBody); err != nil {
		t.Fatal(err)
	}
	listData := listBody["data"].(map[string]any)
	item := listData["items"].([]any)[0].(map[string]any)
	for _, forbidden := range []string{"code", "code_hash", "invite_code", "token"} {
		if _, exists := item[forbidden]; exists {
			t.Fatalf("invite list exposed %q", forbidden)
		}
	}
	if strings.Contains(listed.Body.String(), plaintext) {
		t.Fatal("invite plaintext reappeared in list response")
	}

	disabled := call(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d/status", inviteID), `{"status":"disabled"}`)
	if disabled.Code != http.StatusOK {
		t.Fatalf("disable: %d %s", disabled.Code, disabled.Body.String())
	}
}
