package service

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/repository"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestInviteGenerate(t *testing.T) {
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "x.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "x"}
	db, e := repository.InitDB(cfg)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	svc := NewInviteService(repository.NewInviteRepository(db))
	expiry := time.Now().Add(time.Hour)
	code, _, e := svc.Generate(1, 5, &expiry)
	if e != nil || code == "" {
		t.Fatal(e)
	}
	h := sha256.Sum256([]byte(code))
	v, e := repository.NewInviteRepository(db).GetByHash(hex.EncodeToString(h[:]))
	if e != nil || v.CodeHash == code || v.MaxUses == nil || *v.MaxUses != 5 || v.Status != "active" {
		t.Fatal("bad persistence")
	}
	if _, _, e = svc.Generate(1, 1001, nil); e == nil {
		t.Fatal("expected validation")
	}
}

func TestInviteConsumeBoundaries(t *testing.T) {
	cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "consume.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "test"}
	db, err := repository.InitDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	repo := repository.NewInviteRepository(db)
	svc := NewInviteService(repo)

	code, _, err := svc.Generate(1, 1, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err = svc.Consume("  " + code + "  "); err != nil {
		t.Fatalf("trimmed code: %v", err)
	}
	generated, err := repo.GetByHash(inviteHash(code))
	if err != nil {
		t.Fatal(err)
	}
	if generated.UsedCount != 1 {
		t.Fatalf("used_count = %d, want 1", generated.UsedCount)
	}
	if err = svc.Consume(code); !errors.Is(err, ErrInviteCodeExhausted) {
		t.Fatalf("second consume error = %v, want exhausted", err)
	}
	if err = svc.Consume("  "); !errors.Is(err, ErrInvalidInviteCode) {
		t.Fatalf("blank code error = %v, want invalid", err)
	}
	if err = svc.Consume("not-an-invite"); !errors.Is(err, ErrInvalidInviteCode) {
		t.Fatalf("unknown code error = %v, want invalid", err)
	}

	disabledCode := "disabled-invite"
	if _, err = repo.Create(disabledCode, inviteHash(disabledCode), 1, "", 5, nil); err != nil {
		t.Fatal(err)
	}
	disabled, err := repo.GetByHash(inviteHash(disabledCode))
	if err != nil {
		t.Fatal(err)
	}
	if err = svc.Disable(disabled.ID); err != nil {
		t.Fatal(err)
	}
	if err = svc.Consume(disabledCode); !errors.Is(err, ErrInviteCodeDisabled) {
		t.Fatalf("disabled consume error = %v, want disabled", err)
	}
	disabled, err = repo.GetByHash(inviteHash(disabledCode))
	if err != nil || disabled.UsedCount != 0 {
		t.Fatalf("disabled invite count changed: invite=%+v err=%v", disabled, err)
	}

	expiredCode := "expired-invite"
	expiry := time.Now().Add(-time.Hour)
	if _, err = repo.Create(expiredCode, inviteHash(expiredCode), 1, "", 5, &expiry); err != nil {
		t.Fatal(err)
	}
	if err = svc.Consume(expiredCode); !errors.Is(err, ErrInviteCodeExpired) {
		t.Fatalf("expired consume error = %v, want expired", err)
	}
	expired, err := repo.GetByHash(inviteHash(expiredCode))
	if err != nil || expired.UsedCount != 0 {
		t.Fatalf("expired invite count changed: invite=%+v err=%v", expired, err)
	}

	protectedCode := "protected-fields"
	protectedExpiry := time.Now().Add(time.Hour)
	if _, err = repo.Create(protectedCode, inviteHash(protectedCode), 1, "", 5, &protectedExpiry); err != nil {
		t.Fatal(err)
	}
	before, err := repo.GetByHash(inviteHash(protectedCode))
	if err != nil {
		t.Fatal(err)
	}
	if err = svc.Consume(protectedCode); err != nil {
		t.Fatal(err)
	}
	after, err := repo.GetByHash(inviteHash(protectedCode))
	if err != nil {
		t.Fatal(err)
	}
	if after.CodeHash != before.CodeHash || after.CreatedBy != before.CreatedBy || *after.MaxUses != *before.MaxUses || after.Status != before.Status || after.ExpiresAt == nil || before.ExpiresAt == nil || !after.ExpiresAt.Equal(*before.ExpiresAt) || after.UsedCount != before.UsedCount+1 {
		t.Fatalf("consume changed protected fields: before=%+v after=%+v", before, after)
	}
}

func TestInviteConsumeConcurrentMaxUses(t *testing.T) {
	for _, maxUses := range []int{1, 5} {
		t.Run("max-"+string(rune('0'+maxUses)), func(t *testing.T) {
			cfg := &config.Config{DBPath: filepath.Join(t.TempDir(), "concurrent.db"), UploadDir: t.TempDir(), AdminUser: "admin", AdminPass: "test-admin-password", SiteName: "test"}
			db, err := repository.InitDB(cfg)
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			repo := repository.NewInviteRepository(db)
			svc := NewInviteService(repo)
			code, _, err := svc.Generate(1, maxUses, nil)
			if err != nil {
				t.Fatal(err)
			}

			const attempts = 20
			start := make(chan struct{})
			var wg sync.WaitGroup
			var successes atomic.Int32
			for range attempts {
				wg.Add(1)
				go func() {
					defer wg.Done()
					<-start
					if svc.Consume(code) == nil {
						successes.Add(1)
					}
				}()
			}
			close(start)
			wg.Wait()
			if got := int(successes.Load()); got != maxUses {
				t.Fatalf("successful consumes = %d, want %d", got, maxUses)
			}
			invite, err := repo.GetByHash(inviteHash(code))
			if err != nil || invite.UsedCount != maxUses {
				t.Fatalf("persisted used_count = %d, err=%v, want %d", invite.UsedCount, err, maxUses)
			}
		})
	}
}

func inviteHash(code string) string {
	sum := sha256.Sum256([]byte(strings.ToUpper(strings.TrimSpace(code))))
	return hex.EncodeToString(sum[:])
}
