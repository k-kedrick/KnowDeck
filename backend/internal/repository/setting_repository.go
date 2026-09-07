package repository

import (
	"database/sql"
	"errors"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/pkg/utils"
)

type SettingRepository struct {
	db *DB
}

func NewSettingRepository(db *DB) *SettingRepository {
	return &SettingRepository{db: db}
}

func (r *SettingRepository) GetAll() (map[string]string, error) {
	rows, err := r.db.Query(`SELECT key, value FROM settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err == nil {
			settings[k] = v
		}
	}
	return settings, nil
}

func (r *SettingRepository) Get(key string) (string, error) {
	var val string
	err := r.db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&val)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	return val, nil
}

func (r *SettingRepository) Set(key, value string) error {
	_, err := r.db.Exec(`
		INSERT INTO settings (key, value, updated_at)
		VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
	`, key, value)
	return err
}

func (r *SettingRepository) SetBatch(settings map[string]string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO settings (key, value, updated_at)
		VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for k, v := range settings {
		if _, err := stmt.Exec(k, v); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *SettingRepository) GetSettingsList() ([]*model.Setting, error) {
	rows, err := r.db.Query(`SELECT key, value, description, updated_at FROM settings ORDER BY key ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*model.Setting
	for rows.Next() {
		var s model.Setting
		var updatedAt string
		if err := rows.Scan(&s.Key, &s.Value, &s.Description, &updatedAt); err == nil {
			s.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
			list = append(list, &s)
		}
	}
	return list, nil
}
