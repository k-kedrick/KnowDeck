package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/pkg/utils"
)

type UserRepository struct {
	db *DB
}

type UserListFilter struct {
	Query, Role, Status string
	Page, PageSize      int
}

var ErrInviteNotConsumable = errors.New("invite not consumable")
var ErrUserNotFound = errors.New("user not found")
var ErrLastActiveAdmin = errors.New("last active admin")

func NewUserRepository(db *DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) GetByID(id int64) (*model.User, error) {
	row := r.db.QueryRow(`
		SELECT id, username, password_hash, nickname, avatar, email, role, status, auth_version, created_at, updated_at
		FROM users WHERE id = ?
	`, id)

	var u model.User
	var createdAt, updatedAt string
	err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Nickname, &u.Avatar, &u.Email, &u.Role, &u.Status, &u.AuthVersion, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	u.CreatedAt = utils.ParseFlexibleTime(createdAt)
	u.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
	return &u, nil
}

func (r *UserRepository) GetByUsername(username string) (*model.User, error) {
	row := r.db.QueryRow(`
		SELECT id, username, password_hash, nickname, avatar, email, role, status, auth_version, created_at, updated_at
		FROM users WHERE username = ?
	`, username)

	var u model.User
	var createdAt, updatedAt string
	err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Nickname, &u.Avatar, &u.Email, &u.Role, &u.Status, &u.AuthVersion, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	u.CreatedAt = utils.ParseFlexibleTime(createdAt)
	u.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
	return &u, nil
}

func (r *UserRepository) UpdateProfile(id int64, nickname, email, avatar, passwordHash string) error {
	if passwordHash != "" {
		_, err := r.db.Exec(`
			UPDATE users
			SET nickname = ?, email = ?, avatar = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, nickname, email, avatar, passwordHash, id)
		return err
	}

	_, err := r.db.Exec(`
		UPDATE users
		SET nickname = ?, email = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, nickname, email, avatar, id)
	return err
}

func (r *UserRepository) UpdateCredentials(id int64, username, passwordHash string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if passwordHash == "" {
		_, err = tx.Exec("UPDATE users SET username = ?, auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", username, id)
	} else {
		_, err = tx.Exec("UPDATE users SET username = ?, password_hash = ?, auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", username, passwordHash, id)
	}
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *UserRepository) UpdatePassword(id int64, passwordHash string) error {
	result, err := r.db.Exec(`
		UPDATE users
		SET password_hash = ?, auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, passwordHash, id)
	if err != nil {
		return err
	}
	updated, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if updated == 0 {
		return ErrUserNotFound
	}
	return nil
}

// CreateMemberWithInvite consumes an eligible invite and creates a member in one transaction.
func (r *UserRepository) CreateMemberWithInvite(username, passwordHash, inviteCodeHash string) (int64, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	var inviteID int64
	_ = tx.QueryRow("SELECT id FROM invite_codes WHERE code_hash = ?", inviteCodeHash).Scan(&inviteID)

	consumed, err := consumeInviteByHash(tx, inviteCodeHash)
	if err != nil {
		return 0, err
	}
	if !consumed {
		return 0, ErrInviteNotConsumable
	}

	result, err := tx.Exec(`
		INSERT INTO users (username, password_hash, nickname, role, status, auth_version, invite_code_id)
		VALUES (?, ?, ?, 'member', 'active', 1, ?)
	`, username, passwordHash, username, inviteID)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return id, nil
}

func (r *UserRepository) GetAuthVersion(id int64) (int64, error) {
	var version int64
	err := r.db.QueryRow("SELECT auth_version FROM users WHERE id = ?", id).Scan(&version)
	return version, err
}

func (r *UserRepository) ListUsers(filter UserListFilter) ([]model.User, int64, error) {
	where := make([]string, 0, 3)
	args := make([]any, 0, 5)
	if filter.Query != "" {
		where = append(where, "username LIKE ?")
		args = append(args, "%"+filter.Query+"%")
	}
	if filter.Role != "" {
		where = append(where, "role = ?")
		args = append(args, filter.Role)
	}
	if filter.Status != "" {
		where = append(where, "status = ?")
		args = append(args, filter.Status)
	}
	clause := ""
	if len(where) > 0 {
		clause = " WHERE " + strings.Join(where, " AND ")
	}
	var total int64
	if err := r.db.QueryRow("SELECT COUNT(*) FROM users"+clause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, filter.PageSize, (filter.Page-1)*filter.PageSize)
	rows, err := r.db.Query("SELECT id, username, role, status, created_at, updated_at FROM users"+clause+" ORDER BY id DESC LIMIT ? OFFSET ?", args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	users := []model.User{}
	for rows.Next() {
		var u model.User
		var created, updated string
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.Status, &created, &updated); err != nil {
			return nil, 0, err
		}
		u.CreatedAt = utils.ParseFlexibleTime(created)
		u.UpdatedAt = utils.ParseFlexibleTime(updated)
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("list users: %w", err)
	}
	return users, total, nil
}

func (r *UserRepository) CreateManagedUser(username, passwordHash, role string) (int64, error) {
	result, err := r.db.Exec("INSERT INTO users (username, password_hash, nickname, role, status, auth_version) VALUES (?, ?, ?, ?, 'active', 1)", username, passwordHash, username, role)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (r *UserRepository) UpdateManagedUserStatus(id int64, status string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var role, current string
	if err = tx.QueryRow("SELECT role, status FROM users WHERE id = ?", id).Scan(&role, &current); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return err
	}
	if current == status {
		return tx.Commit()
	}
	if role == "admin" && current == "active" && status == "disabled" {
		var count int
		if err = tx.QueryRow("SELECT COUNT(*) FROM users WHERE role='admin' AND status='active'").Scan(&count); err != nil {
			return err
		}
		if count <= 1 {
			return ErrLastActiveAdmin
		}
	}
	_, err = tx.Exec("UPDATE users SET status=?, auth_version=auth_version+1, updated_at=CURRENT_TIMESTAMP WHERE id=?", status, id)
	if err != nil {
		return err
	}
	return tx.Commit()
}
func (r *UserRepository) UpdateManagedUserRole(id int64, role string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var current, status string
	if err = tx.QueryRow("SELECT role,status FROM users WHERE id=?", id).Scan(&current, &status); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return err
	}
	if current == role {
		return tx.Commit()
	}
	if current == "admin" && status == "active" && role == "member" {
		var n int
		if err = tx.QueryRow("SELECT COUNT(*) FROM users WHERE role='admin' AND status='active'").Scan(&n); err != nil {
			return err
		}
		if n <= 1 {
			return ErrLastActiveAdmin
		}
	}
	_, err = tx.Exec("UPDATE users SET role=?,auth_version=auth_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?", role, id)
	if err != nil {
		return err
	}
	return tx.Commit()
}
func (r *UserRepository) ResetManagedUserPassword(id int64, hash string) error {
	result, err := r.db.Exec("UPDATE users SET password_hash=?,auth_version=auth_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?", hash, id)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrUserNotFound
	}
	return nil
}
