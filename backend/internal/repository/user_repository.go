package repository

import (
	"database/sql"
	"errors"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/pkg/utils"
)

type UserRepository struct {
	db *DB
}

func NewUserRepository(db *DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) GetByID(id int64) (*model.User, error) {
	row := r.db.QueryRow(`
		SELECT id, username, password_hash, nickname, avatar, email, role, created_at, updated_at
		FROM users WHERE id = ?
	`, id)

	var u model.User
	var createdAt, updatedAt string
	err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Nickname, &u.Avatar, &u.Email, &u.Role, &createdAt, &updatedAt)
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
		SELECT id, username, password_hash, nickname, avatar, email, role, created_at, updated_at
		FROM users WHERE username = ?
	`, username)

	var u model.User
	var createdAt, updatedAt string
	err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Nickname, &u.Avatar, &u.Email, &u.Role, &createdAt, &updatedAt)
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
