package repository

import (
	"database/sql"
	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/pkg/utils"
	"time"
)

type InviteRepository struct{ db *DB }

type sqlExecer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

func NewInviteRepository(db *DB) *InviteRepository { return &InviteRepository{db: db} }
func (r *InviteRepository) Create(codeHash string, createdBy int64, maxUses int, expiresAt *time.Time) (int64, error) {
	var expiresAtValue any
	if expiresAt != nil {
		expiresAtValue = expiresAt.UTC().Format("2006-01-02 15:04:05")
	}
	result, err := r.db.Exec("INSERT INTO invite_codes (code_hash, created_by, max_uses, expires_at) VALUES (?, ?, ?, ?)", codeHash, createdBy, maxUses, expiresAtValue)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}
func (r *InviteRepository) GetByHash(codeHash string) (*model.InviteCode, error) {
	row := r.db.QueryRow("SELECT id, code_hash, created_by, status, max_uses, used_count, expires_at, created_at, updated_at FROM invite_codes WHERE code_hash = ?", codeHash)
	var v model.InviteCode
	var expiresAt sql.NullString
	var createdAt, updatedAt string
	if err := row.Scan(&v.ID, &v.CodeHash, &v.CreatedBy, &v.Status, &v.MaxUses, &v.UsedCount, &expiresAt, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	if expiresAt.Valid {
		expires := utils.ParseFlexibleTime(expiresAt.String)
		v.ExpiresAt = &expires
	}
	v.CreatedAt = utils.ParseFlexibleTime(createdAt)
	v.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
	return &v, nil
}

func (r *InviteRepository) List() ([]model.InviteCode, error) {
	rows, err := r.db.Query("SELECT id, created_by, status, max_uses, used_count, expires_at, created_at, updated_at FROM invite_codes ORDER BY id DESC LIMIT 100")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []model.InviteCode
	for rows.Next() {
		var v model.InviteCode
		var expiresAt sql.NullString
		var created, updated string
		if err := rows.Scan(&v.ID, &v.CreatedBy, &v.Status, &v.MaxUses, &v.UsedCount, &expiresAt, &created, &updated); err != nil {
			return nil, err
		}
		if expiresAt.Valid {
			expires := utils.ParseFlexibleTime(expiresAt.String)
			v.ExpiresAt = &expires
		}
		v.CreatedAt = utils.ParseFlexibleTime(created)
		v.UpdatedAt = utils.ParseFlexibleTime(updated)
		list = append(list, v)
	}
	return list, rows.Err()
}

func (r *InviteRepository) UpdateStatus(id int64, status string) (bool, error) {
	result, err := r.db.Exec("UPDATE invite_codes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", status, id)
	if err != nil {
		return false, err
	}
	n, err := result.RowsAffected()
	return n > 0, err
}

func (r *InviteRepository) ConsumeByHash(codeHash string) (bool, error) {
	return consumeInviteByHash(r.db, codeHash)
}

func consumeInviteByHash(execer sqlExecer, codeHash string) (bool, error) {
	result, err := execer.Exec("UPDATE invite_codes SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP WHERE code_hash = ? AND status = 'active' AND used_count < max_uses AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)", codeHash)
	if err != nil {
		return false, err
	}
	count, err := result.RowsAffected()
	return count == 1, err
}
