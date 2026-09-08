package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/middleware"
	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/internal/service"
)

func TestPublicDocumentAccessLevelAuthorization(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "public-access.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "x", JWTSecret: "secret", JWTExpireHrs: 1}
	db, err := repository.InitDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	users := repository.NewUserRepository(db)
	auth := service.NewAuthService(users, cfg)
	docs := repository.NewDocumentRepository(db)
	_, _ = docs.Create(&model.Document{Title: "Public", Slug: "public-acl", Content: "public body", Excerpt: "public excerpt", Status: "published", AccessLevel: "public", AuthorID: 1})
	_, _ = docs.Create(&model.Document{Title: "Locked", Slug: "locked-acl", Content: "restricted body secret", Excerpt: "restricted excerpt", Status: "published", AccessLevel: "authenticated", AuthorID: 1})
	memberID, _ := users.CreateManagedUser("member-acl", "hash", "member")
	member, _ := users.GetByID(memberID)
	admin, _ := users.GetByUsername("admin")
	memberToken, _ := auth.GenerateToken(member)
	adminToken, _ := auth.GenerateToken(admin)
	r := gin.New()
	h := NewPublicHandler(service.NewDocumentService(docs, repository.NewCategoryRepository(db)), nil, nil, nil, nil, nil)
	r.GET("/api/public/documents/:slug", middleware.OptionalAuthMiddleware(auth), h.GetDocumentBySlug)
	call := func(slug, token string) *httptest.ResponseRecorder {
		q := httptest.NewRequest(http.MethodGet, "/api/public/documents/"+slug, nil)
		if token != "" {
			q.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, q)
		return w
	}
	decode := func(w *httptest.ResponseRecorder) map[string]any {
		var v map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
			t.Fatal(err)
		}
		return v["data"].(map[string]any)
	}
	publicAnon := call("public-acl", "")
	if publicAnon.Code != 200 {
		t.Fatal(publicAnon.Code)
	}
	if d := decode(publicAnon); d["locked"] != false || d["document"].(map[string]any)["content"] != "public body" {
		t.Fatalf("public=%#v", d)
	}
	lockedAnon := call("locked-acl", "")
	if lockedAnon.Code != 200 {
		t.Fatal(lockedAnon.Code)
	}
	locked := decode(lockedAnon)
	secure := locked["document"].(map[string]any)
	if locked["locked"] != true || secure["access_level"] != "authenticated" {
		t.Fatalf("locked=%#v", locked)
	}
	for _, key := range []string{"content", "excerpt", "body", "markdown", "html", "token", "auth_version"} {
		if _, ok := secure[key]; ok {
			t.Fatalf("locked response leaked %s", key)
		}
	}
	for _, token := range []string{memberToken, adminToken} {
		w := call("locked-acl", token)
		if w.Code != 200 || decode(w)["locked"] != false || decode(w)["document"].(map[string]any)["content"] != "restricted body secret" {
			t.Fatalf("authenticated access %d %s", w.Code, w.Body.String())
		}
	}
	if w := call("public-acl", "bad-token"); w.Code != http.StatusUnauthorized {
		t.Fatalf("malformed token=%d", w.Code)
	}
	wrongSigner := service.NewAuthService(users, &config.Config{JWTSecret: "different-secret", JWTExpireHrs: 1})
	wrongToken, _ := wrongSigner.GenerateToken(admin)
	if w := call("public-acl", wrongToken); w.Code != http.StatusUnauthorized {
		t.Fatalf("invalid signature=%d", w.Code)
	}
	expiredSigner := service.NewAuthService(users, &config.Config{JWTSecret: cfg.JWTSecret, JWTExpireHrs: -1})
	expiredToken, _ := expiredSigner.GenerateToken(admin)
	if w := call("public-acl", expiredToken); w.Code != http.StatusUnauthorized {
		t.Fatalf("expired token=%d", w.Code)
	}
	if _, err := db.Exec("UPDATE users SET auth_version=auth_version+1 WHERE id=?", memberID); err != nil {
		t.Fatal(err)
	}
	if w := call("locked-acl", memberToken); w.Code != http.StatusUnauthorized {
		t.Fatalf("stale token=%d", w.Code)
	}
	fresh, _ := users.GetByID(memberID)
	freshToken, _ := auth.GenerateToken(fresh)
	if _, err := db.Exec("UPDATE users SET status='disabled' WHERE id=?", memberID); err != nil {
		t.Fatal(err)
	}
	if w := call("locked-acl", freshToken); w.Code != http.StatusUnauthorized {
		t.Fatalf("disabled token=%d", w.Code)
	}
	deletedID, _ := users.CreateManagedUser("deleted-acl", "hash", "member")
	deletedUser, _ := users.GetByID(deletedID)
	deletedToken, _ := auth.GenerateToken(deletedUser)
	if _, err := db.Exec("DELETE FROM users WHERE id = ?", deletedID); err != nil {
		t.Fatal(err)
	}
	if w := call("locked-acl", deletedToken); w.Code != http.StatusUnauthorized {
		t.Fatalf("deleted token=%d", w.Code)
	}
}
