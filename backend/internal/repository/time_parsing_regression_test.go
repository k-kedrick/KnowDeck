package repository

import (
	"testing"

	"knowledge-base/backend/internal/model"
)

// TestSQLiteTimestampParsingRegression verifies that SQLite CURRENT_TIMESTAMP
// string format ("YYYY-MM-DD HH:MM:SS") is correctly parsed into non-zero time.Time
// across MediaRepository, SearchRepository, UserRepository, and SettingRepository.
func TestSQLiteTimestampParsingRegression(t *testing.T) {
	db := newTestDB(t)

	t.Run("MediaRepository_CreatedAt_NonZero", func(t *testing.T) {
		mediaRepo := NewMediaRepository(db)

		id, err := mediaRepo.Create(&model.Media{
			OriginalName: "test-image.png",
			Filename:     "abc-123.png",
			Path:         "images/abc-123.png",
			URL:          "/uploads/images/abc-123.png",
			MediaType:    "image",
			MimeType:     "image/png",
			Size:         1024,
		})
		if err != nil {
			t.Fatalf("mediaRepo.Create failed: %v", err)
		}

		// Verify GetByID
		m, err := mediaRepo.GetByID(id)
		if err != nil {
			t.Fatalf("mediaRepo.GetByID failed: %v", err)
		}
		if m == nil {
			t.Fatal("expected media record, got nil")
		}
		if m.CreatedAt.IsZero() {
			t.Fatalf("media.CreatedAt is zero time (%v), want parsed SQLite CURRENT_TIMESTAMP", m.CreatedAt)
		}
		if m.CreatedAt.Year() < 2020 {
			t.Fatalf("media.CreatedAt year %d is suspiciously old (zero time fallback)", m.CreatedAt.Year())
		}

		// Verify List
		list, total, err := mediaRepo.List(MediaFilter{Page: 1, PageSize: 10})
		if err != nil {
			t.Fatalf("mediaRepo.List failed: %v", err)
		}
		if total == 0 || len(list) == 0 {
			t.Fatalf("expected at least 1 media item, got total=%d len=%d", total, len(list))
		}
		if list[0].CreatedAt.IsZero() {
			t.Fatalf("list[0].CreatedAt is zero time (%v), want parsed SQLite CURRENT_TIMESTAMP", list[0].CreatedAt)
		}
	})

	t.Run("SearchRepository_UpdatedAt_NonZero", func(t *testing.T) {
		docRepo := NewDocumentRepository(db)
		searchRepo := NewSearchRepository(db)

		doc := &model.Document{
			Title:   "Search Time Regression Document",
			Slug:    "search-time-regression-doc",
			Content: "FTS5 search indexing keyword searchable_time_test content",
			Excerpt: "searchable_time_test excerpt",
			Status:  "published",
		}
		_, err := docRepo.Create(doc)
		if err != nil {
			t.Fatalf("docRepo.Create failed: %v", err)
		}

		// 1. Test FTS5 search path
		results, err := searchRepo.Search("searchable_time_test", 10, true)
		if err != nil {
			t.Fatalf("searchRepo.Search failed: %v", err)
		}
		if len(results) == 0 {
			t.Fatal("expected search results for searchable_time_test, got 0")
		}
		for _, res := range results {
			if res.UpdatedAt.IsZero() {
				t.Fatalf("search result UpdatedAt is zero time (%v), want parsed SQLite timestamp", res.UpdatedAt)
			}
			if res.UpdatedAt.Year() < 2020 {
				t.Fatalf("search result UpdatedAt year %d is suspiciously old", res.UpdatedAt.Year())
			}
		}

		// 2. Test LIKE search path directly
		likeResults, err := searchRepo.searchLike("searchable_time_test", 10, true)
		if err != nil {
			t.Fatalf("searchRepo.searchLike failed: %v", err)
		}
		if len(likeResults) == 0 {
			t.Fatal("expected searchLike results, got 0")
		}
		for _, res := range likeResults {
			if res.UpdatedAt.IsZero() {
				t.Fatalf("searchLike result UpdatedAt is zero time (%v), want parsed SQLite timestamp", res.UpdatedAt)
			}
			if res.UpdatedAt.Year() < 2020 {
				t.Fatalf("searchLike result UpdatedAt year %d is suspiciously old", res.UpdatedAt.Year())
			}
		}
	})

	t.Run("UserRepository_CreatedAt_UpdatedAt_NonZero", func(t *testing.T) {
		userRepo := NewUserRepository(db)

		// Seed admin is created by InitDB with CURRENT_TIMESTAMP
		adminUser, err := userRepo.GetByUsername("admin")
		if err != nil {
			t.Fatalf("userRepo.GetByUsername failed: %v", err)
		}
		if adminUser == nil {
			t.Fatal("expected seed admin user, got nil")
		}
		if adminUser.CreatedAt.IsZero() {
			t.Fatalf("adminUser.CreatedAt is zero time (%v), want parsed SQLite timestamp", adminUser.CreatedAt)
		}
		if adminUser.UpdatedAt.IsZero() {
			t.Fatalf("adminUser.UpdatedAt is zero time (%v), want parsed SQLite timestamp", adminUser.UpdatedAt)
		}

		// Verify GetByID
		byIdUser, err := userRepo.GetByID(adminUser.ID)
		if err != nil {
			t.Fatalf("userRepo.GetByID failed: %v", err)
		}
		if byIdUser.CreatedAt.IsZero() {
			t.Fatalf("byIdUser.CreatedAt is zero time (%v)", byIdUser.CreatedAt)
		}
		if byIdUser.UpdatedAt.IsZero() {
			t.Fatalf("byIdUser.UpdatedAt is zero time (%v)", byIdUser.UpdatedAt)
		}
	})

	t.Run("SettingRepository_UpdatedAt_NonZero", func(t *testing.T) {
		settingRepo := NewSettingRepository(db)

		if err := settingRepo.Set("test_site_notice", "Hello 2026"); err != nil {
			t.Fatalf("settingRepo.Set failed: %v", err)
		}

		list, err := settingRepo.GetSettingsList()
		if err != nil {
			t.Fatalf("settingRepo.GetSettingsList failed: %v", err)
		}
		if len(list) == 0 {
			t.Fatal("expected settings in list, got 0")
		}

		var found bool
		for _, s := range list {
			if s.Key == "test_site_notice" {
				found = true
				if s.UpdatedAt.IsZero() {
					t.Fatalf("setting.UpdatedAt is zero time (%v), want parsed SQLite timestamp", s.UpdatedAt)
				}
				if s.UpdatedAt.Year() < 2020 {
					t.Fatalf("setting.UpdatedAt year %d is suspiciously old", s.UpdatedAt.Year())
				}
			}
		}
		if !found {
			t.Fatal("test_site_notice setting was not found in list")
		}
	})
}
