package repository

import (
	"testing"

	"knowledge-base/backend/internal/model"
)

func TestSearchAccessLevelScope(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	docs := NewDocumentRepository(db)
	search := NewSearchRepository(db)
	for _, doc := range []*model.Document{
		{Title: "Public search", Slug: "public-search-acl", Content: "shared-acl-keyword", Status: "published", AccessLevel: "public", AuthorID: 1},
		{Title: "Restricted search", Slug: "restricted-search-acl", Content: "shared-acl-keyword restricted-only-acl-token", Status: "published", AccessLevel: "authenticated", AuthorID: 1},
	} {
		if _, err := docs.Create(doc); err != nil {
			t.Fatal(err)
		}
	}
	anonymous, err := search.Search("shared-acl-keyword", 20, true)
	if err != nil || len(anonymous) != 1 || anonymous[0].Slug != "public-search-acl" {
		t.Fatalf("anonymous=%#v err=%v", anonymous, err)
	}
	restricted, err := search.Search("restricted-only-acl-token", 20, true)
	if err != nil || len(restricted) != 0 {
		t.Fatalf("restricted=%#v err=%v", restricted, err)
	}
	authenticated, err := search.Search("restricted-only-acl-token", 20, false)
	if err != nil || len(authenticated) != 1 || authenticated[0].Slug != "restricted-search-acl" {
		t.Fatalf("authenticated=%#v err=%v", authenticated, err)
	}
}
