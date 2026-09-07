package repository

import (
	"database/sql"
	"errors"
	"time"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/pkg/utils"
)

type TagRepository struct {
	db *DB
}

var ErrTagNameExists = errors.New("标签名称已存在")

func NewTagRepository(db *DB) *TagRepository {
	return &TagRepository{db: db}
}

func (r *TagRepository) ListAll() ([]*model.Tag, error) {
	return r.listWithDocumentCount(false)
}

func (r *TagRepository) ListPublished() ([]*model.Tag, error) {
	return r.listWithDocumentCount(true)
}

func (r *TagRepository) listWithDocumentCount(publishedOnly bool) ([]*model.Tag, error) {
	statusClause := ""
	if publishedOnly {
		statusClause = " AND d.status = 'published'"
	}
	rows, err := r.db.Query(`
		SELECT t.id, t.name, t.slug, t.created_at,
		       (SELECT COUNT(*) FROM document_tags dt JOIN documents d ON dt.document_id = d.id WHERE dt.tag_id = t.id` + statusClause + `) as doc_count
		FROM tags t
		ORDER BY doc_count DESC, t.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*model.Tag, 0)
	for rows.Next() {
		var t model.Tag
		var createdAt string
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &createdAt, &t.DocCount); err != nil {
			return nil, err
		}
		t.CreatedAt = utils.ParseFlexibleTime(createdAt)
		list = append(list, &t)
	}
	return list, rows.Err()
}

func (r *TagRepository) GetByID(id int64) (*model.Tag, error) {
	row := r.db.QueryRow(`SELECT id, name, slug, created_at FROM tags WHERE id = ?`, id)
	var t model.Tag
	var createdAt string
	err := row.Scan(&t.ID, &t.Name, &t.Slug, &createdAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	t.CreatedAt = utils.ParseFlexibleTime(createdAt)
	return &t, nil
}

func (r *TagRepository) GetByName(name string) (*model.Tag, error) {
	row := r.db.QueryRow(`SELECT id, name, slug, created_at FROM tags WHERE name = ? COLLATE NOCASE`, name)
	var t model.Tag
	var createdAt string
	err := row.Scan(&t.ID, &t.Name, &t.Slug, &createdAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	t.CreatedAt = utils.ParseFlexibleTime(createdAt)
	return &t, nil
}

func (r *TagRepository) GetOrCreate(name, slug string) (*model.Tag, error) {
	tag, err := r.GetByName(name)
	if err != nil {
		return nil, err
	}
	if tag != nil {
		return tag, nil
	}

	res, err := r.db.Exec(`
		INSERT INTO tags (name, slug, created_at)
		SELECT ?, ?, CURRENT_TIMESTAMP
		WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = ? COLLATE NOCASE)
	`, name, slug, name)
	if err != nil {
		// A concurrent request may have inserted the same case-insensitive name.
		existing, lookupErr := r.GetByName(name)
		if lookupErr == nil && existing != nil {
			return existing, nil
		}
		return nil, err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rowsAffected == 0 {
		existing, err := r.GetByName(name)
		if err != nil {
			return nil, err
		}
		if existing == nil {
			return nil, errors.New("标签创建冲突，请重试")
		}
		return existing, nil
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return &model.Tag{
		ID:        id,
		Name:      name,
		Slug:      slug,
		CreatedAt: time.Now(),
	}, nil
}

func (r *TagRepository) Update(id int64, name, slug string) (*model.Tag, error) {
	var duplicateID int64
	err := r.db.QueryRow(`SELECT id FROM tags WHERE name = ? COLLATE NOCASE AND id <> ?`, name, id).Scan(&duplicateID)
	if err == nil {
		return nil, ErrTagNameExists
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	_, err = r.db.Exec(`UPDATE tags SET name = ?, slug = ? WHERE id = ?`, name, slug, id)
	if err != nil {
		return nil, err
	}
	return r.GetByID(id)
}

func (r *TagRepository) CountDocuments(id int64) (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM document_tags WHERE tag_id = ?`, id).Scan(&count)
	return count, err
}

func (r *TagRepository) Delete(id int64) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM document_tags WHERE tag_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM tags WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *TagRepository) Count() (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM tags`).Scan(&count)
	return count, err
}
