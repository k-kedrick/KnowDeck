package service

import (
	"errors"
	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/pkg/utils"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRegistrationServiceRegister(t *testing.T) {
	svc, db, invites, users := newRegistrationService(t)
	defer db.Close()
	if _, err := invites.Create(hashInviteCode("valid-code"), 1, 1, nil); err != nil {
		t.Fatal(err)
	}
	member, err := svc.Register("  alice  ", "twelve-chars", "  valid-code  ")
	if err != nil {
		t.Fatal(err)
	}
	if member.Username != "alice" || member.Role != "member" || member.Status != "active" || member.AuthVersion != 1 || member.PasswordHash != "" {
		t.Fatalf("unexpected registration result: %+v", member)
	}
	stored, err := users.GetByUsername("alice")
	if err != nil || stored == nil {
		t.Fatalf("member lookup: member=%+v err=%v", stored, err)
	}
	if stored.PasswordHash == "twelve-chars" || !utils.CheckPasswordHash("twelve-chars", stored.PasswordHash) {
		t.Fatal("password was not stored as a valid bcrypt hash")
	}
	invite, err := invites.GetByHash(hashInviteCode("valid-code"))
	if err != nil || invite.UsedCount != 1 {
		t.Fatalf("invite consumption: invite=%+v err=%v", invite, err)
	}
}

func TestRegistrationServiceValidatesUsernameAndPassword(t *testing.T) {
	cases := []struct {
		name     string
		username string
		password string
		want     error
	}{
		{name: "empty username", username: "", password: "twelve-chars", want: ErrInvalidUsername},
		{name: "space username", username: "   ", password: "twelve-chars", want: ErrInvalidUsername},
		{name: "short username", username: "ab", password: "twelve-chars", want: ErrInvalidUsername},
		{name: "long username", username: strings.Repeat("a", 33), password: "twelve-chars", want: ErrInvalidUsername},
		{name: "weak password", username: "alice", password: "short", want: ErrWeakPassword},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc, db, _, _ := newRegistrationService(t)
			defer db.Close()
			if _, err := svc.Register(tc.username, tc.password, "any-invite"); !errors.Is(err, tc.want) {
				t.Fatalf("Register error = %v, want %v", err, tc.want)
			}
		})
	}
	svc, db, _, _ := newRegistrationService(t)
	defer db.Close()
	if _, err := svc.Register("alice", "twelve-chars", "  "); !errors.Is(err, ErrInvalidInviteCode) {
		t.Fatalf("blank invite error = %v, want invalid invite", err)
	}

	svc, db, invites, users := newRegistrationService(t)
	defer db.Close()
	if _, err := invites.Create(hashInviteCode("long-password"), 1, 1, nil); err != nil {
		t.Fatal(err)
	}
	password := strings.Repeat("p", 64)
	if _, err := svc.Register("long-password-user", password, "long-password"); err != nil {
		t.Fatal(err)
	}
	stored, err := users.GetByUsername("long-password-user")
	if err != nil || !utils.CheckPasswordHash(password, stored.PasswordHash) {
		t.Fatalf("long password verification failed: err=%v", err)
	}
}

func TestRegistrationServiceMapsInviteErrors(t *testing.T) {
	svc, db, invites, users := newRegistrationService(t)
	defer db.Close()
	expiry := time.Now().Add(-time.Hour)
	if _, err := invites.Create(hashInviteCode("disabled"), 1, 1, nil); err != nil {
		t.Fatal(err)
	}
	disabled, err := invites.GetByHash(hashInviteCode("disabled"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err = invites.UpdateStatus(disabled.ID, "disabled"); err != nil {
		t.Fatal(err)
	}
	if _, err = invites.Create(hashInviteCode("expired"), 1, 1, &expiry); err != nil {
		t.Fatal(err)
	}
	if _, err = invites.Create(hashInviteCode("exhausted"), 1, 1, nil); err != nil {
		t.Fatal(err)
	}
	if consumed, err := invites.ConsumeByHash(hashInviteCode("exhausted")); err != nil || !consumed {
		t.Fatal(err)
	}
	cases := []struct {
		code string
		want error
	}{
		{code: "unknown", want: ErrInvalidInviteCode},
		{code: "disabled", want: ErrInviteCodeDisabled},
		{code: "expired", want: ErrInviteCodeExpired},
		{code: "exhausted", want: ErrInviteCodeExhausted},
	}
	for _, tc := range cases {
		t.Run(tc.code, func(t *testing.T) {
			username := "member-" + tc.code
			if _, err := svc.Register(username, "twelve-chars", tc.code); !errors.Is(err, tc.want) {
				t.Fatalf("Register error = %v, want %v", err, tc.want)
			}
			member, err := users.GetByUsername(username)
			if err != nil || member != nil {
				t.Fatalf("unavailable invite created member: member=%+v err=%v", member, err)
			}
		})
	}
}

func TestRegistrationServiceUsernameConflictAndSingleUse(t *testing.T) {
	svc, db, invites, users := newRegistrationService(t)
	defer db.Close()
	if _, err := invites.Create(hashInviteCode("first"), 1, 1, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Register("alice", "twelve-chars", "first"); err != nil {
		t.Fatal(err)
	}
	if _, err := invites.Create(hashInviteCode("conflict"), 1, 1, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Register("alice", "twelve-chars", "conflict"); !errors.Is(err, ErrUsernameExists) {
		t.Fatalf("username conflict error = %v", err)
	}
	conflictInvite, err := invites.GetByHash(hashInviteCode("conflict"))
	if err != nil || conflictInvite.UsedCount != 0 {
		t.Fatalf("username conflict consumed invite: invite=%+v err=%v", conflictInvite, err)
	}
	if _, err := svc.Register("bob", "twelve-chars", "first"); !errors.Is(err, ErrInviteCodeExhausted) {
		t.Fatalf("single-use error = %v", err)
	}
	bob, err := users.GetByUsername("bob")
	if err != nil || bob != nil {
		t.Fatalf("exhausted invite created bob: member=%+v err=%v", bob, err)
	}
}

func newRegistrationService(t *testing.T) (*RegistrationService, *repository.DB, *repository.InviteRepository, *repository.UserRepository) {
	t.Helper()
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "app.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "test"}
	db, err := repository.InitDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	invites := repository.NewInviteRepository(db)
	users := repository.NewUserRepository(db)
	return NewRegistrationService(users, invites), db, invites, users
}
