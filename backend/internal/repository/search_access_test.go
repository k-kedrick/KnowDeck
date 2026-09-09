package repository

import (
	"strings"
	"testing"

	"knowledge-base/backend/internal/model"
)

func TestNormalizeSearchSnippetRemovesHTMLAndBrokenTagEdges(t *testing.T) {
	raw := `...center" class="ace-line old-record-id-example"><strong>https://<mark class="search-highlight">gemini</mark>.google.com/app</strong> 登入填入账号</div...`
	got := normalizeSearchSnippet(raw)
	if strings.Contains(got, "ace-line") || strings.Contains(got, "<strong>") || strings.Contains(got, "</div") {
		t.Fatalf("snippet still contains editor markup: %q", got)
	}
	if !strings.Contains(got, `<mark class="search-highlight">gemini</mark>`) || !strings.Contains(got, "登入填入账号") {
		t.Fatalf("snippet lost useful search context: %q", got)
	}
}

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
