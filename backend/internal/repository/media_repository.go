package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/pkg/utils"
)

type MediaRepository struct {
	db *DB
}

func NewMediaRepository(db *DB) *MediaRepository {
	return &MediaRepository{db: db}
}

type MediaFilter struct {
	FolderID  *int64 // nil = 全部, 0 = 未分类, >0 = 指定文件夹
	MediaType string
	Keyword   string
	Page      int
	PageSize  int
}

func (r *MediaRepository) List(filter MediaFilter) ([]*model.Media, int64, error) {
	var whereClauses []string
	var args []interface{}

	if filter.FolderID != nil {
		if *filter.FolderID == 0 {
			whereClauses = append(whereClauses, "(folder_id = 0 OR folder_id IS NULL)")
		} else {
			whereClauses = append(whereClauses, "folder_id = ?")
			args = append(args, *filter.FolderID)
		}
	}

	if filter.MediaType != "" {
		whereClauses = append(whereClauses, "media_type = ?")
		args = append(args, filter.MediaType)
	}

	if filter.Keyword != "" {
		whereClauses = append(whereClauses, "(original_name LIKE ? OR filename LIKE ?)")
		kw := "%" + filter.Keyword + "%"
		args = append(args, kw, kw)
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	var total int64
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM media %s", whereSQL)
	if err := r.db.QueryRow(countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	querySQL := fmt.Sprintf(`
		SELECT id, COALESCE(folder_id, 0), original_name, filename, path, url, media_type, mime_type, size, duration, thumbnail, created_at
		FROM media
		%s
		ORDER BY id DESC
		LIMIT ? OFFSET ?
	`, whereSQL)

	queryArgs := append(args, pageSize, offset)
	rows, err := r.db.Query(querySQL, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []*model.Media
	for rows.Next() {
		var m model.Media
		var createdAt string
		if err := rows.Scan(&m.ID, &m.FolderID, &m.OriginalName, &m.Filename, &m.Path, &m.URL, &m.MediaType, &m.MimeType, &m.Size, &m.Duration, &m.Thumbnail, &createdAt); err != nil {
			return nil, 0, err
		}
		m.CreatedAt = utils.ParseFlexibleTime(createdAt)
		list = append(list, &m)
	}

	return list, total, nil
}

func (r *MediaRepository) GetByID(id int64) (*model.Media, error) {
	row := r.db.QueryRow(`
		SELECT id, COALESCE(folder_id, 0), original_name, filename, path, url, media_type, mime_type, size, duration, thumbnail, created_at
		FROM media WHERE id = ?
	`, id)

	var m model.Media
	var createdAt string
	err := row.Scan(&m.ID, &m.FolderID, &m.OriginalName, &m.Filename, &m.Path, &m.URL, &m.MediaType, &m.MimeType, &m.Size, &m.Duration, &m.Thumbnail, &createdAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	m.CreatedAt = utils.ParseFlexibleTime(createdAt)
	return &m, nil
}

func (r *MediaRepository) Create(m *model.Media) (int64, error) {
	res, err := r.db.Exec(`
		INSERT INTO media (folder_id, original_name, filename, path, url, media_type, mime_type, size, duration, thumbnail, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	`, m.FolderID, m.OriginalName, m.Filename, m.Path, m.URL, m.MediaType, m.MimeType, m.Size, m.Duration, m.Thumbnail)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *MediaRepository) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM media WHERE id = ?`, id)
	return err
}

func (r *MediaRepository) MoveToFolder(id int64, folderID int64) error {
	_, err := r.db.Exec(`UPDATE media SET folder_id = ? WHERE id = ?`, folderID, id)
	return err
}

func (r *MediaRepository) BatchMove(ids []int64, folderID int64) error {
	if len(ids) == 0 {
		return nil
	}
	placeholders := make([]string, len(ids))
	args := make([]interface{}, 0, len(ids)+1)
	args = append(args, folderID)
	for i, id := range ids {
		placeholders[i] = "?"
		args = append(args, id)
	}
	query := fmt.Sprintf(`UPDATE media SET folder_id = ? WHERE id IN (%s)`, strings.Join(placeholders, ","))
	_, err := r.db.Exec(query, args...)
	return err
}

func (r *MediaRepository) MoveAllFromFolder(fromFolderID int64, toFolderID int64) error {
	_, err := r.db.Exec(`UPDATE media SET folder_id = ? WHERE folder_id = ?`, toFolderID, fromFolderID)
	return err
}

func (r *MediaRepository) IsReferencedInDocuments(filename, url string) (bool, string, error) {
	if filename == "" && url == "" {
		return false, "", nil
	}

	var docTitle string
	kwFilename := "%" + filename + "%"
	kwURL := "%" + url + "%"

	err := r.db.QueryRow(`
		SELECT title FROM documents
		WHERE content LIKE ? OR content LIKE ? OR cover LIKE ? OR cover LIKE ?
		LIMIT 1
	`, kwFilename, kwURL, kwFilename, kwURL).Scan(&docTitle)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, "", nil
		}
		return false, "", err
	}
	return true, docTitle, nil
}
