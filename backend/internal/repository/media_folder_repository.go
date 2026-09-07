package repository

import (
	"database/sql"
	"errors"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/pkg/utils"
)

type MediaFolderRepository struct {
	db *DB
}

func NewMediaFolderRepository(db *DB) *MediaFolderRepository {
	return &MediaFolderRepository{db: db}
}

// List 获取所有文件夹列表，并包含每个文件夹内的媒体数量统计
func (r *MediaFolderRepository) List() ([]*model.MediaFolder, error) {
	// 自动确保所有现有文档在 media_folders 中拥有专属文件夹记录
	_, _ = r.db.Exec(`
		INSERT INTO media_folders (name, document_id, created_at, updated_at)
		SELECT d.title, d.id, d.created_at, d.updated_at
		FROM documents d
		WHERE d.id NOT IN (SELECT document_id FROM media_folders WHERE document_id > 0)
	`)

	query := `
		SELECT f.id, f.name, f.document_id, f.created_at, f.updated_at,
		       COUNT(m.id) AS media_count
		FROM media_folders f
		LEFT JOIN media m ON m.folder_id = f.id
		GROUP BY f.id
		ORDER BY f.document_id DESC, f.updated_at DESC, f.id DESC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*model.MediaFolder
	for rows.Next() {
		var f model.MediaFolder
		var createdAt, updatedAt string
		if err := rows.Scan(&f.ID, &f.Name, &f.DocumentID, &createdAt, &updatedAt, &f.MediaCount); err != nil {
			return nil, err
		}
		f.CreatedAt = utils.ParseFlexibleTime(createdAt)
		f.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
		list = append(list, &f)
	}

	return list, nil
}

// GetByID 根据 ID 获取文件夹
func (r *MediaFolderRepository) GetByID(id int64) (*model.MediaFolder, error) {
	query := `
		SELECT f.id, f.name, f.document_id, f.created_at, f.updated_at,
		       COUNT(m.id) AS media_count
		FROM media_folders f
		LEFT JOIN media m ON m.folder_id = f.id
		WHERE f.id = ?
		GROUP BY f.id
	`
	var f model.MediaFolder
	var createdAt, updatedAt string
	err := r.db.QueryRow(query, id).Scan(&f.ID, &f.Name, &f.DocumentID, &createdAt, &updatedAt, &f.MediaCount)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	f.CreatedAt = utils.ParseFlexibleTime(createdAt)
	f.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
	return &f, nil
}

// GetByDocumentID 根据绑定的文档 ID 获取文件夹
func (r *MediaFolderRepository) GetByDocumentID(docID int64) (*model.MediaFolder, error) {
	if docID <= 0 {
		return nil, nil
	}
	query := `
		SELECT f.id, f.name, f.document_id, f.created_at, f.updated_at,
		       COUNT(m.id) AS media_count
		FROM media_folders f
		LEFT JOIN media m ON m.folder_id = f.id
		WHERE f.document_id = ?
		GROUP BY f.id
		LIMIT 1
	`
	var f model.MediaFolder
	var createdAt, updatedAt string
	err := r.db.QueryRow(query, docID).Scan(&f.ID, &f.Name, &f.DocumentID, &createdAt, &updatedAt, &f.MediaCount)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	f.CreatedAt = utils.ParseFlexibleTime(createdAt)
	f.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
	return &f, nil
}

// Create 创建新文件夹
func (r *MediaFolderRepository) Create(f *model.MediaFolder) (int64, error) {
	query := `
		INSERT INTO media_folders (name, document_id, created_at, updated_at)
		VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`
	res, err := r.db.Exec(query, f.Name, f.DocumentID)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// Update 修改文件夹名称
func (r *MediaFolderRepository) Update(id int64, name string) error {
	query := `
		UPDATE media_folders
		SET name = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`
	_, err := r.db.Exec(query, name, id)
	return err
}

// Delete 删除文件夹
func (r *MediaFolderRepository) Delete(id int64) error {
	query := `DELETE FROM media_folders WHERE id = ?`
	_, err := r.db.Exec(query, id)
	return err
}

// GetStats 获取全局媒体总数与未分类媒体数
func (r *MediaFolderRepository) GetStats() (totalMedia int64, unclassifiedMedia int64, err error) {
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM media`).Scan(&totalMedia)
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM media WHERE folder_id = 0 OR folder_id IS NULL`).Scan(&unclassifiedMedia)
	return totalMedia, unclassifiedMedia, nil
}
