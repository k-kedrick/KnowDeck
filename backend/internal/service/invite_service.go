package service

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
	"math/big"
	"regexp"
	"strings"
	"time"
)

type InviteService struct{ repo *repository.InviteRepository }

var (
	ErrInvalidInviteCode   = errors.New("INVALID_INVITE_CODE")
	ErrInviteCodeDisabled  = errors.New("INVITE_CODE_DISABLED")
	ErrInviteCodeExpired   = errors.New("INVITE_CODE_EXPIRED")
	ErrInviteCodeExhausted = errors.New("INVITE_CODE_EXHAUSTED")
	ErrInviteCodeExists    = errors.New("INVITE_CODE_ALREADY_EXISTS")
)

const inviteCharset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

var validCodeRegex = regexp.MustCompile(`^[2-9A-HJ-NP-Za-km-z]{8}$`)

func NewInviteService(repo *repository.InviteRepository) *InviteService { return &InviteService{repo} }

func GenerateRandom8Code() (string, error) {
	bytes := make([]byte, 8)
	charsetLen := big.NewInt(int64(len(inviteCharset)))
	for i := 0; i < 8; i++ {
		n, err := rand.Int(rand.Reader, charsetLen)
		if err != nil {
			return "", err
		}
		bytes[i] = inviteCharset[n.Int64()]
	}
	return string(bytes), nil
}

func (s *InviteService) GenerateSingle(createdBy int64, customCode string, maxUses int, validDays int, expiresAt *time.Time, remark string) (string, int64, error) {
	if maxUses <= 0 {
		maxUses = 1
	}
	if maxUses > 1000 {
		return "", 0, errors.New("最大使用次数过大")
	}

	var expiry *time.Time
	if validDays > 0 {
		t := time.Now().Add(time.Duration(validDays) * 24 * time.Hour)
		expiry = &t
	} else if expiresAt != nil {
		if !expiresAt.After(time.Now()) {
			return "", 0, errors.New("过期时间必须晚于当前时间")
		}
		expiry = expiresAt
	}

	var code string
	if strings.TrimSpace(customCode) != "" {
		code = strings.ToUpper(strings.TrimSpace(customCode))
		if len(code) != 8 {
			return "", 0, errors.New("自定义邀请码必须为 8 位字符")
		}
		hash := hashInviteCode(code)
		if existing, _ := s.repo.GetByHash(hash); existing != nil {
			return "", 0, ErrInviteCodeExists
		}
		id, err := s.repo.Create(code, hash, createdBy, remark, maxUses, expiry)
		if err != nil {
			return "", 0, fmt.Errorf("创建邀请码失败: %w", err)
		}
		return code, id, nil
	}

	for i := 0; i < 10; i++ {
		gen, err := GenerateRandom8Code()
		if err != nil {
			return "", 0, err
		}
		hash := hashInviteCode(gen)
		id, err := s.repo.Create(gen, hash, createdBy, remark, maxUses, expiry)
		if err == nil {
			return gen, id, nil
		}
	}
	return "", 0, errors.New("生成随机邀请码重试失败")
}

func (s *InviteService) GenerateBatch(createdBy int64, count int, maxUses int, validDays int, remark string) ([]string, error) {
	if count < 1 || count > 100 {
		return nil, errors.New("单次批量生成数量应在 1~100 之间")
	}
	if maxUses <= 0 {
		maxUses = 1
	}

	var expiry *time.Time
	if validDays > 0 {
		t := time.Now().Add(time.Duration(validDays) * 24 * time.Hour)
		expiry = &t
	}

	codes := make([]string, 0, count)
	items := make([]struct {
		Code      string
		CodeHash  string
		CreatedBy int64
		Remark    string
		MaxUses   int
		ExpiresAt *time.Time
	}, 0, count)

	seen := make(map[string]bool)
	for len(codes) < count {
		gen, err := GenerateRandom8Code()
		if err != nil {
			return nil, err
		}
		if seen[gen] {
			continue
		}
		seen[gen] = true
		hash := hashInviteCode(gen)
		codes = append(codes, gen)
		items = append(items, struct {
			Code      string
			CodeHash  string
			CreatedBy int64
			Remark    string
			MaxUses   int
			ExpiresAt *time.Time
		}{
			Code:      gen,
			CodeHash:  hash,
			CreatedBy: createdBy,
			Remark:    remark,
			MaxUses:   maxUses,
			ExpiresAt: expiry,
		})
	}

	if err := s.repo.BatchCreate(items); err != nil {
		return nil, fmt.Errorf("批量写入邀请码失败: %w", err)
	}
	return codes, nil
}

func (s *InviteService) List() ([]model.InviteCode, error) {
	return s.repo.List()
}

func (s *InviteService) Update(id int64, remark string, maxUses int, validDays *int, expiresAt *time.Time, status string) error {
	existing, err := s.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("邀请码不存在")
		}
		return err
	}

	if maxUses <= 0 {
		if existing.MaxUses != nil {
			maxUses = *existing.MaxUses
		} else {
			maxUses = 1
		}
	}
	if maxUses < existing.UsedCount {
		return errors.New("最大使用次数不能少于已使用次数")
	}

	if status == "" {
		status = existing.Status
	}

	var expiry *time.Time
	if validDays != nil {
		if *validDays > 0 {
			t := time.Now().Add(time.Duration(*validDays) * 24 * time.Hour)
			expiry = &t
		} else {
			expiry = nil // 0 means permanent
		}
	} else if expiresAt != nil {
		expiry = expiresAt
	} else {
		expiry = existing.ExpiresAt
	}

	found, err := s.repo.Update(id, remark, maxUses, expiry, status)
	if err != nil {
		return err
	}
	if !found {
		return errors.New("邀请码不存在")
	}
	return nil
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

func (s *InviteService) Enable(id int64) error {
	if id < 1 {
		return errors.New("invalid invite id")
	}
	found, err := s.repo.UpdateStatus(id, "active")
	if err != nil {
		return err
	}
	if !found {
		return errors.New("invite not found")
	}
	return nil
}

func (s *InviteService) Delete(id int64) error {
	if id < 1 {
		return errors.New("invalid invite id")
	}
	found, err := s.repo.Delete(id)
	if err != nil {
		return err
	}
	if !found {
		return errors.New("邀请码不存在")
	}
	return nil
}

func (s *InviteService) BatchDelete(ids []int64) (int64, error) {
	return s.repo.BatchDelete(ids)
}

func (s *InviteService) BatchUpdateStatus(ids []int64, status string) (int64, error) {
	if status != "active" && status != "disabled" {
		return 0, errors.New("无效的邀请码状态")
	}
	return s.repo.BatchUpdateStatus(ids, status)
}

func (s *InviteService) GetUsersByInviteID(inviteID int64) ([]model.InviteUserUsage, error) {
	return s.repo.GetUsersByInviteID(inviteID)
}

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
	sum := sha256.Sum256([]byte(strings.ToUpper(strings.TrimSpace(code))))
	return hex.EncodeToString(sum[:])
}
