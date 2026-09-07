package repository

import (
	"testing"
)

func clearTagTestData(t *testing.T, db *DB) {
	t.Helper()
	if _, err := db.Exec("DELETE FROM document_tags; DELETE FROM documents; DELETE FROM tags"); err != nil {
		t.Fatalf("clear tag test data: %v", err)
	}
}

func TestTagGetOrCreateReusesCaseInsensitiveName(t *testing.T) {
	db := newTestDB(t)
	clearTagTestData(t, db)
	repo := NewTagRepository(db)

	first, err := repo.GetOrCreate("Gpt", "gpt")
	if err != nil {
		t.Fatalf("create first tag: %v", err)
	}
	second, err := repo.GetOrCreate("GPT", "gpt-uppercase")
	if err != nil {
		t.Fatalf("reuse tag: %v", err)
	}
	if second.ID != first.ID || second.Name != "Gpt" {
		t.Fatalf("case-insensitive tag was not reused: first=%+v second=%+v", first, second)
	}

	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM tags").Scan(&count); err != nil {
		t.Fatalf("count tags: %v", err)
	}
	if count != 1 {
		t.Fatalf("tag count = %d, want 1", count)
	}
}

func TestTagListsUseAdminAndPublicDocumentScopes(t *testing.T) {
	db := newTestDB(t)
	clearTagTestData(t, db)

	tagResult, err := db.Exec("INSERT INTO tags (name, slug) VALUES ('Go', 'go')")
	if err != nil {
		t.Fatalf("insert tag: %v", err)
	}
	tagID, _ := tagResult.LastInsertId()
	for _, status := range []string{"draft", "published", "archived"} {
		result, err := db.Exec("INSERT INTO documents (title, slug, status) VALUES (?, ?, ?)", status, "tag-count-"+status, status)
		if err != nil {
			t.Fatalf("insert %s document: %v", status, err)
		}
		documentID, _ := result.LastInsertId()
		if _, err := db.Exec("INSERT INTO document_tags (document_id, tag_id) VALUES (?, ?)", documentID, tagID); err != nil {
			t.Fatalf("link %s document: %v", status, err)
		}
	}

	repo := NewTagRepository(db)
	adminTags, err := repo.ListAll()
	if err != nil {
		t.Fatalf("list admin tags: %v", err)
	}
	publicTags, err := repo.ListPublished()
	if err != nil {
		t.Fatalf("list public tags: %v", err)
	}
	if len(adminTags) != 1 || adminTags[0].DocCount != 3 {
		t.Fatalf("admin count = %+v, want 3", adminTags)
	}
	if len(publicTags) != 1 || publicTags[0].DocCount != 1 {
		t.Fatalf("public count = %+v, want 1", publicTags)
	}
}

func TestTagDeleteUnlinksDocumentsWithoutDeletingThem(t *testing.T) {
	db := newTestDB(t)
	clearTagTestData(t, db)

	tagResult, err := db.Exec("INSERT INTO tags (name, slug) VALUES ('Safe delete', 'safe-delete')")
	if err != nil {
		t.Fatalf("insert tag: %v", err)
	}
	tagID, _ := tagResult.LastInsertId()
	documentResult, err := db.Exec("INSERT INTO documents (title, slug, status) VALUES ('Keep me', 'keep-me', 'draft')")
	if err != nil {
		t.Fatalf("insert document: %v", err)
	}
	documentID, _ := documentResult.LastInsertId()
	if _, err := db.Exec("INSERT INTO document_tags (document_id, tag_id) VALUES (?, ?)", documentID, tagID); err != nil {
		t.Fatalf("link document: %v", err)
	}

	repo := NewTagRepository(db)
	if err := repo.Delete(tagID); err != nil {
		t.Fatalf("delete tag: %v", err)
	}
	checks := []struct {
		query string
		id    int64
		want  int
	}{
		{"SELECT COUNT(*) FROM documents WHERE id = ?", documentID, 1},
		{"SELECT COUNT(*) FROM tags WHERE id = ?", tagID, 0},
		{"SELECT COUNT(*) FROM document_tags WHERE tag_id = ?", tagID, 0},
	}
	for _, check := range checks {
		var count int
		if err := db.QueryRow(check.query, check.id).Scan(&count); err != nil {
			t.Fatalf("query deletion result: %v", err)
		}
		if count != check.want {
			t.Fatalf("%s count = %d, want %d", check.query, count, check.want)
		}
	}
}
