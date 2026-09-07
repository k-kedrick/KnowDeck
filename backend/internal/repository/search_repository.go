package repository

import (
	"fmt"
	"strings"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/pkg/utils"
)

type SearchRepository struct {
	db *DB
}

func NewSearchRepository(db *DB) *SearchRepository {
	return &SearchRepository{db: db}
}

func (r *SearchRepository) Search(query string, limit int) ([]*model.SearchResult, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []*model.SearchResult{}, nil
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	// 1. Try SQLite FTS5 search first
	results, err := r.searchFTS5(query, limit)
	if err == nil && len(results) > 0 {
		return results, nil
	}

	// 2. Fallback to standard LIKE search
	return r.searchLike(query, limit)
}

func (r *SearchRepository) searchFTS5(query string, limit int) ([]*model.SearchResult, error) {
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
		WHERE documents_fts MATCH ? AND d.status = 'published'
		ORDER BY rank
		LIMIT ?
	`

	rows, err := r.db.Query(sqlQuery, ftsQuery, limit)
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
		item.UpdatedAt = utils.ParseFlexibleTime(updatedAt)
		results = append(results, &item)
	}

	return results, rows.Err()
}

func (r *SearchRepository) searchLike(query string, limit int) ([]*model.SearchResult, error) {
	kw := "%" + query + "%"
	sqlQuery := `
		SELECT d.id, d.title, d.slug, d.excerpt, d.content,
		       COALESCE(c.name, '') as category_name, COALESCE(c.slug, '') as category_slug,
		       d.updated_at
		FROM documents d
		LEFT JOIN categories c ON d.category_id = c.id
		WHERE d.status = 'published' AND (d.title LIKE ? OR d.content LIKE ? OR d.excerpt LIKE ?)
		ORDER BY d.views DESC, d.updated_at DESC
		LIMIT ?
	`

	rows, err := r.db.Query(sqlQuery, kw, kw, kw, limit)
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
		item.Snippet = snippet
		results = append(results, &item)
	}

	return results, rows.Err()
}
