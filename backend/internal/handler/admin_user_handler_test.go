package handler

import (
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/middleware"
	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/internal/service"
	"knowledge-base/backend/pkg/utils"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestAdminUserListHTTP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "x.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "x", JWTSecret: "secret", JWTExpireHrs: 1}
	db, err := repository.InitDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	users := repository.NewUserRepository(db)
	auth := service.NewAuthService(users, cfg)
	r := gin.New()
	g := r.Group("/api/admin")
	g.Use(middleware.AuthMiddleware(auth), middleware.RequireAdmin())
	g.GET("/users", NewAdminUserHandler(users).List)
	for _, x := range []struct{ n, r, s string }{{"alice", "member", "active"}, {"alice2", "member", "active"}, {"bob", "member", "disabled"}} {
		if _, err := db.Exec("INSERT INTO users(username,password_hash,nickname,role,status) VALUES(?,?,?,?,?)", x.n, "$2a$known-hash", x.n, x.r, x.s); err != nil {
			t.Fatal(err)
		}
	}
	admin, _ := users.GetByUsername("admin")
	adminToken, _ := auth.GenerateToken(admin)
	member, _ := users.GetByUsername("alice")
	memberToken, _ := auth.GenerateToken(member)
	get := func(query, token string) *httptest.ResponseRecorder {
		q := httptest.NewRequest(http.MethodGet, "/api/admin/users"+query, nil)
		if token != "" {
			q.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, q)
		return w
	}
	if w := get("", ""); w.Code != 401 {
		t.Fatal(w.Code)
	}
	if w := get("", memberToken); w.Code != 403 {
		t.Fatal(w.Code)
	}
	w := get("?q=ali&role=member&status=active&page=1&page_size=2", adminToken)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "alice") || strings.Contains(w.Body.String(), "bob") || strings.Contains(w.Body.String(), "password_hash") || strings.Contains(w.Body.String(), "$2a$known-hash") {
		t.Fatal(w.Code, w.Body.String())
	}
	for _, q := range []string{"?role=superadmin", "?status=banned", "?page=0", "?page=-1", "?page_size=0", "?page_size=101"} {
		if w := get(q, adminToken); w.Code != 400 {
			t.Fatal(q, w.Code)
		}
	}
	if w := get("?status=disabled", adminToken); w.Code != 200 || !strings.Contains(w.Body.String(), "bob") {
		t.Fatal(w.Code, w.Body.String())
	}
}

func TestAdminUserStatusHTTP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "status.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "test", JWTSecret: "secret", JWTExpireHrs: 1}
	db, err := repository.InitDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	users := repository.NewUserRepository(db)
	auth := service.NewAuthService(users, cfg)
	r := gin.New()
	g := r.Group("/api/admin")
	g.Use(middleware.AuthMiddleware(auth), middleware.RequireAdmin())
	h := NewAdminUserHandler(users)
	g.PATCH("/users/:id/status", h.UpdateStatus)
	_, err = db.Exec("INSERT INTO users(username,password_hash,nickname,role,status)VALUES('member','h','member','member','active')")
	if err != nil {
		t.Fatal(err)
	}
	admin, _ := users.GetByUsername("admin")
	token, _ := auth.GenerateToken(admin)
	member, _ := users.GetByUsername("member")
	mt, _ := auth.GenerateToken(member)
	patch := func(id int64, status, token string) *httptest.ResponseRecorder {
		q := httptest.NewRequest(http.MethodPatch, fmt.Sprintf("/api/admin/users/%d/status", id), strings.NewReader(`{"status":"`+status+`"}`))
		q.Header.Set("Content-Type", "application/json")
		if token != "" {
			q.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, q)
		return w
	}
	if w := patch(member.ID, "disabled", ""); w.Code != 401 {
		t.Fatal(w.Code)
	}
	if w := patch(member.ID, "disabled", mt); w.Code != 403 {
		t.Fatal(w.Code)
	}
	if w := patch(member.ID, "disabled", token); w.Code != 200 {
		t.Fatal(w.Code)
	}
	changed, _ := users.GetByID(member.ID)
	if changed.Status != "disabled" || changed.AuthVersion != 2 {
		t.Fatal(changed)
	}
	if w := patch(member.ID, "disabled", token); w.Code != 200 {
		t.Fatal(w.Code)
	}
	same, _ := users.GetByID(member.ID)
	if same.AuthVersion != 2 {
		t.Fatal(same.AuthVersion)
	}
	if w := patch(member.ID, "active", token); w.Code != 200 {
		t.Fatal(w.Code)
	}
	if w := patch(member.ID, "bad", token); w.Code != 400 {
		t.Fatal(w.Code)
	}
	if w := patch(999, "disabled", token); w.Code != 404 {
		t.Fatal(w.Code)
	}
	if w := patch(admin.ID, "disabled", token); w.Code != 409 {
		t.Fatal(w.Code)
	}
}
func TestAdminUserRoleHTTP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "role.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "x", JWTSecret: "secret", JWTExpireHrs: 1}
	db, _ := repository.InitDB(cfg)
	defer db.Close()
	users := repository.NewUserRepository(db)
	auth := service.NewAuthService(users, cfg)
	r := gin.New()
	g := r.Group("/api/admin")
	g.Use(middleware.AuthMiddleware(auth), middleware.RequireAdmin())
	g.PATCH("/users/:id/role", NewAdminUserHandler(users).UpdateRole)
	id, _ := users.CreateManagedUser("member", "h", "member")
	admin, _ := users.GetByUsername("admin")
	token, _ := auth.GenerateToken(admin)
	q := httptest.NewRequest(http.MethodPatch, fmt.Sprintf("/api/admin/users/%d/role", id), strings.NewReader(`{"role":"admin"}`))
	q.Header.Set("Content-Type", "application/json")
	q.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, q)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	u, _ := users.GetByID(id)
	if u.Role != "admin" || u.AuthVersion != 2 {
		t.Fatal(u)
	}
}
func TestAdminUserRoleAuthorization(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "authrole.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "x", JWTSecret: "secret", JWTExpireHrs: 1}
	db, _ := repository.InitDB(cfg)
	defer db.Close()
	users := repository.NewUserRepository(db)
	auth := service.NewAuthService(users, cfg)
	r := gin.New()
	g := r.Group("/api/admin")
	g.Use(middleware.AuthMiddleware(auth), middleware.RequireAdmin())
	g.PATCH("/users/:id/role", NewAdminUserHandler(users).UpdateRole)
	id, _ := users.CreateManagedUser("member", "h", "member")
	admin, _ := users.GetByUsername("admin")
	at, _ := auth.GenerateToken(admin)
	m, _ := users.GetByID(id)
	mt, _ := auth.GenerateToken(m)
	call := func(tk string) *httptest.ResponseRecorder {
		q := httptest.NewRequest(http.MethodPatch, fmt.Sprintf("/api/admin/users/%d/role", id), strings.NewReader(`{"role":"admin"}`))
		q.Header.Set("Content-Type", "application/json")
		if tk != "" {
			q.Header.Set("Authorization", "Bearer "+tk)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, q)
		return w
	}
	if w := call(""); w.Code != 401 {
		t.Fatal(w.Code)
	}
	if w := call(mt); w.Code != 403 {
		t.Fatal(w.Code)
	}
	if w := call(at); w.Code != 200 {
		t.Fatal(w.Code)
	}
	if w := call(at); w.Code != 200 {
		t.Fatal(w.Code)
	}
}
func TestAdminUserResetPasswordHTTP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "reset.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "x", JWTSecret: "secret", JWTExpireHrs: 1}
	db, _ := repository.InitDB(cfg)
	defer db.Close()
	users := repository.NewUserRepository(db)
	auth := service.NewAuthService(users, cfg)
	r := gin.New()
	g := r.Group("/api/admin")
	g.Use(middleware.AuthMiddleware(auth), middleware.RequireAdmin())
	g.POST("/users/:id/reset-password", NewAdminUserHandler(users).ResetPassword)
	id, _ := users.CreateManagedUser("member", "old", "member")
	admin, _ := users.GetByUsername("admin")
	at, _ := auth.GenerateToken(admin)
	m, _ := users.GetByID(id)
	mt, _ := auth.GenerateToken(m)
	call := func(path, pass, tk string) *httptest.ResponseRecorder {
		q := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"password":"`+pass+`"}`))
		q.Header.Set("Content-Type", "application/json")
		if tk != "" {
			q.Header.Set("Authorization", "Bearer "+tk)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, q)
		return w
	}
	if w := call(fmt.Sprintf("/api/admin/users/%d/reset-password", id), "123456789012", ""); w.Code != 401 {
		t.Fatal(w.Code)
	}
	if w := call(fmt.Sprintf("/api/admin/users/%d/reset-password", id), "123456789012", mt); w.Code != 403 {
		t.Fatal(w.Code)
	}
	if w := call(fmt.Sprintf("/api/admin/users/%d/reset-password", id), "123456789012", at); w.Code != 200 {
		t.Fatal(w.Code)
	}
	u, _ := users.GetByID(id)
	if !utils.CheckPasswordHash("123456789012", u.PasswordHash) || u.Role != "member" || u.Status != "active" {
		t.Fatal(u)
	}
	if w := call("/api/admin/users/999/reset-password", "123456789012", at); w.Code != 404 {
		t.Fatal(w.Code)
	}
	if w := call("/api/admin/users/x/reset-password", "123456789012", at); w.Code != 400 {
		t.Fatal(w.Code)
	}
}

var _ = model.User{}

func TestAdminUserMutationSecurityRegressions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "security.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "x", JWTSecret: "secret", JWTExpireHrs: 1}
	db, err := repository.InitDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	users := repository.NewUserRepository(db)
	auth := service.NewAuthService(users, cfg)
	h := NewAdminUserHandler(users)
	r := gin.New()
	protected := r.Group("/api/auth")
	protected.Use(middleware.AuthMiddleware(auth))
	protected.GET("/me", NewMemberAuthHandler(auth).Me)
	adminRoutes := r.Group("/api/admin")
	adminRoutes.Use(middleware.AuthMiddleware(auth), middleware.RequireAdmin())
	adminRoutes.GET("/users", h.List)
	adminRoutes.PATCH("/users/:id/status", h.UpdateStatus)
	adminRoutes.PATCH("/users/:id/role", h.UpdateRole)
	adminRoutes.POST("/users/:id/reset-password", h.ResetPassword)

	request := func(method, path, body, token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}
	tokenFor := func(id int64) string {
		u, getErr := users.GetByID(id)
		if getErr != nil {
			t.Fatal(getErr)
		}
		token, tokenErr := auth.GenerateToken(u)
		if tokenErr != nil {
			t.Fatal(tokenErr)
		}
		return token
	}
	admin, _ := users.GetByUsername("admin")
	adminToken := tokenFor(admin.ID)

	memberHash, _ := utils.HashPassword("old-member-password")
	memberID, _ := users.CreateManagedUser("security-member", memberHash, "member")
	memberToken := tokenFor(memberID)
	if w := request(http.MethodPatch, fmt.Sprintf("/api/admin/users/%d/status", memberID), `{"status":"disabled"}`, adminToken); w.Code != http.StatusOK {
		t.Fatalf("disable member: %d %s", w.Code, w.Body.String())
	}
	if w := request(http.MethodGet, "/api/auth/me", "", memberToken); w.Code != http.StatusUnauthorized {
		t.Fatalf("disabled user's old token: got %d", w.Code)
	}
	if w := request(http.MethodPatch, fmt.Sprintf("/api/admin/users/%d/status", memberID), `{"status":"active"}`, adminToken); w.Code != http.StatusOK {
		t.Fatalf("reactivate member: %d %s", w.Code, w.Body.String())
	}
	memberToken = tokenFor(memberID)
	if w := request(http.MethodPatch, fmt.Sprintf("/api/admin/users/%d/role", memberID), `{"role":"admin"}`, adminToken); w.Code != http.StatusOK {
		t.Fatalf("promote member: %d %s", w.Code, w.Body.String())
	}
	if w := request(http.MethodGet, "/api/auth/me", "", memberToken); w.Code != http.StatusUnauthorized {
		t.Fatalf("role-change stale token: got %d", w.Code)
	}
	promotedToken := tokenFor(memberID)
	if w := request(http.MethodPatch, fmt.Sprintf("/api/admin/users/%d/role", memberID), `{"role":"member"}`, adminToken); w.Code != http.StatusOK {
		t.Fatalf("safe multi-admin downgrade: %d %s", w.Code, w.Body.String())
	}
	if w := request(http.MethodGet, "/api/admin/users", "", promotedToken); w.Code != http.StatusUnauthorized {
		t.Fatalf("downgraded admin stale token: got %d", w.Code)
	}
	if w := request(http.MethodPatch, fmt.Sprintf("/api/admin/users/%d/status", admin.ID), `{"status":"disabled"}`, adminToken); w.Code != http.StatusConflict {
		t.Fatalf("self disable: got %d", w.Code)
	}
	if w := request(http.MethodPatch, fmt.Sprintf("/api/admin/users/%d/role", admin.ID), `{"role":"member"}`, adminToken); w.Code != http.StatusConflict {
		t.Fatalf("self downgrade: got %d", w.Code)
	}

	secondAdminID, _ := users.CreateManagedUser("second-admin", "hash", "admin")
	if w := request(http.MethodPatch, fmt.Sprintf("/api/admin/users/%d/status", secondAdminID), `{"status":"disabled"}`, adminToken); w.Code != http.StatusOK {
		t.Fatalf("safe multi-admin disable: %d %s", w.Code, w.Body.String())
	}
	if w := request(http.MethodPatch, fmt.Sprintf("/api/admin/users/%d/status", admin.ID), `{"status":"disabled"}`, tokenFor(admin.ID)); w.Code != http.StatusConflict {
		t.Fatalf("last active admin disable: got %d", w.Code)
	}
	if w := request(http.MethodPatch, fmt.Sprintf("/api/admin/users/%d/role", secondAdminID), `{"role":"member"}`, adminToken); w.Code != http.StatusOK {
		t.Fatalf("disabled admin downgrade: %d %s", w.Code, w.Body.String())
	}
	if w := request(http.MethodPatch, fmt.Sprintf("/api/admin/users/%d/role", admin.ID), `{"role":"member"}`, tokenFor(admin.ID)); w.Code != http.StatusConflict {
		t.Fatalf("last active admin downgrade: got %d", w.Code)
	}

	resetHash, _ := utils.HashPassword("old-reset-password")
	resetID, _ := users.CreateManagedUser("reset-member", resetHash, "member")
	resetToken := tokenFor(resetID)
	w := request(http.MethodPost, fmt.Sprintf("/api/admin/users/%d/reset-password", resetID), `{"password":"new-reset-password"}`, adminToken)
	if w.Code != http.StatusOK {
		t.Fatalf("reset password: %d %s", w.Code, w.Body.String())
	}
	var responseBody map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &responseBody); err != nil {
		t.Fatal(err)
	}
	data, ok := responseBody["data"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected response: %#v", responseBody)
	}
	for _, forbidden := range []string{"password", "password_hash", "auth_version", "token", "access_token", "invite", "invite_code", "code_hash"} {
		if _, exists := data[forbidden]; exists {
			t.Fatalf("unsafe response field %q", forbidden)
		}
	}
	if w := request(http.MethodGet, "/api/auth/me", "", resetToken); w.Code != http.StatusUnauthorized {
		t.Fatalf("password-reset stale token: got %d", w.Code)
	}
	resetUser, _ := users.GetByID(resetID)
	if !utils.CheckPasswordHash("new-reset-password", resetUser.PasswordHash) || utils.CheckPasswordHash("old-reset-password", resetUser.PasswordHash) {
		t.Fatal("password transition was not persisted with bcrypt")
	}
}
