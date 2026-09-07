package service

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/pkg/utils"
)

var (
	ErrInvalidUsername = errors.New("INVALID_USERNAME")
	ErrWeakPassword    = errors.New("WEAK_PASSWORD")
	ErrUsernameExists  = errors.New("USERNAME_EXISTS")
)

type RegistrationService struct {
	users   *repository.UserRepository
	invites *repository.InviteRepository
}

func NewRegistrationService(users *repository.UserRepository, invites *repository.InviteRepository) *RegistrationService {
	return &RegistrationService{users: users, invites: invites}
}

func (s *RegistrationService) Register(username, password, inviteCode string) (*model.User, error) {
	username = strings.TrimSpace(username)
	if len(username) < 3 || len(username) > 32 {
		return nil, ErrInvalidUsername
	}
	if len(password) < 12 {
		return nil, ErrWeakPassword
	}
	inviteCode = strings.TrimSpace(inviteCode)
	if inviteCode == "" {
		return nil, ErrInvalidInviteCode
	}

	passwordHash, err := utils.HashPassword(password)
	if err != nil {
		return nil, err
	}
	inviteHash := hashInviteCode(inviteCode)
	id, err := s.users.CreateMemberWithInvite(username, passwordHash, inviteHash)
	if err == nil {
		return &model.User{ID: id, Username: username, Role: "member", Status: "active", AuthVersion: 1}, nil
	}
	if isUsernameConflict(err) {
		return nil, ErrUsernameExists
	}
	if errors.Is(err, repository.ErrInviteNotConsumable) {
		return nil, s.inviteError(inviteHash)
	}
	return nil, err
}

func (s *RegistrationService) inviteError(inviteHash string) error {
	invite, err := s.invites.GetByHash(inviteHash)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrInvalidInviteCode
	}
	if err != nil {
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

func isUsernameConflict(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "unique constraint failed: users.username")
}
