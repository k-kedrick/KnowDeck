package service

import (
	"errors"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/pkg/utils"
	"strings"
)

var ErrInvalidRole = errors.New("INVALID_ROLE")
var ErrInvalidStatus = errors.New("INVALID_STATUS")
var ErrCannotDisableSelf = errors.New("CANNOT_DISABLE_SELF")
var ErrCannotChangeOwnRole = errors.New("CANNOT_CHANGE_OWN_ROLE")

type AdminUserResult struct {
	ID                     int64
	Username, Role, Status string
}

func (s *AdminUserService) UpdateStatus(currentAdminID, targetID int64, status string) error {
	if status != "active" && status != "disabled" {
		return ErrInvalidStatus
	}
	if currentAdminID == targetID && status == "disabled" {
		return ErrCannotDisableSelf
	}
	return s.users.UpdateManagedUserStatus(targetID, status)
}
func (s *AdminUserService) UpdateRole(currentAdminID, targetID int64, role string) error {
	if role != "admin" && role != "member" {
		return ErrInvalidRole
	}
	if currentAdminID == targetID && role == "member" {
		return ErrCannotChangeOwnRole
	}
	return s.users.UpdateManagedUserRole(targetID, role)
}
func (s *AdminUserService) ResetPassword(targetID int64, password string) error {
	if len(password) < 12 {
		return ErrWeakPassword
	}
	hash, err := utils.HashPassword(password)
	if err != nil {
		return err
	}
	return s.users.ResetManagedUserPassword(targetID, hash)
}

type AdminUserService struct{ users *repository.UserRepository }

func NewAdminUserService(users *repository.UserRepository) *AdminUserService {
	return &AdminUserService{users}
}
func (s *AdminUserService) CreateUser(username, password, role string) (*AdminUserResult, error) {
	username = strings.TrimSpace(username)
	if len(username) < 3 || len(username) > 32 {
		return nil, ErrInvalidUsername
	}
	if len(password) < 12 {
		return nil, ErrWeakPassword
	}
	role = strings.TrimSpace(role)
	if role == "" {
		role = "member"
	}
	if role != "member" && role != "admin" {
		return nil, ErrInvalidRole
	}
	hash, err := utils.HashPassword(password)
	if err != nil {
		return nil, err
	}
	id, err := s.users.CreateManagedUser(username, hash, role)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique constraint failed: users.username") {
			return nil, ErrUsernameExists
		}
		return nil, err
	}
	return &AdminUserResult{ID: id, Username: username, Role: role, Status: "active"}, nil
}
