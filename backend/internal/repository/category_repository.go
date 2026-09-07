package repository

import (
	"database/sql"
	"errors"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/pkg/utils"
)

type CategoryRepository struct {
	db *DB
}

func NewCategoryRepository(db *DB) *CategoryRepository {
	return &CategoryRepository{db: db}
}

func (r *CategoryRepository) ListAll() ([]*model.Category, error) {
	rows, err := r.db.Query(`
		SELECT c.id, c.name, c.slug, c.description, c.icon, c.parent_id, c.sort_order, c.created_at, c.updated_at,
		       (SELECT COUNT(*) FROM documents d WHERE d.category_id = c.id AND d.status = 'published') as doc_count
		FROM categories c
		ORDER BY c.sort_order ASC, c.id ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Keep the JSON contract stable for an empty database: callers should
	// receive [] instead of null when no categories exist.
	list := make([]*model.Category, 0)
	for rows.Next() {
		var c model.Category
		var createdAt, updatedAt string
		if err := rows.Scan(&c.ID, &c.Name, &c.Slug, &c.Description, &c.Icon, &c.ParentID, &c.SortOrder, &createdAt, &updatedAt, &c.DocCount); err != nil {
			return nil, err
		}
		c.CreatedAt = utils.ParseFlexibleTime(createdAt)
		c.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
		list = append(list, &c)
	}
	return list, rows.Err()
}

func (r *CategoryRepository) GetByID(id int64) (*model.Category, error) {
	row := r.db.QueryRow(`
		SELECT id, name, slug, description, icon, parent_id, sort_order, created_at, updated_at
		FROM categories WHERE id = ?
	`, id)

	var c model.Category
	var createdAt, updatedAt string
	err := row.Scan(&c.ID, &c.Name, &c.Slug, &c.Description, &c.Icon, &c.ParentID, &c.SortOrder, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	c.CreatedAt = utils.ParseFlexibleTime(createdAt)
	c.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
	return &c, nil
}

func (r *CategoryRepository) GetBySlug(slug string) (*model.Category, error) {
	row := r.db.QueryRow(`
		SELECT id, name, slug, description, icon, parent_id, sort_order, created_at, updated_at
		FROM categories WHERE slug = ?
	`, slug)

	var c model.Category
	var createdAt, updatedAt string
	err := row.Scan(&c.ID, &c.Name, &c.Slug, &c.Description, &c.Icon, &c.ParentID, &c.SortOrder, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	c.CreatedAt = utils.ParseFlexibleTime(createdAt)
	c.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
	return &c, nil
}

func (r *CategoryRepository) Create(c *model.Category) (int64, error) {
	res, err := r.db.Exec(`
		INSERT INTO categories (name, slug, description, icon, parent_id, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, c.Name, c.Slug, c.Description, c.Icon, c.ParentID, c.SortOrder)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *CategoryRepository) Update(c *model.Category) error {
	_, err := r.db.Exec(`
		UPDATE categories
		SET name = ?, slug = ?, description = ?, icon = ?, parent_id = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, c.Name, c.Slug, c.Description, c.Icon, c.ParentID, c.SortOrder, c.ID)
	return err
}

func (r *CategoryRepository) Delete(id int64) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE categories SET parent_id = 0 WHERE parent_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE documents SET category_id = 0 WHERE category_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM categories WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *CategoryRepository) Count() (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM categories`).Scan(&count)
	return count, err
}
