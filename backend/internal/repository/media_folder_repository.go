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

// List 获取自定义文件夹列表，并包含每个文件夹内的媒体数量统计
func (r *MediaFolderRepository) List() ([]*model.MediaFolder, error) {
	query := `
		SELECT f.id, f.name, f.parent_id, f.document_id, f.created_at, f.updated_at,
		       COUNT(m.id) AS media_count
		FROM media_folders f
		LEFT JOIN media m ON m.folder_id = f.id
		GROUP BY f.id
		ORDER BY f.parent_id, f.name COLLATE NOCASE, f.id
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
		if err := rows.Scan(&f.ID, &f.Name, &f.ParentID, &f.DocumentID, &createdAt, &updatedAt, &f.MediaCount); err != nil {
			return nil, err
		}
		f.CreatedAt = utils.ParseFlexibleTime(createdAt)
		f.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
		list = append(list, &f)
	}

	return list, nil
}

// ListDocumentReferences 获取所有引用了媒体资源的文档列表及其引用数量
func (r *MediaFolderRepository) ListDocumentReferences() ([]*model.DocumentMediaRef, error) {
	query := `
		SELECT d.id, d.title, d.slug, COUNT(r.media_id) AS media_count
		FROM documents d
		JOIN media_document_refs r ON r.document_id = d.id
		GROUP BY d.id, d.title, d.slug
		ORDER BY d.updated_at DESC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*model.DocumentMediaRef
	for rows.Next() {
		var item model.DocumentMediaRef
		if err := rows.Scan(&item.DocumentID, &item.Title, &item.Slug, &item.MediaCount); err != nil {
			return nil, err
		}
		list = append(list, &item)
	}
	return list, rows.Err()
}

// GetByID 根据 ID 获取文件夹
func (r *MediaFolderRepository) GetByID(id int64) (*model.MediaFolder, error) {
	query := `
		SELECT f.id, f.name, f.parent_id, f.document_id, f.created_at, f.updated_at,
		       COUNT(m.id) AS media_count
		FROM media_folders f
		LEFT JOIN media m ON m.folder_id = f.id
		WHERE f.id = ?
		GROUP BY f.id
	`
	var f model.MediaFolder
	var createdAt, updatedAt string
	err := r.db.QueryRow(query, id).Scan(&f.ID, &f.Name, &f.ParentID, &f.DocumentID, &createdAt, &updatedAt, &f.MediaCount)
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
		SELECT f.id, f.name, f.parent_id, f.document_id, f.created_at, f.updated_at,
		       COUNT(m.id) AS media_count
		FROM media_folders f
		LEFT JOIN media m ON m.folder_id = f.id
		WHERE f.document_id = ?
		GROUP BY f.id
		LIMIT 1
	`
	var f model.MediaFolder
	var createdAt, updatedAt string
	err := r.db.QueryRow(query, docID).Scan(&f.ID, &f.Name, &f.ParentID, &f.DocumentID, &createdAt, &updatedAt, &f.MediaCount)
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
		INSERT INTO media_folders (name, parent_id, document_id, created_at, updated_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`
	res, err := r.db.Exec(query, f.Name, f.ParentID, f.DocumentID)
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

// GetStats 获取全局媒体总数、未分类、已使用及未使用媒体数
func (r *MediaFolderRepository) GetStats() (totalMedia int64, unclassifiedMedia int64, usedMedia int64, unusedMedia int64, err error) {
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM media`).Scan(&totalMedia)
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM media WHERE folder_id = 0 OR folder_id IS NULL`).Scan(&unclassifiedMedia)
	_ = r.db.QueryRow(`SELECT COUNT(DISTINCT media_id) FROM media_document_refs`).Scan(&usedMedia)
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM media WHERE id NOT IN (SELECT media_id FROM media_document_refs)`).Scan(&unusedMedia)
	return totalMedia, unclassifiedMedia, usedMedia, unusedMedia, nil
}
