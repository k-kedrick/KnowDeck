package repository

import (
	"fmt"
	"html"
	"regexp"
	"strings"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/pkg/utils"
)

const (
	searchMarkOpenToken  = "\x00SEARCH_MARK_OPEN\x00"
	searchMarkCloseToken = "\x00SEARCH_MARK_CLOSE\x00"
)

var (
	searchLeadingTagFragment = regexp.MustCompile(`(?i)^(\.{3})?[^<>]*(?:\s(?:class|style|id|data-[\w-]+)=["'][^"']*["'])[^>]*>`)
	searchHTMLTag            = regexp.MustCompile(`(?s)<[^>]*>`)
	searchDanglingHTMLTag    = regexp.MustCompile(`(?s)<[^>]*$`)
)

func normalizeSearchSnippet(snippet string) string {
	snippet = searchLeadingTagFragment.ReplaceAllString(snippet, "$1")
	snippet = searchDanglingHTMLTag.ReplaceAllString(snippet, " ")
	snippet = strings.ReplaceAll(snippet, `<mark class="search-highlight">`, searchMarkOpenToken)
	snippet = strings.ReplaceAll(snippet, `</mark>`, searchMarkCloseToken)
	snippet = searchHTMLTag.ReplaceAllString(snippet, " ")
	snippet = html.UnescapeString(snippet)
	snippet = strings.Join(strings.Fields(snippet), " ")
	snippet = strings.ReplaceAll(snippet, searchMarkOpenToken, `<mark class="search-highlight">`)
	return strings.ReplaceAll(snippet, searchMarkCloseToken, `</mark>`)
}

type SearchRepository struct {
	db *DB
}

func NewSearchRepository(db *DB) *SearchRepository {
	return &SearchRepository{db: db}
}

func (r *SearchRepository) Search(query string, limit int, publicOnly bool) ([]*model.SearchResult, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []*model.SearchResult{}, nil
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	// 1. Try SQLite FTS5 search first
	results, err := r.searchFTS5(query, limit, publicOnly)
	if err == nil && len(results) > 0 {
		return results, nil
	}

	// 2. Fallback to standard LIKE search
	return r.searchLike(query, limit, publicOnly)
}

func (r *SearchRepository) searchFTS5(query string, limit int, publicOnly bool) ([]*model.SearchResult, error) {
	// Clean query for FTS5 syntax
	cleanQuery := strings.ReplaceAll(query, "\"", "")
	cleanQuery = strings.ReplaceAll(cleanQuery, "'", "")
	cleanQuery = strings.ReplaceAll(cleanQuery, "*", "")
	if cleanQuery == "" {
		return nil, fmt.Errorf("empty query")
	}

	// FTS5 phrase or prefix query
	ftsQuery := fmt.Sprintf("\"%s\" OR %s*", cleanQuery, cleanQuery)

	sqlQuery := `
		SELECT d.id, d.title, d.slug,
		       COALESCE(snippet(documents_fts, 1, '<mark class="search-highlight">', '</mark>', '...', 20), d.excerpt) as snippet,
		       COALESCE(c.name, '') as category_name, COALESCE(c.slug, '') as category_slug,
		       d.updated_at
		FROM documents_fts
		JOIN documents d ON documents_fts.rowid = d.id
		LEFT JOIN categories c ON d.category_id = c.id
		WHERE documents_fts MATCH ? AND d.status = 'published' AND (? = 0 OR d.access_level = 'public')
		ORDER BY rank
		LIMIT ?
	`

	publicScope := 0
	if publicOnly {
		publicScope = 1
	}
	rows, err := r.db.Query(sqlQuery, ftsQuery, publicScope, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []*model.SearchResult
	for rows.Next() {
		var item model.SearchResult
		var updatedAt string
		if err := rows.Scan(&item.ID, &item.Title, &item.Slug, &item.Snippet, &item.CategoryName, &item.CategorySlug, &updatedAt); err != nil {
			return nil, err
		}
		item.Snippet = normalizeSearchSnippet(item.Snippet)
		item.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
		results = append(results, &item)
	}

	return results, rows.Err()
}

func (r *SearchRepository) searchLike(query string, limit int, publicOnly bool) ([]*model.SearchResult, error) {
	kw := "%" + query + "%"
	sqlQuery := `
		SELECT d.id, d.title, d.slug, d.excerpt, d.content,
		       COALESCE(c.name, '') as category_name, COALESCE(c.slug, '') as category_slug,
		       d.updated_at
		FROM documents d
		LEFT JOIN categories c ON d.category_id = c.id
		WHERE d.status = 'published' AND (? = 0 OR d.access_level = 'public') AND (d.title LIKE ? OR d.content LIKE ? OR d.excerpt LIKE ?)
		ORDER BY d.views DESC, d.updated_at DESC
		LIMIT ?
	`

	publicScope := 0
	if publicOnly {
		publicScope = 1
	}
	rows, err := r.db.Query(sqlQuery, publicScope, kw, kw, kw, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []*model.SearchResult
	for rows.Next() {
		var item model.SearchResult
		var excerpt, content, updatedAt string
		if err := rows.Scan(&item.ID, &item.Title, &item.Slug, &excerpt, &content, &item.CategoryName, &item.CategorySlug, &updatedAt); err != nil {
			return nil, err
		}
		item.UpdatedAt = utils.ParseFlexibleTime(updatedAt)

		// Create simple highlighted snippet
		snippet := excerpt
		if snippet == "" {
			runes := []rune(content)
			if len(runes) > 120 {
				snippet = string(runes[:120]) + "..."
			} else {
				snippet = content
			}
		}
		item.Snippet = normalizeSearchSnippet(snippet)
		results = append(results, &item)
	}

	return results, rows.Err()
}
