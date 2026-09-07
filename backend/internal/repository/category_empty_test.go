package repository

import (
	"path/filepath"
	"testing"

	"knowledge-base/backend/internal/config"
)

func TestCategoryListsRemainEmptyAfterAllCategoriesAreDeleted(t *testing.T) {
	db := newTestDB(t)
	if _, err := db.Exec("DELETE FROM documents; DELETE FROM categories"); err != nil {
		t.Fatalf("clear seeded content: %v", err)
	}

	repo := NewCategoryRepository(db)
	list, err := repo.ListAll()
	if err != nil {
		t.Fatalf("ListAll returned error: %v", err)
	}
	if list == nil || len(list) != 0 {
		t.Fatalf("ListAll = %#v, want a non-nil empty slice", list)
	}
}

func TestRestartDoesNotReseedCategoriesDeletedByAdministrator(t *testing.T) {
	dir := t.TempDir()
	cfg := &config.Config{
		DBPath:       filepath.Join(dir, "app.db"),
		UploadDir:    filepath.Join(dir, "uploads"),
		AdminUser:    "admin",
		AdminPass:    "test-admin-password",
		JWTSecret:    "test-secret",
		JWTExpireHrs: 1,
		MaxUploadMB:  10,
		SiteName:     "test",
	}

	db, err := InitDB(cfg)
	if err != nil {
		t.Fatalf("first InitDB returned error: %v", err)
	}
	if _, err := db.Exec("DELETE FROM documents; DELETE FROM categories"); err != nil {
		t.Fatalf("clear seeded content: %v", err)
	}
	if err := db.Close(); err != nil {
		t.Fatalf("close first database: %v", err)
	}

	reopened, err := InitDB(cfg)
	if err != nil {
		t.Fatalf("second InitDB returned error: %v", err)
	}
	t.Cleanup(func() { _ = reopened.Close() })

	var categoryCount, documentCount int
	if err := reopened.QueryRow("SELECT COUNT(*) FROM categories").Scan(&categoryCount); err != nil {
		t.Fatalf("count categories: %v", err)
	}
	if err := reopened.QueryRow("SELECT COUNT(*) FROM documents").Scan(&documentCount); err != nil {
		t.Fatalf("count documents: %v", err)
	}
	if categoryCount != 0 || documentCount != 0 {
		t.Fatalf("restart reseeded content: categories=%d documents=%d", categoryCount, documentCount)
	}
}
