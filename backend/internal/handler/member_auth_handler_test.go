package handler

import (
	"bytes"
	"encoding/json"
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

	"github.com/gin-gonic/gin"
)

func TestMemberLoginSuccessAndAdminAuthorization(t *testing.T) {
	router, db, auth, users := newMemberAuthRouter(t)
	defer db.Close()
	passwordHash, err := utils.HashPassword("123456789012")
	if err != nil {
		t.Fatal(err)
	}
	result, err := db.Exec("INSERT INTO users (username, password_hash, nickname, role, status, auth_version) VALUES (?, ?, ?, 'member', 'active', 3)", "alice", passwordHash, "alice")
	if err != nil {
		t.Fatal(err)
	}
	id, _ := result.LastInsertId()
	response := postMemberLogin(router, `{"username":" alice ","password":"123456789012"}`)
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	body := response.Body.String()
	for _, value := range []string{"password_hash", "123456789012", "auth_version", "invite_code"} {
		if strings.Contains(body, value) {
			t.Fatalf("response leaked %q: %s", value, body)
		}
	}
	var decoded struct {
		Data struct {
			Token string `json:"token"`
			User  struct {
				ID     int64  `json:"id"`
				Role   string `json:"role"`
				Status string `json:"status"`
			} `json:"user"`
		} `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Data.Token == "" || decoded.Data.User.ID != id || decoded.Data.User.Role != "member" || decoded.Data.User.Status != "active" {
		t.Fatalf("unexpected response: %s", body)
	}
	claims, err := auth.ParseToken(decoded.Data.Token)
	if err != nil || claims.UserID != id || claims.Role != "member" || claims.AuthVersion != 3 || claims.Issuer != "feishu-kb" {
		t.Fatalf("claims=%+v err=%v", claims, err)
	}
	adminRequest := httptest.NewRequest(http.MethodGet, "/api/admin/invites", nil)
	adminRequest.Header.Set("Authorization", "Bearer "+decoded.Data.Token)
	adminResponse := httptest.NewRecorder()
	router.ServeHTTP(adminResponse, adminRequest)
	if adminResponse.Code != http.StatusForbidden {
		t.Fatalf("member admin status=%d", adminResponse.Code)
	}
	if user, err := users.GetByUsername("alice"); err != nil || user.PasswordHash == "123456789012" {
		t.Fatalf("stored password invalid: user=%+v err=%v", user, err)
	}
}

func TestMemberLoginRejectsInvalidCredentialsAndDisabledAccount(t *testing.T) {
	router, db, _, _ := newMemberAuthRouter(t)
	defer db.Close()
	passwordHash, err := utils.HashPassword("123456789012")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec("INSERT INTO users (username, password_hash, nickname, role, status) VALUES ('alice', ?, 'alice', 'member', 'active')", passwordHash); err != nil {
		t.Fatal(err)
	}
	for _, body := range []string{`{"username":"alice","password":"wrong-password"}`, `{"username":"unknown","password":"123456789012"}`} {
		response := postMemberLogin(router, body)
		if response.Code != http.StatusUnauthorized || strings.Contains(response.Body.String(), "token") {
			t.Fatalf("invalid credentials response: %d %s", response.Code, response.Body.String())
		}
	}
	if _, err = db.Exec("UPDATE users SET status = 'disabled' WHERE username = 'alice'"); err != nil {
		t.Fatal(err)
	}
	response := postMemberLogin(router, `{"username":"alice","password":"123456789012"}`)
	if response.Code != http.StatusForbidden || strings.Contains(response.Body.String(), "token") {
		t.Fatalf("disabled response: %d %s", response.Code, response.Body.String())
	}
	if response = postMemberLogin(router, `{`); response.Code != http.StatusBadRequest {
		t.Fatalf("invalid JSON status=%d", response.Code)
	}
}

func TestAdminLoginAndGuestAdminAccessRemainProtected(t *testing.T) {
	router, db, _, _ := newMemberAuthRouter(t)
	defer db.Close()
	response := postJSON(router, "/api/admin/auth/login", `{"username":"admin","password":"test-admin-password"}`)
	if response.Code != http.StatusOK {
		t.Fatalf("admin login status=%d body=%s", response.Code, response.Body.String())
	}
	guest := httptest.NewRecorder()
	router.ServeHTTP(guest, httptest.NewRequest(http.MethodGet, "/api/admin/invites", nil))
	if guest.Code != http.StatusUnauthorized {
		t.Fatalf("guest admin status=%d", guest.Code)
	}
}

func TestMemberMeEnforcesCurrentDatabaseState(t *testing.T) {
	router, db, auth, _ := newMemberAuthRouter(t)
	defer db.Close()
	hash, err := utils.HashPassword("123456789012")
	if err != nil {
		t.Fatal(err)
	}
	result, err := db.Exec("INSERT INTO users (username, password_hash, nickname, role, status, auth_version) VALUES ('alice', ?, 'alice', 'member', 'active', 3)", hash)
	if err != nil {
		t.Fatal(err)
	}
	id, _ := result.LastInsertId()
	token, err := auth.GenerateToken(&model.User{ID: id, Username: "alice", Role: "member", Status: "active", AuthVersion: 3})
	if err != nil {
		t.Fatal(err)
	}
	if response := getWithToken(router, token); response.Code != http.StatusOK || strings.Contains(response.Body.String(), "auth_version") || strings.Contains(response.Body.String(), "password") {
		t.Fatalf("me response=%d %s", response.Code, response.Body.String())
	}
	if _, err := db.Exec("UPDATE users SET auth_version = 4 WHERE id = ?", id); err != nil {
		t.Fatal(err)
	}
	if response := getWithToken(router, token); response.Code != http.StatusUnauthorized {
		t.Fatalf("version status=%d", response.Code)
	}
	if _, err := db.Exec("UPDATE users SET auth_version = 3, status = 'disabled' WHERE id = ?", id); err != nil {
		t.Fatal(err)
	}
	if response := getWithToken(router, token); response.Code != http.StatusUnauthorized {
		t.Fatalf("disabled status=%d", response.Code)
	}
	if response := getWithToken(router, "abc"); response.Code != http.StatusUnauthorized {
		t.Fatalf("malformed status=%d", response.Code)
	}
	if response := getWithToken(router, ""); response.Code != http.StatusUnauthorized {
		t.Fatalf("visitor status=%d", response.Code)
	}
}

func newMemberAuthRouter(t *testing.T) (*gin.Engine, *repository.DB, *service.AuthService, *repository.UserRepository) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "app.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "test", JWTSecret: "test-secret", JWTExpireHrs: 1}
	db, err := repository.InitDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	users := repository.NewUserRepository(db)
	auth := service.NewAuthService(users, cfg)
	router := gin.New()
	memberHandler := NewMemberAuthHandler(auth)
	router.POST("/api/auth/login", memberHandler.Login)
	router.GET("/api/auth/me", middleware.AuthMiddleware(auth), memberHandler.Me)
	router.POST("/api/admin/auth/login", NewAdminAuthHandler(auth).Login)
	admin := router.Group("/api/admin")
	admin.Use(middleware.AuthMiddleware(auth), middleware.RequireAdmin())
	admin.GET("/invites", func(c *gin.Context) { c.Status(http.StatusOK) })
	return router, db, auth, users
}

func postMemberLogin(router *gin.Engine, body string) *httptest.ResponseRecorder {
	return postJSON(router, "/api/auth/login", body)
}
func getWithToken(router *gin.Engine, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}
func postJSON(router *gin.Engine, path, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}
