package handler

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/internal/service"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRegistrationHandlerRegistersPublicMemberWithoutSecrets(t *testing.T) {
	router, db, invites, users := newRegistrationRouter(t)
	defer db.Close()
	if _, err := invites.Create(handlerInviteHash("valid"), 1, 1, nil); err != nil {
		t.Fatal(err)
	}
	response := postRegistration(router, `{"username":"alice","password":"123456789012","invite_code":"valid","role":"admin","status":"disabled","auth_version":999}`)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", response.Code, response.Body.String())
	}
	stored, err := users.GetByUsername("alice")
	if err != nil || stored == nil || stored.Role != "member" || stored.Status != "active" || stored.AuthVersion != 1 {
		t.Fatalf("stored member = %+v, err=%v", stored, err)
	}
	body := response.Body.String()
	for _, secret := range []string{"123456789012", "password_hash", "invite_code", "code_hash", "token", "auth_version"} {
		if strings.Contains(body, secret) {
			t.Fatalf("registration response leaked %q: %s", secret, body)
		}
	}
}

func TestRegistrationHandlerRejectsInvalidRequests(t *testing.T) {
	cases := []struct {
		name string
		body string
	}{
		{name: "missing username", body: `{"password":"123456789012","invite_code":"valid"}`},
		{name: "missing password", body: `{"username":"alice","invite_code":"valid"}`},
		{name: "missing invite", body: `{"username":"alice","password":"123456789012"}`},
		{name: "invalid json", body: `{`},
		{name: "short username", body: `{"username":"ab","password":"123456789012","invite_code":"valid"}`},
		{name: "long username", body: `{"username":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","password":"123456789012","invite_code":"valid"}`},
		{name: "weak password", body: `{"username":"alice","password":"short","invite_code":"valid"}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			router, db, _, _ := newRegistrationRouter(t)
			defer db.Close()
			response := postRegistration(router, tc.body)
			if response.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, body=%s", response.Code, response.Body.String())
			}
		})
	}
}

func TestRegistrationHandlerMapsInviteAndConflictErrors(t *testing.T) {
	router, db, invites, users := newRegistrationRouter(t)
	defer db.Close()
	expiry := time.Now().Add(-time.Hour)
	if _, err := invites.Create(handlerInviteHash("disabled"), 1, 1, nil); err != nil {
		t.Fatal(err)
	}
	disabled, err := invites.GetByHash(handlerInviteHash("disabled"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err = invites.UpdateStatus(disabled.ID, "disabled"); err != nil {
		t.Fatal(err)
	}
	if _, err = invites.Create(handlerInviteHash("expired"), 1, 1, &expiry); err != nil {
		t.Fatal(err)
	}
	if _, err = invites.Create(handlerInviteHash("exhausted"), 1, 1, nil); err != nil {
		t.Fatal(err)
	}
	if ok, err := invites.ConsumeByHash(handlerInviteHash("exhausted")); err != nil || !ok {
		t.Fatal(err)
	}

	for _, code := range []string{"unknown", "disabled", "expired", "exhausted"} {
		t.Run(code, func(t *testing.T) {
			response := postRegistration(router, `{"username":"member-`+code+`","password":"123456789012","invite_code":"`+code+`"}`)
			if response.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, body=%s", response.Code, response.Body.String())
			}
			member, err := users.GetByUsername("member-" + code)
			if err != nil || member != nil {
				t.Fatalf("failed registration created member=%+v err=%v", member, err)
			}
		})
	}

	if _, err = invites.Create(handlerInviteHash("first"), 1, 1, nil); err != nil {
		t.Fatal(err)
	}
	if response := postRegistration(router, `{"username":"alice","password":"123456789012","invite_code":"first"}`); response.Code != http.StatusOK {
		t.Fatal(response.Body.String())
	}
	if _, err = invites.Create(handlerInviteHash("conflict"), 1, 1, nil); err != nil {
		t.Fatal(err)
	}
	response := postRegistration(router, `{"username":"alice","password":"123456789012","invite_code":"conflict"}`)
	if response.Code != http.StatusConflict {
		t.Fatalf("status = %d, body=%s", response.Code, response.Body.String())
	}
	conflict, err := invites.GetByHash(handlerInviteHash("conflict"))
	if err != nil || conflict.UsedCount != 0 {
		t.Fatalf("conflict consumed invite=%+v err=%v", conflict, err)
	}
}

func TestRegistrationHandlerSingleUseInvite(t *testing.T) {
	router, db, invites, users := newRegistrationRouter(t)
	defer db.Close()
	if _, err := invites.Create(handlerInviteHash("single"), 1, 1, nil); err != nil {
		t.Fatal(err)
	}
	if response := postRegistration(router, `{"username":"alice","password":"123456789012","invite_code":"single"}`); response.Code != http.StatusOK {
		t.Fatal(response.Body.String())
	}
	response := postRegistration(router, `{"username":"bob","password":"123456789012","invite_code":"single"}`)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body=%s", response.Code, response.Body.String())
	}
	bob, err := users.GetByUsername("bob")
	if err != nil || bob != nil {
		t.Fatalf("exhausted invite created bob=%+v err=%v", bob, err)
	}
	invite, err := invites.GetByHash(handlerInviteHash("single"))
	if err != nil || invite.UsedCount != 1 {
		t.Fatalf("single invite count=%d err=%v", invite.UsedCount, err)
	}
}

func newRegistrationRouter(t *testing.T) (*gin.Engine, *repository.DB, *repository.InviteRepository, *repository.UserRepository) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "app.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "test"}
	db, err := repository.InitDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	invites := repository.NewInviteRepository(db)
	users := repository.NewUserRepository(db)
	router := gin.New()
	router.POST("/api/auth/register", NewRegistrationHandler(service.NewRegistrationService(users, invites)).Register)
	return router, db, invites, users
}

func postRegistration(router *gin.Engine, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func handlerInviteHash(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}
