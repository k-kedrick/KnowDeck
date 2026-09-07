package service

import (
	"strings"
	"testing"
)

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
