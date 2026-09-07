package service

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
	"strings"
	"time"
)

type InviteService struct{ repo *repository.InviteRepository }

var (
	ErrInvalidInviteCode   = errors.New("INVALID_INVITE_CODE")
	ErrInviteCodeDisabled  = errors.New("INVITE_CODE_DISABLED")
	ErrInviteCodeExpired   = errors.New("INVITE_CODE_EXPIRED")
	ErrInviteCodeExhausted = errors.New("INVITE_CODE_EXHAUSTED")
)

func NewInviteService(repo *repository.InviteRepository) *InviteService { return &InviteService{repo} }
func (s *InviteService) Generate(createdBy int64, maxUses int, expiresAt *time.Time) (string, int64, error) {
	if maxUses == 0 {
		maxUses = 1
	}
	if maxUses < 1 || maxUses > 1000 {
		return "", 0, errors.New("invalid invite options")
	}
	if expiresAt != nil && !expiresAt.After(time.Now()) {
		return "", 0, errors.New("invalid invite options")
	}
	for i := 0; i < 5; i++ {
		b := make([]byte, 16)
		if _, err := rand.Read(b); err != nil {
			return "", 0, err
		}
		code := "WXK-" + hex.EncodeToString(b)
		id, err := s.repo.Create(hashInviteCode(code), createdBy, maxUses, expiresAt)
		if err == nil {
			return code, id, nil
		}
	}
	return "", 0, errors.New("unable to generate invite")
}

func (s *InviteService) List() ([]model.InviteCode, error) { return s.repo.List() }

func (s *InviteService) Consume(code string) error {
	code = strings.TrimSpace(code)
	if code == "" {
		return ErrInvalidInviteCode
	}
	hash := hashInviteCode(code)
	consumed, err := s.repo.ConsumeByHash(hash)
	if err != nil || consumed {
		return err
	}
	invite, err := s.repo.GetByHash(hash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrInvalidInviteCode
		}
		return err
	}
	if invite.Status == "disabled" {
		return ErrInviteCodeDisabled
	}
	if invite.ExpiresAt != nil && !invite.ExpiresAt.After(time.Now()) {
		return ErrInviteCodeExpired
	}
	return ErrInviteCodeExhausted
}

func hashInviteCode(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

func (s *InviteService) Disable(id int64) error {
	if id < 1 {
		return errors.New("invalid invite id")
	}
	found, err := s.repo.UpdateStatus(id, "disabled")
	if err != nil {
		return err
	}
	if !found {
		return errors.New("invite not found")
	}
	return nil
}
