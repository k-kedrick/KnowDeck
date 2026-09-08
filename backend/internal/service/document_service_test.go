package service

import (
	"errors"
	"strings"
	"testing"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
)

func TestDocumentServiceAccessLevelLifecycle(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	documents := repository.NewDocumentRepository(db)
	svc := NewDocumentService(documents, repository.NewCategoryRepository(db))

	created, err := svc.Create(1, model.DocumentSaveReq{Title: "Default access", Slug: "default-access-service", Content: "body"})
	if err != nil || created.AccessLevel != "public" {
		t.Fatalf("default create = %#v, err=%v", created, err)
	}
	restricted, err := svc.Create(1, model.DocumentSaveReq{Title: "Restricted access", Slug: "restricted-access-service", Content: "restricted body", AccessLevel: "authenticated"})
	if err != nil || restricted.AccessLevel != "authenticated" {
		t.Fatalf("authenticated create = %#v, err=%v", restricted, err)
	}
	updated, err := svc.Update(restricted.ID, model.DocumentSaveReq{Title: restricted.Title, Slug: restricted.Slug, Content: restricted.Content, Status: restricted.Status, AccessLevel: "public"})
	if err != nil || updated.AccessLevel != "public" {
		t.Fatalf("access update = %#v, err=%v", updated, err)
	}
	if _, err := svc.Create(1, model.DocumentSaveReq{Title: "Invalid", Slug: "invalid-access-service", AccessLevel: "private"}); err == nil || !strings.Contains(err.Error(), "访问权限") {
		t.Fatalf("invalid access error = %v", err)
	}
	if _, err := repository.NormalizeDocumentAccessLevel("vip"); !errors.Is(err, repository.ErrInvalidDocumentAccessLevel) {
		t.Fatalf("repository validation error = %v", err)
	}
}

func TestNormalizeExcerptStripsPastedHTML(t *testing.T) {
	excerpt := `<p></p><div datapageid="page-id" datalarkhtmlrole="root"><h1>先电脑浏览器登入</h1><p>正文 &amp; 提示</p></div>`
	got := normalizeExcerpt(excerpt)

	if got != "先电脑浏览器登入 正文 & 提示" {
		t.Fatalf("unexpected excerpt: %q", got)
	}
	if strings.ContainsAny(got, "<>") || strings.Contains(got, "datapageid") {
		t.Fatalf("excerpt still contains HTML: %q", got)
	}
}

func TestNormalizeExcerptDropsLegacyMalformedHTMLFragments(t *testing.T) {
	legacy := `<p</p<div datapageid="page-id" datalarkhtmlrole="root"<div datatype="div...`

	if got := normalizeExcerpt(legacy); got != "" {
		t.Fatalf("unexpected repaired excerpt: %q", got)
	}
}

func TestNormalizeExcerptCleansExplicitExcerptAndTruncatesRunes(t *testing.T) {
	if got := normalizeExcerpt(`<strong>简短摘要</strong>`); got != "简短摘要" {
		t.Fatalf("unexpected explicit excerpt: %q", got)
	}

	got := normalizeExcerpt(strings.Repeat("文", 121))
	if len([]rune(got)) != 123 || !strings.HasSuffix(got, "...") {
		t.Fatalf("excerpt was not truncated correctly: %q", got)
	}
}

func TestNormalizeExcerptDoesNotFallBackToDocumentContent(t *testing.T) {
	if got := normalizeExcerpt(""); got != "" {
		t.Fatalf("empty description should remain empty, got %q", got)
	}
}
