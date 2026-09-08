package repository

import (
	"database/sql"
	"errors"
	"path/filepath"
	"testing"

	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/model"
)

func TestDocumentAccessLevelMigratesExistingDocumentsToPublic(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "legacy.db")
	legacy, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatal(err)
	}
	_, err = legacy.Exec(`
		CREATE TABLE documents (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			slug TEXT NOT NULL UNIQUE,
			content TEXT NOT NULL DEFAULT '',
			excerpt TEXT DEFAULT '',
			cover TEXT DEFAULT '',
			status TEXT NOT NULL DEFAULT 'draft',
			category_id INTEGER NOT NULL DEFAULT 0,
			author_id INTEGER NOT NULL DEFAULT 1,
			sort_order INTEGER DEFAULT 0,
			is_pinned BOOLEAN DEFAULT 0,
			views INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			published_at DATETIME
		);
		INSERT INTO documents (title, slug, content, excerpt, status)
		VALUES ('Legacy', 'legacy-access', 'legacy body', 'legacy excerpt', 'published');
	`)
	if err != nil {
		t.Fatal(err)
	}
	if err := legacy.Close(); err != nil {
		t.Fatal(err)
	}

	db, err := InitDB(&config.Config{
		DBPath: dbPath, UploadDir: t.TempDir(), AdminUser: "admin",
		AdminPass: "test-admin-password", JWTSecret: "test-secret", JWTExpireHrs: 1, SiteName: "test",
	})
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	var accessLevel string
	if err := db.QueryRow("SELECT access_level FROM documents WHERE slug = 'legacy-access'").Scan(&accessLevel); err != nil {
		t.Fatal(err)
	}
	if accessLevel != "public" {
		t.Fatalf("legacy access_level = %q, want public", accessLevel)
	}
}

func TestDocumentRepositoryPersistsAndValidatesAccessLevel(t *testing.T) {
	db := newTestDB(t)
	repo := NewDocumentRepository(db)

	defaultDoc := &model.Document{Title: "Default", Slug: "default-access", Content: "body", Excerpt: "summary", Status: "draft", AuthorID: 1}
	defaultID, err := repo.Create(defaultDoc)
	if err != nil {
		t.Fatal(err)
	}
	gotDefault, err := repo.GetByID(defaultID)
	if err != nil || gotDefault.AccessLevel != "public" {
		t.Fatalf("default document = %#v, err=%v", gotDefault, err)
	}

	restricted := &model.Document{Title: "Restricted", Slug: "restricted-access", Content: "secret body", Excerpt: "secret summary", Status: "published", AccessLevel: "authenticated", AuthorID: 1, SortOrder: 7, IsPinned: true, Tags: []string{"ACL"}}
	restrictedID, err := repo.Create(restricted)
	if err != nil {
		t.Fatal(err)
	}
	got, err := repo.GetByID(restrictedID)
	if err != nil || got.AccessLevel != "authenticated" {
		t.Fatalf("restricted document = %#v, err=%v", got, err)
	}

	got.AccessLevel = "public"
	if err := repo.Update(got); err != nil {
		t.Fatal(err)
	}
	updated, _ := repo.GetByID(restrictedID)
	if updated.AccessLevel != "public" || updated.Title != restricted.Title || updated.Content != restricted.Content || updated.Excerpt != restricted.Excerpt || updated.Status != restricted.Status || updated.SortOrder != restricted.SortOrder || updated.IsPinned != restricted.IsPinned {
		t.Fatalf("normal document fields changed: %#v", updated)
	}

	invalid := &model.Document{Title: "Invalid", Slug: "invalid-access", Status: "draft", AccessLevel: "private", AuthorID: 1}
	if _, err := repo.Create(invalid); !errors.Is(err, ErrInvalidDocumentAccessLevel) {
		t.Fatalf("invalid create error = %v", err)
	}
	updated.AccessLevel = "authenticatedx"
	if err := repo.Update(updated); !errors.Is(err, ErrInvalidDocumentAccessLevel) {
		t.Fatalf("invalid update error = %v", err)
	}
	unchanged, _ := repo.GetByID(restrictedID)
	if unchanged.AccessLevel != "public" {
		t.Fatalf("invalid update changed access level to %q", unchanged.AccessLevel)
	}

	list, _, err := repo.List(DocumentFilter{Page: 1, PageSize: 100})
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, document := range list {
		if document.ID == restrictedID {
			found = true
			if document.AccessLevel != "public" {
				t.Fatalf("admin list access_level = %q", document.AccessLevel)
			}
		}
	}
	if !found {
		t.Fatal("updated document missing from list")
	}
}
