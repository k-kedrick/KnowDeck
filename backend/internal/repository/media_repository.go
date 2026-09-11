package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"mime"
	"path"
	"regexp"
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
	FolderID   *int64 // nil = 全部, 0 = 未分类, >0 = 指定文件夹
	DocumentID *int64 // >0 = 指定关联文档
	Unused     *bool  // true = 筛选未被任何文档使用的资源
	MediaType  string // image, video, file
	Keyword    string // 搜索文件名、原文件名或关联文档标题
	SortBy     string // latest, oldest, name_asc, name_desc, size_desc, size_asc
	Page       int
	PageSize   int
}

var documentLocalMediaURLPattern = regexp.MustCompile(`(?i)/uploads/(?:images|videos|files)/[^\s"'<>?\)\]]+`)

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

	if filter.DocumentID != nil && *filter.DocumentID > 0 {
		whereClauses = append(whereClauses, "id IN (SELECT media_id FROM media_document_refs WHERE document_id = ?)")
		args = append(args, *filter.DocumentID)
	}

	if filter.Unused != nil && *filter.Unused {
		whereClauses = append(whereClauses, "id NOT IN (SELECT media_id FROM media_document_refs)")
	}

	if filter.MediaType != "" {
		whereClauses = append(whereClauses, "media_type = ?")
		args = append(args, filter.MediaType)
	}

	if filter.Keyword != "" {
		whereClauses = append(whereClauses, "(original_name LIKE ? OR filename LIKE ? OR id IN (SELECT r.media_id FROM media_document_refs r JOIN documents d ON d.id = r.document_id WHERE d.title LIKE ?))")
		kw := "%" + filter.Keyword + "%"
		args = append(args, kw, kw, kw)
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

	orderSQL := "ORDER BY id DESC"
	switch filter.SortBy {
	case "oldest":
		orderSQL = "ORDER BY id ASC"
	case "name_asc", "name":
		orderSQL = "ORDER BY original_name COLLATE NOCASE ASC, id DESC"
	case "name_desc":
		orderSQL = "ORDER BY original_name COLLATE NOCASE DESC, id DESC"
	case "size_desc":
		orderSQL = "ORDER BY size DESC, id DESC"
	case "size_asc":
		orderSQL = "ORDER BY size ASC, id DESC"
	}

	querySQL := fmt.Sprintf(`
		SELECT id, COALESCE(folder_id, 0), original_name, filename, path, url, media_type, mime_type, size, duration, thumbnail, source, created_at
		FROM media
		%s
		%s
		LIMIT ? OFFSET ?
	`, whereSQL, orderSQL)

	queryArgs := append(args, pageSize, offset)
	rows, err := r.db.Query(querySQL, queryArgs...)
	if err != nil {
		return nil, 0, err
	}

	var list []*model.Media
	mediaMap := make(map[int64]*model.Media)
	var mediaIDs []interface{}
	var placeholders []string

	for rows.Next() {
		var m model.Media
		var createdAt string
		if err := rows.Scan(&m.ID, &m.FolderID, &m.OriginalName, &m.Filename, &m.Path, &m.URL, &m.MediaType, &m.MimeType, &m.Size, &m.Duration, &m.Thumbnail, &m.Source, &createdAt); err != nil {
			rows.Close()
			return nil, 0, err
		}
		m.CreatedAt = utils.ParseFlexibleTime(createdAt)
		m.References = make([]*model.DocumentSummary, 0)
		list = append(list, &m)
		mediaMap[m.ID] = &m
		mediaIDs = append(mediaIDs, m.ID)
		placeholders = append(placeholders, "?")
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	rows.Close()

	if len(mediaIDs) > 0 {
		refSQL := fmt.Sprintf(`
			SELECT r.media_id, d.id, d.title, d.slug, d.updated_at
			FROM media_document_refs r JOIN documents d ON d.id = r.document_id
			WHERE r.media_id IN (%s)
			ORDER BY d.updated_at DESC
		`, strings.Join(placeholders, ","))

		refRows, err := r.db.Query(refSQL, mediaIDs...)
		if err == nil {
			for refRows.Next() {
				var mid int64
				var doc model.DocumentSummary
				var updated string
				if err := refRows.Scan(&mid, &doc.ID, &doc.Title, &doc.Slug, &updated); err == nil {
					doc.UpdatedAt = utils.ParseFlexibleTime(updated)
					if item, ok := mediaMap[mid]; ok {
						item.References = append(item.References, &doc)
						item.ReferenceCount++
					}
				}
			}
			refRows.Close()
		}
	}

	return list, total, nil
}

func (r *MediaRepository) GetByID(id int64) (*model.Media, error) {
	row := r.db.QueryRow(`
		SELECT id, COALESCE(folder_id, 0), original_name, filename, path, url, media_type, mime_type, size, duration, thumbnail, source, created_at
		FROM media WHERE id = ?
	`, id)

	var m model.Media
	var createdAt string
	err := row.Scan(&m.ID, &m.FolderID, &m.OriginalName, &m.Filename, &m.Path, &m.URL, &m.MediaType, &m.MimeType, &m.Size, &m.Duration, &m.Thumbnail, &m.Source, &createdAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	m.CreatedAt = utils.ParseFlexibleTime(createdAt)
	m.ReferenceCount, _ = r.ReferenceCount(m.ID)
	return &m, nil
}

func (r *MediaRepository) Create(m *model.Media) (int64, error) {
	res, err := r.db.Exec(`
		INSERT INTO media (folder_id, original_name, filename, path, url, media_type, mime_type, size, duration, thumbnail, source, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	`, m.FolderID, m.OriginalName, m.Filename, m.Path, m.URL, m.MediaType, m.MimeType, m.Size, m.Duration, m.Thumbnail, m.Source)
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

func (r *MediaRepository) ReferenceCount(mediaID int64) (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM media_document_refs WHERE media_id = ?`, mediaID).Scan(&count)
	return count, err
}

func (r *MediaRepository) ReferenceDocuments(mediaID int64) ([]*model.DocumentSummary, error) {
	rows, err := r.db.Query(`
		SELECT d.id, d.title, d.slug, d.updated_at
		FROM media_document_refs r JOIN documents d ON d.id = r.document_id
		WHERE r.media_id = ? ORDER BY d.updated_at DESC`, mediaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var docs []*model.DocumentSummary
	for rows.Next() {
		var d model.DocumentSummary
		var updated string
		if err := rows.Scan(&d.ID, &d.Title, &d.Slug, &updated); err != nil {
			return nil, err
		}
		d.UpdatedAt = utils.ParseFlexibleTime(updated)
		docs = append(docs, &d)
	}
	return docs, rows.Err()
}

// SyncDocumentReferences derives references from persisted content; it never changes content or storage paths.
func (r *MediaRepository) SyncDocumentReferences(documentID int64, content, cover string) error {
	rows, err := r.db.Query(`SELECT id, filename, path, url FROM media`)
	if err != nil {
		return err
	}
	defer rows.Close()
	type candidate struct {
		id                  int64
		filename, path, url string
	}
	var matches []int64
	needle := content + "\n" + cover
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.id, &c.filename, &c.path, &c.url); err != nil {
			return err
		}
		if (c.url != "" && strings.Contains(needle, c.url)) || (c.path != "" && strings.Contains(needle, c.path)) || (c.filename != "" && strings.Contains(needle, c.filename)) {
			matches = append(matches, c.id)
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	rows.Close()
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.Exec(`DELETE FROM media_document_refs WHERE document_id = ?`, documentID); err != nil {
		return err
	}
	for _, mediaID := range matches {
		if _, err = tx.Exec(`INSERT OR IGNORE INTO media_document_refs (media_id, document_id) VALUES (?, ?)`, mediaID, documentID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ReconcileDocumentLocalMedia restores a missing media row only when persisted
// document content already points at a local upload. It never changes content.
func (r *MediaRepository) ReconcileDocumentLocalMedia(folderID int64, content, cover string) (int, error) {
	if folderID <= 0 {
		return 0, nil
	}
	seen := make(map[string]struct{})
	created := 0
	for _, localURL := range documentLocalMediaURLPattern.FindAllString(content+"\n"+cover, -1) {
		if _, ok := seen[localURL]; ok {
			continue
		}
		seen[localURL] = struct{}{}
		relPath := strings.TrimPrefix(localURL, "/uploads/")
		if relPath == localURL || strings.Contains(relPath, "..") {
			continue
		}
		var exists int
		if err := r.db.QueryRow(`SELECT COUNT(*) FROM media WHERE url = ?`, localURL).Scan(&exists); err != nil {
			return created, err
		}
		if exists > 0 {
			continue
		}
		ext := strings.ToLower(path.Ext(relPath))
		mediaType := "file"
		if strings.HasPrefix(relPath, "images/") {
			mediaType = "image"
		} else if strings.HasPrefix(relPath, "videos/") {
			mediaType = "video"
		}
		if _, err := r.Create(&model.Media{FolderID: folderID, OriginalName: path.Base(relPath), Filename: path.Base(relPath), Path: relPath, URL: localURL, MediaType: mediaType, MimeType: mime.TypeByExtension(ext), Source: "document/editor"}); err != nil {
			return created, err
		}
		created++
	}
	return created, nil
}

// AssignUnorganizedDocumentMedia is used only immediately after a new document
// is created. It never overwrites a manually chosen folder or shared media.
func (r *MediaRepository) AssignUnorganizedDocumentMedia(documentID, folderID int64) (int64, error) {
	res, err := r.db.Exec(`UPDATE media SET folder_id = ?
		WHERE (folder_id = 0 OR folder_id IS NULL)
		AND id IN (SELECT media_id FROM media_document_refs WHERE document_id = ?)
		AND 1 = (SELECT COUNT(*) FROM media_document_refs r WHERE r.media_id = media.id)`, folderID, documentID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (r *MediaRepository) AddDocumentRef(mediaID int64, documentID int64) error {
	if mediaID <= 0 || documentID <= 0 {
		return nil
	}
	_, err := r.db.Exec(`INSERT OR IGNORE INTO media_document_refs (media_id, document_id) VALUES (?, ?)`, mediaID, documentID)
	return err
}

func (r *MediaRepository) DeleteDocumentReferences(documentID int64) error {
	if documentID <= 0 {
		return nil
	}
	_, err := r.db.Exec(`DELETE FROM media_document_refs WHERE document_id = ?`, documentID)
	return err
}

func (r *MediaRepository) RebuildReferences() (int, error) {
	rows, err := r.db.Query(`SELECT id, content, cover FROM documents`)
	if err != nil {
		return 0, err
	}
	type documentContent struct {
		id             int64
		content, cover string
	}
	var docs []documentContent
	for rows.Next() {
		var doc documentContent
		if err := rows.Scan(&doc.id, &doc.content, &doc.cover); err != nil {
			rows.Close()
			return 0, err
		}
		docs = append(docs, doc)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	rows.Close()
	for _, doc := range docs {
		var folderID int64
		if err := r.db.QueryRow(`SELECT id FROM media_folders WHERE document_id = ?`, doc.id).Scan(&folderID); err != nil && !errors.Is(err, sql.ErrNoRows) {
			return 0, err
		}
		if _, err := r.ReconcileDocumentLocalMedia(folderID, doc.content, doc.cover); err != nil {
			return 0, err
		}
		if err := r.SyncDocumentReferences(doc.id, doc.content, doc.cover); err != nil {
			return 0, err
		}
	}
	return len(docs), nil
}
