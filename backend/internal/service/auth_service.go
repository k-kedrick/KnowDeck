package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/pkg/utils"

	"github.com/golang-jwt/jwt/v5"
)

type AuthService struct {
	userRepo *repository.UserRepository
	cfg      *config.Config
}

var (
	ErrInvalidCredentials     = errors.New("INVALID_CREDENTIALS")
	ErrAccountDisabled        = errors.New("ACCOUNT_DISABLED")
	ErrCurrentPasswordInvalid = errors.New("CURRENT_PASSWORD_INVALID")
	ErrNewPasswordUnchanged   = errors.New("NEW_PASSWORD_UNCHANGED")
)

type JWTClaims struct {
	UserID      int64  `json:"user_id"`
	Username    string `json:"username"`
	Role        string `json:"role"`
	AuthVersion int64  `json:"auth_version"`
	jwt.RegisteredClaims
}

func NewAuthService(userRepo *repository.UserRepository, cfg *config.Config) *AuthService {
	return &AuthService{
		userRepo: userRepo,
		cfg:      cfg,
	}
}

func (s *AuthService) Login(username, password string) (*model.LoginResp, error) {
	username = strings.TrimSpace(username)
	user, err := s.userRepo.GetByUsername(username)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrInvalidCredentials
	}

	if !utils.CheckPasswordHash(password, user.PasswordHash) {
		return nil, ErrInvalidCredentials
	}
	if user.Status != "active" {
		return nil, ErrAccountDisabled
	}

	token, err := s.GenerateToken(user)
	if err != nil {
		return nil, fmt.Errorf("生成 Token 失败: %w", err)
	}

	return &model.LoginResp{
		Token: token,
		User:  user,
	}, nil
}

func (s *AuthService) GenerateToken(user *model.User) (string, error) {
	expireTime := time.Now().Add(time.Duration(s.cfg.JWTExpireHrs) * time.Hour)
	claims := JWTClaims{
		UserID:      user.ID,
		Username:    user.Username,
		Role:        user.Role,
		AuthVersion: user.AuthVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expireTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "feishu-kb",
			Subject:   user.Username,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

func (s *AuthService) ParseToken(tokenStr string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("无效的签名算法: %v", token.Header["alg"])
		}
		return []byte(s.cfg.JWTSecret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithIssuer("feishu-kb"), jwt.WithExpirationRequired())

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("无效或过期的 Token")
}

func (s *AuthService) GetUserByID(id int64) (*model.User, error) {
	return s.userRepo.GetByID(id)
}

func (s *AuthService) ValidateAuthVersion(id, version int64) bool {
	current, err := s.userRepo.GetAuthVersion(id)
	return err == nil && current == version
}

func (s *AuthService) ChangePassword(id int64, currentPassword, newPassword string) (*model.LoginResp, error) {
	user, err := s.userRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, repository.ErrUserNotFound
	}
	if !utils.CheckPasswordHash(currentPassword, user.PasswordHash) {
		return nil, ErrCurrentPasswordInvalid
	}
	if len(newPassword) < 12 {
		return nil, ErrWeakPassword
	}
	if utils.CheckPasswordHash(newPassword, user.PasswordHash) {
		return nil, ErrNewPasswordUnchanged
	}
	hash, err := utils.HashPassword(newPassword)
	if err != nil {
		return nil, err
	}
	if err := s.userRepo.UpdatePassword(id, hash); err != nil {
		return nil, err
	}
	updated, err := s.userRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	token, err := s.GenerateToken(updated)
	if err != nil {
		return nil, fmt.Errorf("生成 Token 失败: %w", err)
	}
	return &model.LoginResp{Token: token, User: updated}, nil
}

func (s *AuthService) UpdateCredentials(id int64, req model.UpdateCredentialsReq) error {
	user, err := s.userRepo.GetByID(id)
	if err != nil || user == nil {
		return errors.New("用户不存在")
	}
	username := strings.TrimSpace(req.Username)
	if len(username) < 3 || len(username) > 32 {
		return errors.New("管理员账号长度需为 3 到 32 个字符")
	}
	if !utils.CheckPasswordHash(req.CurrentPassword, user.PasswordHash) {
		return errors.New("当前密码不正确")
	}
	if username != user.Username {
		existing, err := s.userRepo.GetByUsername(username)
		if err != nil {
			return err
		}
		if existing != nil && existing.ID != id {
			return errors.New("该管理员账号已被使用")
		}
	}
	var hash string
	if req.NewPassword != "" {
		if len(req.NewPassword) < 12 {
			return errors.New("新密码至少需要 12 个字符")
		}
		if utils.CheckPasswordHash(req.NewPassword, user.PasswordHash) {
			return errors.New("新密码不能与当前密码相同")
		}
		hash, err = utils.HashPassword(req.NewPassword)
		if err != nil {
			return err
		}
	}
	if username == user.Username && hash == "" {
		return errors.New("账号或密码没有变化")
	}
	return s.userRepo.UpdateCredentials(id, username, hash)
}

