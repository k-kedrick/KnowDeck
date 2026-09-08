package repository

import (
	"database/sql"
	"fmt"
	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/pkg/utils"
	"strings"
	"time"
)

type InviteRepository struct{ db *DB }

type sqlExecer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

func NewInviteRepository(db *DB) *InviteRepository { return &InviteRepository{db: db} }

func (r *InviteRepository) Create(code string, codeHash string, createdBy int64, remark string, maxUses int, expiresAt *time.Time) (int64, error) {
	var expiresAtValue any
	if expiresAt != nil {
		expiresAtValue = expiresAt.UTC().Format("2006-01-02 15:04:05")
	}
	result, err := r.db.Exec(
		"INSERT INTO invite_codes (code, code_hash, created_by, remark, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
		code, codeHash, createdBy, remark, maxUses, expiresAtValue,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (r *InviteRepository) BatchCreate(items []struct {
	Code      string
	CodeHash  string
	CreatedBy int64
	Remark    string
	MaxUses   int
	ExpiresAt *time.Time
}) error {
	if len(items) == 0 {
		return nil
	}
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare("INSERT INTO invite_codes (code, code_hash, created_by, remark, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, item := range items {
		var expiresAtValue any
		if item.ExpiresAt != nil {
			expiresAtValue = item.ExpiresAt.UTC().Format("2006-01-02 15:04:05")
		}
		if _, err := stmt.Exec(item.Code, item.CodeHash, item.CreatedBy, item.Remark, item.MaxUses, expiresAtValue); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *InviteRepository) GetByHash(codeHash string) (*model.InviteCode, error) {
	row := r.db.QueryRow("SELECT id, code, code_hash, created_by, remark, status, max_uses, used_count, expires_at, created_at, updated_at FROM invite_codes WHERE code_hash = ?", codeHash)
	var v model.InviteCode
	var code, remark sql.NullString
	var expiresAt sql.NullString
	var createdAt, updatedAt string
	if err := row.Scan(&v.ID, &code, &v.CodeHash, &v.CreatedBy, &remark, &v.Status, &v.MaxUses, &v.UsedCount, &expiresAt, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	if code.Valid {
		v.Code = code.String
	}
	if remark.Valid {
		v.Remark = remark.String
	}
	if expiresAt.Valid {
		expires := utils.ParseFlexibleTime(expiresAt.String)
		v.ExpiresAt = &expires
	}
	v.CreatedAt = utils.ParseFlexibleTime(createdAt)
	v.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
	return &v, nil
}

func (r *InviteRepository) GetByID(id int64) (*model.InviteCode, error) {
	row := r.db.QueryRow("SELECT id, code, code_hash, created_by, remark, status, max_uses, used_count, expires_at, created_at, updated_at FROM invite_codes WHERE id = ?", id)
	var v model.InviteCode
	var code, remark sql.NullString
	var expiresAt sql.NullString
	var createdAt, updatedAt string
	if err := row.Scan(&v.ID, &code, &v.CodeHash, &v.CreatedBy, &remark, &v.Status, &v.MaxUses, &v.UsedCount, &expiresAt, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	if code.Valid {
		v.Code = code.String
	}
	if remark.Valid {
		v.Remark = remark.String
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
	rows, err := r.db.Query("SELECT id, code, code_hash, created_by, remark, status, max_uses, used_count, expires_at, created_at, updated_at FROM invite_codes ORDER BY id DESC LIMIT 500")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []model.InviteCode
	for rows.Next() {
		var v model.InviteCode
		var code, remark sql.NullString
		var expiresAt sql.NullString
		var created, updated string
		if err := rows.Scan(&v.ID, &code, &v.CodeHash, &v.CreatedBy, &remark, &v.Status, &v.MaxUses, &v.UsedCount, &expiresAt, &created, &updated); err != nil {
			return nil, err
		}
		if code.Valid {
			v.Code = code.String
		}
		if remark.Valid {
			v.Remark = remark.String
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

func (r *InviteRepository) Update(id int64, remark string, maxUses int, expiresAt *time.Time, status string) (bool, error) {
	var expiresAtValue any
	if expiresAt != nil {
		expiresAtValue = expiresAt.UTC().Format("2006-01-02 15:04:05")
	}
	result, err := r.db.Exec(
		"UPDATE invite_codes SET remark = ?, max_uses = ?, expires_at = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		remark, maxUses, expiresAtValue, status, id,
	)
	if err != nil {
		return false, err
	}
	n, err := result.RowsAffected()
	return n > 0, err
}

func (r *InviteRepository) UpdateStatus(id int64, status string) (bool, error) {
	result, err := r.db.Exec("UPDATE invite_codes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", status, id)
	if err != nil {
		return false, err
	}
	n, err := result.RowsAffected()
	return n > 0, err
}

func (r *InviteRepository) BatchUpdateStatus(ids []int64, status string) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids)+1)
	args[0] = status
	for i, id := range ids {
		placeholders[i] = "?"
		args[i+1] = id
	}
	query := fmt.Sprintf("UPDATE invite_codes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (%s)", strings.Join(placeholders, ","))
	result, err := r.db.Exec(query, args...)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func (r *InviteRepository) Delete(id int64) (bool, error) {
	result, err := r.db.Exec("DELETE FROM invite_codes WHERE id = ?", id)
	if err != nil {
		return false, err
	}
	n, err := result.RowsAffected()
	return n > 0, err
}

func (r *InviteRepository) BatchDelete(ids []int64) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	query := fmt.Sprintf("DELETE FROM invite_codes WHERE id IN (%s)", strings.Join(placeholders, ","))
	result, err := r.db.Exec(query, args...)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func (r *InviteRepository) GetUsersByInviteID(inviteID int64) ([]model.InviteUserUsage, error) {
	rows, err := r.db.Query("SELECT id, username, nickname, created_at FROM users WHERE invite_code_id = ? ORDER BY id DESC", inviteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.InviteUserUsage
	for rows.Next() {
		var u model.InviteUserUsage
		var created string
		if err := rows.Scan(&u.UserID, &u.Username, &u.Nickname, &created); err != nil {
			return nil, err
		}
		u.RegisteredAt = utils.ParseFlexibleTime(created)
		list = append(list, u)
	}
	return list, rows.Err()
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
