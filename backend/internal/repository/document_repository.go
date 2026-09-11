package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/pkg/utils"
)

type DocumentRepository struct {
	db *DB
}

func (r *DocumentRepository) GetMediaFolderID(documentID int64) (int64, error) {
	var folderID int64
	err := r.db.QueryRow(`SELECT id FROM media_folders WHERE document_id = ?`, documentID).Scan(&folderID)
	return folderID, err
}

type sqlExecutor interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
	Query(query string, args ...interface{}) (*sql.Rows, error)
	QueryRow(query string, args ...interface{}) *sql.Row
}

func NewDocumentRepository(db *DB) *DocumentRepository {
	return &DocumentRepository{db: db}
}

type DocumentFilter struct {
	Status     string
	CategoryID int64
	Tag        string
	Tags       []string
	Keyword    string
	Page       int
	PageSize   int
}

var ErrInvalidDocumentAccessLevel = errors.New("invalid document access level")

func NormalizeDocumentAccessLevel(accessLevel string) (string, error) {
	if accessLevel == "" {
		return "public", nil
	}
	if accessLevel != "public" && accessLevel != "authenticated" {
		return "", ErrInvalidDocumentAccessLevel
	}
	return accessLevel, nil
}

func (r *DocumentRepository) List(filter DocumentFilter) ([]*model.Document, int64, error) {
	var whereClauses []string
	var args []interface{}

	if filter.Status != "" {
		whereClauses = append(whereClauses, "d.status = ?")
		args = append(args, filter.Status)
	}

	if filter.CategoryID > 0 {
		whereClauses = append(whereClauses, `d.category_id IN (
			WITH RECURSIVE descendants(id) AS (
				VALUES (?)
				UNION
				SELECT c.id FROM categories c JOIN descendants d ON c.parent_id = d.id
			)
			SELECT id FROM descendants
		)`)
		args = append(args, filter.CategoryID)
	}

	tags := make([]string, 0, len(filter.Tags)+1)
	seenTags := make(map[string]struct{})
	for _, tag := range append([]string{filter.Tag}, filter.Tags...) {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		if _, seen := seenTags[tag]; seen {
			continue
		}
		seenTags[tag] = struct{}{}
		tags = append(tags, tag)
	}
	for _, tag := range tags {
		whereClauses = append(whereClauses, "d.id IN (SELECT dt.document_id FROM document_tags dt JOIN tags t ON dt.tag_id = t.id WHERE t.name = ? OR t.slug = ?)")
		args = append(args, tag, tag)
	}

	if filter.Keyword != "" {
		whereClauses = append(whereClauses, "(d.title LIKE ? OR d.content LIKE ? OR d.excerpt LIKE ?)")
		kw := "%" + filter.Keyword + "%"
		args = append(args, kw, kw, kw)
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Count
	var total int64
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM documents d %s", whereSQL)
	err := r.db.QueryRow(countSQL, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Pagination
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	querySQL := fmt.Sprintf(`
		SELECT d.id, d.title, d.slug, d.excerpt, d.cover, d.status, d.access_level, d.category_id, d.author_id,
		       d.sort_order, d.is_pinned, d.views, d.created_at, d.updated_at, d.published_at,
		       COALESCE(c.name, '') as category_name, COALESCE(c.slug, '') as category_slug,
		       COALESCE(u.nickname, u.username, '') as author_name
		FROM documents d
		LEFT JOIN categories c ON d.category_id = c.id
		LEFT JOIN users u ON d.author_id = u.id
		%s
		ORDER BY d.is_pinned DESC, d.sort_order ASC, d.published_at DESC, d.created_at DESC
		LIMIT ? OFFSET ?
	`, whereSQL)

	queryArgs := append(args, pageSize, offset)
	rows, err := r.db.Query(querySQL, queryArgs...)
	if err != nil {
		return nil, 0, err
	}

	var list []*model.Document
	for rows.Next() {
		var doc model.Document
		var createdAt, updatedAt string
		var publishedAt sql.NullString

		err := rows.Scan(
			&doc.ID, &doc.Title, &doc.Slug, &doc.Excerpt, &doc.Cover, &doc.Status, &doc.AccessLevel,
			&doc.CategoryID, &doc.AuthorID, &doc.SortOrder, &doc.IsPinned, &doc.Views,
			&createdAt, &updatedAt, &publishedAt,
			&doc.CategoryName, &doc.CategorySlug, &doc.AuthorName,
		)
		if err != nil {
			rows.Close()
			return nil, 0, err
		}

		doc.CreatedAt = utils.ParseFlexibleTime(createdAt)
		doc.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
		if publishedAt.Valid && publishedAt.String != "" {
			t := utils.ParseFlexibleTime(publishedAt.String)
			doc.PublishedAt = &t
		}

		list = append(list, &doc)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, 0, err
	}
	if err := rows.Close(); err != nil {
		return nil, 0, err
	}

	// 批量补充标签，避免列表查询产生 N+1。
	documentIDs := make([]int64, 0, len(list))
	for _, doc := range list {
		documentIDs = append(documentIDs, doc.ID)
	}
	tagsByDocument, err := r.getDocumentTagsBatch(documentIDs)
	if err != nil {
		return nil, 0, err
	}
	for _, doc := range list {
		doc.Tags = tagsByDocument[doc.ID]
		if doc.Tags == nil {
			doc.Tags = []string{}
		}
	}

	return list, total, nil
}

func (r *DocumentRepository) GetByID(id int64) (*model.Document, error) {
	row := r.db.QueryRow(`
		SELECT d.id, d.title, d.slug, d.content, d.excerpt, d.cover, d.status, d.access_level, d.category_id, d.author_id,
		       d.sort_order, d.is_pinned, d.views, d.created_at, d.updated_at, d.published_at,
		       COALESCE(c.name, '') as category_name, COALESCE(c.slug, '') as category_slug,
		       COALESCE(u.nickname, u.username, '') as author_name
		FROM documents d
		LEFT JOIN categories c ON d.category_id = c.id
		LEFT JOIN users u ON d.author_id = u.id
		WHERE d.id = ?
	`, id)

	return r.scanDocument(row)
}

func (r *DocumentRepository) GetBySlug(slug string) (*model.Document, error) {
	row := r.db.QueryRow(`
		SELECT d.id, d.title, d.slug, d.content, d.excerpt, d.cover, d.status, d.access_level, d.category_id, d.author_id,
		       d.sort_order, d.is_pinned, d.views, d.created_at, d.updated_at, d.published_at,
		       COALESCE(c.name, '') as category_name, COALESCE(c.slug, '') as category_slug,
		       COALESCE(u.nickname, u.username, '') as author_name
		FROM documents d
		LEFT JOIN categories c ON d.category_id = c.id
		LEFT JOIN users u ON d.author_id = u.id
		WHERE d.slug = ?
	`, slug)

	return r.scanDocument(row)
}

func (r *DocumentRepository) scanDocument(row *sql.Row) (*model.Document, error) {
	var doc model.Document
	var createdAt, updatedAt string
	var publishedAt sql.NullString

	err := row.Scan(
		&doc.ID, &doc.Title, &doc.Slug, &doc.Content, &doc.Excerpt, &doc.Cover, &doc.Status, &doc.AccessLevel,
		&doc.CategoryID, &doc.AuthorID, &doc.SortOrder, &doc.IsPinned, &doc.Views,
		&createdAt, &updatedAt, &publishedAt,
		&doc.CategoryName, &doc.CategorySlug, &doc.AuthorName,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	doc.CreatedAt = utils.ParseFlexibleTime(createdAt)
	doc.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
	if publishedAt.Valid && publishedAt.String != "" {
		t := utils.ParseFlexibleTime(publishedAt.String)
		doc.PublishedAt = &t
	}

	doc.Tags = r.getDocumentTags(doc.ID)
	return &doc, nil
}

func (r *DocumentRepository) getDocumentTags(docID int64) []string {
	rows, err := r.db.Query(`
		SELECT t.name FROM tags t
		JOIN document_tags dt ON t.id = dt.tag_id
		WHERE dt.document_id = ?
	`, docID)
	if err != nil {
		return []string{}
	}
	defer rows.Close()

	var tags []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err == nil {
			tags = append(tags, name)
		}
	}
	return tags
}

func (r *DocumentRepository) getDocumentTagsBatch(documentIDs []int64) (map[int64][]string, error) {
	result := make(map[int64][]string, len(documentIDs))
	if len(documentIDs) == 0 {
		return result, nil
	}

	const batchSize = 500
	for start := 0; start < len(documentIDs); start += batchSize {
		end := start + batchSize
		if end > len(documentIDs) {
			end = len(documentIDs)
		}
		batch := documentIDs[start:end]
		placeholders := strings.TrimRight(strings.Repeat("?,", len(batch)), ",")
		args := make([]interface{}, len(batch))
		for index, id := range batch {
			args[index] = id
		}

		rows, err := r.db.Query(`
			SELECT dt.document_id, t.name
			FROM document_tags dt
			JOIN tags t ON t.id = dt.tag_id
			WHERE dt.document_id IN (`+placeholders+`)
			ORDER BY dt.document_id, dt.tag_id
		`, args...)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var documentID int64
			var tagName string
			if err := rows.Scan(&documentID, &tagName); err != nil {
				rows.Close()
				return nil, err
			}
			result[documentID] = append(result[documentID], tagName)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		if err := rows.Close(); err != nil {
			return nil, err
		}
	}
	return result, nil
}

// ListPublishedForTree returns every published document summary without an arbitrary page limit.
func (r *DocumentRepository) ListPublishedForTree() ([]*model.Document, error) {
	rows, err := r.db.Query(`
		SELECT id, title, slug, excerpt, cover, category_id, views, updated_at
		FROM documents
		WHERE status = 'published' AND access_level = 'public'
		ORDER BY is_pinned DESC, sort_order ASC, published_at DESC, created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	documents := make([]*model.Document, 0)
	for rows.Next() {
		var document model.Document
		var updatedAt string
		if err := rows.Scan(&document.ID, &document.Title, &document.Slug, &document.Excerpt, &document.Cover, &document.CategoryID, &document.Views, &updatedAt); err != nil {
			return nil, err
		}
		document.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
		documents = append(documents, &document)
	}
	return documents, rows.Err()
}

func (r *DocumentRepository) Create(doc *model.Document) (int64, error) {
	accessLevel, err := NormalizeDocumentAccessLevel(doc.AccessLevel)
	if err != nil {
		return 0, err
	}
	doc.AccessLevel = accessLevel
	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO documents (
			title, slug, content, excerpt, cover, status, access_level, category_id, author_id,
			sort_order, is_pinned, views, created_at, updated_at, published_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
	`, doc.Title, doc.Slug, doc.Content, doc.Excerpt, doc.Cover, doc.Status,
		doc.AccessLevel, doc.CategoryID, doc.AuthorID, doc.SortOrder, doc.IsPinned, doc.PublishedAt)
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	if _, err := tx.Exec(`INSERT INTO media_folders (name, parent_id, document_id, created_at, updated_at) VALUES (?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, doc.Title, id); err != nil {
		return 0, err
	}

	if err := r.syncTags(tx, id, doc.Tags); err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return id, nil
}

func (r *DocumentRepository) Update(doc *model.Document) error {
	accessLevel, err := NormalizeDocumentAccessLevel(doc.AccessLevel)
	if err != nil {
		return err
	}
	doc.AccessLevel = accessLevel
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		UPDATE documents
		SET title = ?, slug = ?, content = ?, excerpt = ?, cover = ?, status = ?, access_level = ?,
		    category_id = ?, sort_order = ?, is_pinned = ?, updated_at = CURRENT_TIMESTAMP, published_at = ?
		WHERE id = ?
	`, doc.Title, doc.Slug, doc.Content, doc.Excerpt, doc.Cover, doc.Status, doc.AccessLevel,
		doc.CategoryID, doc.SortOrder, doc.IsPinned, doc.PublishedAt, doc.ID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}

	if err := r.syncTags(tx, doc.ID, doc.Tags); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE media_folders SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?`, doc.Title, doc.ID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *DocumentRepository) UpdateStatus(id int64, status string, publishedAt *time.Time) (*model.Document, error) {
	res, err := r.db.Exec(`
		UPDATE documents
		SET status = ?, updated_at = CURRENT_TIMESTAMP, published_at = ?
		WHERE id = ?
	`, status, publishedAt, id)
	if err != nil {
		return nil, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return nil, err
	}
	if affected == 0 {
		return nil, sql.ErrNoRows
	}
	return r.GetByID(id)
}

func (r *DocumentRepository) Delete(id int64) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM document_tags WHERE document_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE media_folders SET document_id = 0, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM documents WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *DocumentRepository) IncrementViews(id int64) {
	_, _ = r.db.Exec(`UPDATE documents SET views = views + 1 WHERE id = ?`, id)
}

func (r *DocumentRepository) syncTags(exec sqlExecutor, docID int64, tags []string) error {
	if _, err := exec.Exec(`DELETE FROM document_tags WHERE document_id = ?`, docID); err != nil {
		return err
	}
	for _, tagName := range tags {
		tagName = strings.TrimSpace(tagName)
		if tagName == "" {
			continue
		}
		// find or create tag
		var tagID int64
		err := exec.QueryRow(`SELECT id FROM tags WHERE name = ? COLLATE NOCASE`, tagName).Scan(&tagID)
		if errors.Is(err, sql.ErrNoRows) {
			slug := utils.Slugify(tagName)
			for i := 0; i < 3; i++ {
				res, insertErr := exec.Exec(`
					INSERT INTO tags (name, slug, created_at)
					SELECT ?, ?, CURRENT_TIMESTAMP
					WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = ? COLLATE NOCASE)
				`, tagName, slug, tagName)
				if insertErr == nil {
					rowsAffected, rowsErr := res.RowsAffected()
					if rowsErr != nil {
						return rowsErr
					}
					if rowsAffected == 0 {
						if lookupErr := exec.QueryRow(`SELECT id FROM tags WHERE name = ? COLLATE NOCASE`, tagName).Scan(&tagID); lookupErr != nil {
							return lookupErr
						}
					} else {
						var idErr error
						tagID, idErr = res.LastInsertId()
						if idErr != nil {
							return idErr
						}
					}
					break
				}
				if lookupErr := exec.QueryRow(`SELECT id FROM tags WHERE name = ? COLLATE NOCASE`, tagName).Scan(&tagID); lookupErr == nil {
					break
				}
				if !strings.Contains(strings.ToLower(insertErr.Error()), "unique") {
					return insertErr
				}
				slug = utils.Slugify(tagName + "-" + utils.GenerateRandomHex(3))
			}
			if tagID == 0 {
				return fmt.Errorf("创建标签失败: %s", tagName)
			}
		} else if err != nil {
			return err
		}
		if tagID > 0 {
			if _, err := exec.Exec(`INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)`, docID, tagID); err != nil {
				return err
			}
		}
	}
	return nil
}

func (r *DocumentRepository) GetNeighbors(doc *model.Document) (*model.DocumentSummary, *model.DocumentSummary) {
	var prev, next *model.DocumentSummary

	// Prev
	rowPrev := r.db.QueryRow(`
		SELECT id, title, slug, excerpt, cover, views, updated_at
		FROM documents
		WHERE status = 'published' AND category_id = ? AND (sort_order < ? OR (sort_order = ? AND id < ?))
		ORDER BY sort_order DESC, id DESC
		LIMIT 1
	`, doc.CategoryID, doc.SortOrder, doc.SortOrder, doc.ID)

	var p model.DocumentSummary
	var pUpdated string
	if err := rowPrev.Scan(&p.ID, &p.Title, &p.Slug, &p.Excerpt, &p.Cover, &p.Views, &pUpdated); err == nil {
		p.UpdatedAt = utils.ParseFlexibleTime(pUpdated)
		prev = &p
	}

	// Next
	rowNext := r.db.QueryRow(`
		SELECT id, title, slug, excerpt, cover, views, updated_at
		FROM documents
		WHERE status = 'published' AND category_id = ? AND (sort_order > ? OR (sort_order = ? AND id > ?))
		ORDER BY sort_order ASC, id ASC
		LIMIT 1
	`, doc.CategoryID, doc.SortOrder, doc.SortOrder, doc.ID)

	var n model.DocumentSummary
	var nUpdated string
	if err := rowNext.Scan(&n.ID, &n.Title, &n.Slug, &n.Excerpt, &n.Cover, &n.Views, &nUpdated); err == nil {
		n.UpdatedAt = utils.ParseFlexibleTime(nUpdated)
		next = &n
	}

	return prev, next
}

func (r *DocumentRepository) CountPublished() (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM documents WHERE status = 'published'`).Scan(&count)
	return count, err
}

// ListPublishedForSitemap returns only the stable public fields needed by sitemap generation.
func (r *DocumentRepository) ListPublishedForSitemap() ([]*model.DocumentSummary, error) {
	rows, err := r.db.Query(`
		SELECT id, title, slug, excerpt, cover, views, updated_at
		FROM documents
		WHERE status = 'published' AND access_level = 'public'
		ORDER BY updated_at DESC, id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	documents := make([]*model.DocumentSummary, 0)
	for rows.Next() {
		var document model.DocumentSummary
		var updatedAt string
		if err := rows.Scan(&document.ID, &document.Title, &document.Slug, &document.Excerpt, &document.Cover, &document.Views, &updatedAt); err != nil {
			return nil, err
		}
		document.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
		documents = append(documents, &document)
	}
	return documents, rows.Err()
}
