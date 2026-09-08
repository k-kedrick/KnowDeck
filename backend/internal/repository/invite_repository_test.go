package repository

import (
	"errors"
	"fmt"
	"knowledge-base/backend/internal/config"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestInviteSchemaDefaults(t *testing.T) {
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "app.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "test"}
	db, err := InitDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var role, status string
	var version int
	if err := db.QueryRow("SELECT role,status,auth_version FROM users WHERE username='admin'").Scan(&role, &status, &version); err != nil {
		t.Fatal(err)
	}
	if role != "admin" || status != "active" || version < 1 {
		t.Fatal("bad admin")
	}
	if _, err = db.Exec("INSERT INTO invite_codes (code_hash,created_by) VALUES ('a',1)"); err != nil {
		t.Fatal(err)
	}
	var state string
	var max, used int
	if err = db.QueryRow("SELECT status,max_uses,used_count FROM invite_codes WHERE code_hash='a'").Scan(&state, &max, &used); err != nil {
		t.Fatal(err)
	}
	if state != "active" || max != 1 || used != 0 {
		t.Fatal("bad defaults")
	}
	if _, err = db.Exec("INSERT INTO invite_codes (code_hash,created_by) VALUES ('a',1)"); err == nil {
		t.Fatal("hash must be unique")
	}
}

func TestConsumeByHashAtomic(t *testing.T) {
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "consume.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "test"}
	db, err := InitDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	repo := NewInviteRepository(db)
	if _, err = repo.Create("consume", "consume", 1, "", 1, nil); err != nil {
		t.Fatal(err)
	}
	ok, err := repo.ConsumeByHash("consume")
	if err != nil || !ok {
		t.Fatal(err)
	}
	ok, err = repo.ConsumeByHash("consume")
	if err != nil || ok {
		t.Fatal("over-consumed")
	}
	var used int
	if err = db.QueryRow("SELECT used_count FROM invite_codes WHERE code_hash='consume'").Scan(&used); err != nil || used != 1 {
		t.Fatal("invalid use count")
	}
}

func TestCreateMemberWithInvite(t *testing.T) {
	db := newInviteTestDB(t)
	defer db.Close()
	invites := NewInviteRepository(db)
	users := NewUserRepository(db)
	if _, err := invites.Create("valid", "valid", 1, "", 1, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := users.CreateMemberWithInvite("member-one", "$2a$test-hash-placeholder", "valid"); err != nil {
		t.Fatal(err)
	}
	member, err := users.GetByUsername("member-one")
	if err != nil || member == nil {
		t.Fatalf("member lookup: member=%+v err=%v", member, err)
	}
	if member.PasswordHash != "$2a$test-hash-placeholder" || member.Role != "member" || member.Status != "active" || member.AuthVersion != 1 {
		t.Fatalf("unexpected member: %+v", member)
	}
	invite, err := invites.GetByHash("valid")
	if err != nil || invite.UsedCount != 1 {
		t.Fatalf("invite consumption: invite=%+v err=%v", invite, err)
	}
}

func TestCreateMemberWithInviteRollsBackUsernameConflict(t *testing.T) {
	db := newInviteTestDB(t)
	defer db.Close()
	invites := NewInviteRepository(db)
	users := NewUserRepository(db)
	if _, err := invites.Create("conflict", "conflict", 1, "", 1, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec("INSERT INTO users (username, password_hash, nickname) VALUES ('alice', 'existing-hash', 'alice')"); err != nil {
		t.Fatal(err)
	}
	if _, err := users.CreateMemberWithInvite("alice", "new-hash", "conflict"); err == nil {
		t.Fatal("expected unique username conflict")
	}
	invite, err := invites.GetByHash("conflict")
	if err != nil || invite.UsedCount != 0 {
		t.Fatalf("username conflict consumed invite: invite=%+v err=%v", invite, err)
	}
}

func TestCreateMemberWithInviteRejectsUnavailableInvites(t *testing.T) {
	db := newInviteTestDB(t)
	defer db.Close()
	invites := NewInviteRepository(db)
	users := NewUserRepository(db)
	expired := time.Now().Add(-time.Hour)
	cases := []struct {
		hash          string
		setup         func() error
		wantUsedCount int
	}{
		{hash: "unknown", setup: func() error { return nil }, wantUsedCount: -1},
		{hash: "disabled", setup: func() error {
			id, err := invites.Create("disabled", "disabled", 1, "", 1, nil)
			if err != nil {
				return err
			}
			_, err = invites.UpdateStatus(id, "disabled")
			return err
		}, wantUsedCount: 0},
		{hash: "expired", setup: func() error { _, err := invites.Create("expired", "expired", 1, "", 1, &expired); return err }, wantUsedCount: 0},
		{hash: "exhausted", setup: func() error {
			if _, err := invites.Create("exhausted", "exhausted", 1, "", 1, nil); err != nil {
				return err
			}
			_, err := invites.ConsumeByHash("exhausted")
			return err
		}, wantUsedCount: 1},
	}
	for _, tc := range cases {
		t.Run(tc.hash, func(t *testing.T) {
			if err := tc.setup(); err != nil {
				t.Fatal(err)
			}
			username := "member-" + tc.hash
			if _, err := users.CreateMemberWithInvite(username, "test-hash", tc.hash); !errors.Is(err, ErrInviteNotConsumable) {
				t.Fatalf("error = %v, want invite not consumable", err)
			}
			member, err := users.GetByUsername(username)
			if err != nil || member != nil {
				t.Fatalf("unavailable invite created member: member=%+v err=%v", member, err)
			}
			if tc.wantUsedCount >= 0 {
				invite, err := invites.GetByHash(tc.hash)
				if err != nil || invite.UsedCount != tc.wantUsedCount {
					t.Fatalf("used_count = %d, err=%v, want %d", invite.UsedCount, err, tc.wantUsedCount)
				}
			}
		})
	}
}

func TestCreateMemberWithInviteMaxUsesAndConcurrency(t *testing.T) {
	db := newInviteTestDB(t)
	defer db.Close()
	invites := NewInviteRepository(db)
	users := NewUserRepository(db)
	if _, err := invites.Create("single-use", "single-use", 1, "", 1, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := users.CreateMemberWithInvite("first", "hash", "single-use"); err != nil {
		t.Fatal(err)
	}
	if _, err := users.CreateMemberWithInvite("second", "hash", "single-use"); !errors.Is(err, ErrInviteNotConsumable) {
		t.Fatalf("second registration error = %v", err)
	}

	if _, err := invites.Create("concurrent", "concurrent", 1, "", 1, nil); err != nil {
		t.Fatal(err)
	}
	const attempts = 20
	start := make(chan struct{})
	var wg sync.WaitGroup
	var successes atomic.Int32
	for i := range attempts {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			if _, err := users.CreateMemberWithInvite(fmt.Sprintf("concurrent-%d", i), "hash", "concurrent"); err == nil {
				successes.Add(1)
			}
		}(i)
	}
	close(start)
	wg.Wait()
	if successes.Load() != 1 {
		t.Fatalf("successful registrations = %d, want 1", successes.Load())
	}
	invite, err := invites.GetByHash("concurrent")
	if err != nil || invite.UsedCount != 1 {
		t.Fatalf("concurrent invite count = %d, err=%v", invite.UsedCount, err)
	}
	var memberCount int
	if err := db.QueryRow("SELECT COUNT(*) FROM users WHERE username LIKE 'concurrent-%'").Scan(&memberCount); err != nil || memberCount != 1 {
		t.Fatalf("concurrent member count = %d, err=%v", memberCount, err)
	}
}

func newInviteTestDB(t *testing.T) *DB {
	t.Helper()
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "app.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "test"}
	db, err := InitDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	return db
}
