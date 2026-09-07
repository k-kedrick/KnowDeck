package service

import (
	"path/filepath"
	"testing"

	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/pkg/utils"
)

func newTestDB(t *testing.T) *repository.DB {
	t.Helper()
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "app.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "test"}
	db, err := repository.InitDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	return db
}

func TestAdminUserServiceCreateUser(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	s := NewAdminUserService(repository.NewUserRepository(db))
	u, e := s.CreateUser(" alice ", "123456789012", "member")
	if e != nil || u.Username != "alice" || u.Status != "active" {
		t.Fatal(e, u)
	}
	stored, _ := repository.NewUserRepository(db).GetByUsername("alice")
	if stored.Role != "member" || stored.AuthVersion != 1 || !utils.CheckPasswordHash("123456789012", stored.PasswordHash) {
		t.Fatal("bad stored")
	}
	a, e := s.CreateUser("ops", "123456789012", "admin")
	if e != nil || a.Role != "admin" {
		t.Fatal(e, a)
	}
	if _, e = s.CreateUser("alice", "123456789012", ""); e != ErrUsernameExists {
		t.Fatal(e)
	}
	for _, r := range []string{"root", "owner"} {
		if _, e = s.CreateUser("bad"+r, "123456789012", r); e != ErrInvalidRole {
			t.Fatal(e)
		}
	}
}
func TestAdminUserServiceUpdateRole(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	r := repository.NewUserRepository(db)
	s := NewAdminUserService(r)
	id, _ := r.CreateManagedUser("member", "h", "member")
	if err := s.UpdateRole(1, id, "admin"); err != nil {
		t.Fatal(err)
	}
	u, _ := r.GetByID(id)
	if u.Role != "admin" || u.AuthVersion != 2 {
		t.Fatal(u)
	}
	if err := s.UpdateRole(id, id, "member"); err != ErrCannotChangeOwnRole {
		t.Fatal(err)
	}
	if err := s.UpdateRole(1, 999, "member"); err != repository.ErrUserNotFound {
		t.Fatal(err)
	}
	if err := s.UpdateRole(1, id, "root"); err != ErrInvalidRole {
		t.Fatal(err)
	}
}
func TestAdminUserServiceResetPassword(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	r := repository.NewUserRepository(db)
	s := NewAdminUserService(r)
	id, _ := r.CreateManagedUser("reset", "old", "member")
	if err := s.ResetPassword(id, " 1234567890 "); err != nil {
		t.Fatal(err)
	}
	u, _ := r.GetByID(id)
	if !utils.CheckPasswordHash(" 1234567890 ", u.PasswordHash) || u.AuthVersion != 2 {
		t.Fatal(u)
	}
	if err := s.ResetPassword(id, "short"); err != ErrWeakPassword {
		t.Fatal(err)
	}
}
