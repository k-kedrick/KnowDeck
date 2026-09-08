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

func TestAdminInviteManagement(t *testing.T) {
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
	g.PUT("/invites/:id", h.Update)
	g.DELETE("/invites/:id", h.Delete)
	g.PATCH("/invites/:id/status", h.Disable)
	g.POST("/invites/batch-delete", h.BatchDelete)
	g.POST("/invites/batch-status", h.BatchStatus)
	g.GET("/invites/:id/users", h.GetUsers)
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
	created := call(http.MethodPost, "/api/admin/invites", `{"max_uses":5,"valid_days":7,"remark":"测试邀请码"}`)
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
	if item["code"] != plaintext {
		t.Fatalf("expected code %s, got %v", plaintext, item["code"])
	}
	if item["remark"] != "测试邀请码" {
		t.Fatalf("expected remark 测试邀请码, got %v", item["remark"])
	}
	for _, forbidden := range []string{"code_hash", "token"} {
		if _, exists := item[forbidden]; exists {
			t.Fatalf("invite list exposed %q", forbidden)
		}
	}

	updated := call(http.MethodPut, fmt.Sprintf("/api/admin/invites/%d", inviteID), `{"max_uses":10,"remark":"更新备注"}`)
	if updated.Code != http.StatusOK {
		t.Fatalf("update: %d %s", updated.Code, updated.Body.String())
	}

	batchStatus := call(http.MethodPost, "/api/admin/invites/batch-status", fmt.Sprintf(`{"ids":[%d],"status":"disabled"}`, inviteID))
	if batchStatus.Code != http.StatusOK {
		t.Fatalf("batch status: %d %s", batchStatus.Code, batchStatus.Body.String())
	}

	getUsers := call(http.MethodGet, fmt.Sprintf("/api/admin/invites/%d/users", inviteID), "")
	if getUsers.Code != http.StatusOK {
		t.Fatalf("get users: %d %s", getUsers.Code, getUsers.Body.String())
	}

	batchDelete := call(http.MethodPost, "/api/admin/invites/batch-delete", fmt.Sprintf(`{"ids":[%d]}`, inviteID))
	if batchDelete.Code != http.StatusOK {
		t.Fatalf("batch delete: %d %s", batchDelete.Code, batchDelete.Body.String())
	}
}
