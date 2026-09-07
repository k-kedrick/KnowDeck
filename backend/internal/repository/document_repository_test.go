package repository

import (
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/model"
)

func newTestDB(t *testing.T) *DB {
	t.Helper()

	dir := t.TempDir()
	db, err := InitDB(&config.Config{
		DBPath:       filepath.Join(dir, "app.db"),
		UploadDir:    filepath.Join(dir, "uploads"),
		AdminUser:    "admin",
		AdminPass:    "admin123456",
		JWTSecret:    "test-secret",
		JWTExpireHrs: 1,
		MaxUploadMB:  10,
		SiteName:     "test",
	})
	if err != nil {
		t.Fatalf("InitDB returned error: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})
	return db
}

func TestListLoadsTagsInBatchAndPreservesDocumentOrder(t *testing.T) {
	db := newTestDB(t)
	if _, err := db.Exec("DELETE FROM document_tags; DELETE FROM documents; DELETE FROM tags"); err != nil {
		t.Fatalf("clear seed documents: %v", err)
	}
	repo := NewDocumentRepository(db)
	publishedAt := time.Now()

	for _, document := range []*model.Document{
		{Title: "Regular", Slug: "regular", Status: "published", AuthorID: 1, Tags: []string{"Go"}, PublishedAt: &publishedAt},
		{Title: "Pinned", Slug: "pinned", Status: "published", AuthorID: 1, IsPinned: true, Tags: []string{"Go", "React"}, PublishedAt: &publishedAt},
	} {
		if _, err := repo.Create(document); err != nil {
			t.Fatalf("create %s: %v", document.Title, err)
		}
	}

	documents, total, err := repo.List(DocumentFilter{Status: "published", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if total != 2 || len(documents) != 2 {
		t.Fatalf("got total=%d len=%d, want 2", total, len(documents))
	}
	if documents[0].Slug != "pinned" || documents[1].Slug != "regular" {
		t.Fatalf("document order changed: %s, %s", documents[0].Slug, documents[1].Slug)
	}
	if !reflect.DeepEqual(documents[0].Tags, []string{"Go", "React"}) {
		t.Fatalf("pinned tags = %#v", documents[0].Tags)
	}
	if !reflect.DeepEqual(documents[1].Tags, []string{"Go"}) {
		t.Fatalf("regular tags = %#v", documents[1].Tags)
	}
}

func TestListPublishedForTreeDoesNotSilentlyTruncateAtOneThousand(t *testing.T) {
	db := newTestDB(t)
	if _, err := db.Exec("DELETE FROM document_tags; DELETE FROM documents"); err != nil {
		t.Fatalf("clear seed documents: %v", err)
	}
	if _, err := db.Exec(`
		WITH RECURSIVE sequence(value) AS (
			SELECT 1
			UNION ALL
			SELECT value + 1 FROM sequence WHERE value < 1005
		)
		INSERT INTO documents (title, slug, status, author_id, updated_at, published_at)
		SELECT 'Tree document ' || value, 'tree-' || value, 'published', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		FROM sequence
	`); err != nil {
		t.Fatalf("insert tree documents: %v", err)
	}

	documents, err := NewDocumentRepository(db).ListPublishedForTree()
	if err != nil {
		t.Fatalf("ListPublishedForTree returned error: %v", err)
	}
	if len(documents) != 1005 {
		t.Fatalf("tree document count = %d, want 1005", len(documents))
	}
}

func TestCoreDocumentIndexesExist(t *testing.T) {
	db := newTestDB(t)
	var count int
	if err := db.QueryRow(`
		SELECT COUNT(*) FROM sqlite_master
		WHERE type = 'index' AND name IN (
			'idx_documents_public_order',
			'idx_documents_category_status',
			'idx_document_tags_tag_document'
		)
	`).Scan(&count); err != nil {
		t.Fatalf("inspect indexes: %v", err)
	}
	if count != 3 {
		t.Fatalf("core index count = %d, want 3", count)
	}
}

func TestUpdateStatusDoesNotMutateContentExcerptOrTags(t *testing.T) {
	db := newTestDB(t)
	repo := NewDocumentRepository(db)

	doc := &model.Document{
		Title:      "Status safety",
		Slug:       "status-safety",
		Content:    "正文内容不能被状态切换清空",
		Excerpt:    "原摘要",
		Status:     "draft",
		CategoryID: 0,
		AuthorID:   1,
		Tags:       []string{"Go", "React"},
	}
	id, err := repo.Create(doc)
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	now := time.Now()
	updated, err := repo.UpdateStatus(id, "published", &now)
	if err != nil {
		t.Fatalf("UpdateStatus returned error: %v", err)
	}
	if updated.Status != "published" {
		t.Fatalf("status = %q, want published", updated.Status)
	}

	got, err := repo.GetByID(id)
	if err != nil {
		t.Fatalf("GetByID returned error: %v", err)
	}
	if got.Content != doc.Content {
		t.Fatalf("content changed to %q", got.Content)
	}
	if got.Excerpt != doc.Excerpt {
		t.Fatalf("excerpt changed to %q", got.Excerpt)
	}
	if len(got.Tags) != 2 {
		t.Fatalf("tags = %#v, want two tags", got.Tags)
	}
}

func TestUpdateRollsBackWhenTagSyncFails(t *testing.T) {
	db := newTestDB(t)
	repo := NewDocumentRepository(db)

	doc := &model.Document{
		Title:    "Rollback",
		Slug:     "rollback",
		Content:  "original",
		Excerpt:  "original",
		Status:   "draft",
		AuthorID: 1,
		Tags:     []string{"stable"},
	}
	id, err := repo.Create(doc)
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	if _, err := db.Exec(`DROP TABLE document_tags`); err != nil {
		t.Fatalf("failed to force tag sync failure: %v", err)
	}

	doc.ID = id
	doc.Title = "Rollback changed"
	doc.Content = "changed"
	doc.Tags = []string{"new-tag"}
	if err := repo.Update(doc); err == nil {
		t.Fatal("Update returned nil error after document_tags was dropped")
	}

	var title, content string
	if err := db.QueryRow(`SELECT title, content FROM documents WHERE id = ?`, id).Scan(&title, &content); err != nil {
		t.Fatalf("failed to inspect document after failed update: %v", err)
	}
	if title != "Rollback" || content != "original" {
		t.Fatalf("document was not rolled back: title=%q content=%q", title, content)
	}
}
