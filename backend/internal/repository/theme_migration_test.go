package repository

import "testing"

func TestMigrateLegacyThemeDefaultsReplacesOnlyExactDefaults(t *testing.T) {
	db := newTestDB(t)

	preparations := []struct {
		key   string
		value string
	}{
		{"site_name", "\u98de\u4e66\u98ce知识库"},
		{"site_subtitle", "极简、优雅的\u98de\u4e66\u98ce只读知识库与博客系统"},
		{"footer_text", "我的自定义版权信息"},
	}
	for _, preparation := range preparations {
		if _, err := db.Exec(`UPDATE settings SET value = ? WHERE key = ?`, preparation.value, preparation.key); err != nil {
			t.Fatalf("prepare legacy setting %s: %v", preparation.key, err)
		}
	}

	if err := migrateLegacyThemeDefaults(db.DB); err != nil {
		t.Fatalf("migrateLegacyThemeDefaults returned error: %v", err)
	}

	wants := map[string]string{
		"site_name":     "知识库",
		"site_subtitle": "简洁、清晰的只读知识库与博客系统",
		"footer_text":   "我的自定义版权信息",
	}
	for key, want := range wants {
		var got string
		if err := db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&got); err != nil {
			t.Fatalf("read %s: %v", key, err)
		}
		if got != want {
			t.Fatalf("%s = %q, want %q", key, got, want)
		}
	}
}

func TestFreshInstallContainsNoLegacyThemeDefaults(t *testing.T) {
	db := newTestDB(t)

	legacyTheme := "\u98de\u4e66\u98ce"
	queries := []string{
		`SELECT COUNT(*) FROM settings WHERE value LIKE '%` + legacyTheme + `%'`,
		`SELECT COUNT(*) FROM categories WHERE description LIKE '%` + legacyTheme + `%'`,
		`SELECT COUNT(*) FROM documents WHERE title LIKE '%` + legacyTheme + `%' OR excerpt LIKE '%` + legacyTheme + `%' OR content LIKE '%` + legacyTheme + `%'`,
	}
	for _, query := range queries {
		var count int
		if err := db.QueryRow(query).Scan(&count); err != nil {
			t.Fatalf("scan legacy defaults: %v", err)
		}
		if count != 0 {
			t.Fatalf("fresh install contains %d legacy theme values for query %q", count, query)
		}
	}
}
