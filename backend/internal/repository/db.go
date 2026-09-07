package repository

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/pkg/utils"

	_ "modernc.org/sqlite"
)

type DB struct {
	*sql.DB
}

func InitDB(cfg *config.Config) (*DB, error) {
	dbDir := filepath.Dir(cfg.DBPath)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return nil, fmt.Errorf("创建数据库目录失败: %w", err)
	}

	dsn := fmt.Sprintf("%s?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=synchronous(NORMAL)", cfg.DBPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("打开 SQLite 数据库失败: %w", err)
	}

	db.SetMaxOpenConns(1) // SQLite single writer mode
	db.SetMaxIdleConns(1)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("连接 SQLite 数据库失败: %w", err)
	}

	database := &DB{DB: db}
	if err := database.AutoMigrate(cfg); err != nil {
		return nil, fmt.Errorf("数据库迁移初始化失败: %w", err)
	}

	return database, nil
}

func (db *DB) AutoMigrate(cfg *config.Config) error {
	schema := `
	-- 1. Users
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		nickname TEXT NOT NULL,
		avatar TEXT DEFAULT '',
		email TEXT DEFAULT '',
		role TEXT NOT NULL DEFAULT 'member',
		status TEXT NOT NULL DEFAULT 'active',
		auth_version INTEGER NOT NULL DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- 2. Categories
	CREATE TABLE IF NOT EXISTS categories (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		slug TEXT NOT NULL UNIQUE,
		description TEXT DEFAULT '',
		icon TEXT DEFAULT 'BookOpen',
		parent_id INTEGER DEFAULT 0,
		sort_order INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- 3. Tags
	CREATE TABLE IF NOT EXISTS tags (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		slug TEXT NOT NULL UNIQUE,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- 4. Documents
	CREATE TABLE IF NOT EXISTS documents (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		slug TEXT NOT NULL UNIQUE,
		content TEXT NOT NULL DEFAULT '',
		excerpt TEXT DEFAULT '',
		cover TEXT DEFAULT '',
		status TEXT NOT NULL DEFAULT 'draft',
		category_id INTEGER NOT NULL DEFAULT 0,
		author_id INTEGER NOT NULL DEFAULT 1,
		sort_order INTEGER DEFAULT 0,
		is_pinned BOOLEAN DEFAULT 0,
		views INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		published_at DATETIME
	);

	-- 5. Document Tags
	CREATE TABLE IF NOT EXISTS document_tags (
		document_id INTEGER NOT NULL,
		tag_id INTEGER NOT NULL,
		PRIMARY KEY (document_id, tag_id),
		FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
		FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
	);

	-- 6. Media
	CREATE TABLE IF NOT EXISTS media (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		folder_id INTEGER DEFAULT 0,
		original_name TEXT NOT NULL,
		filename TEXT NOT NULL UNIQUE,
		path TEXT NOT NULL,
		url TEXT NOT NULL,
		media_type TEXT NOT NULL,
		mime_type TEXT NOT NULL,
		size INTEGER NOT NULL,
		duration INTEGER DEFAULT 0,
		thumbnail TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- 7. Settings
	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL,
		description TEXT DEFAULT '',
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_documents_public_order
		ON documents (status, is_pinned DESC, sort_order ASC, published_at DESC, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_documents_category_status
		ON documents (category_id, status);
	CREATE INDEX IF NOT EXISTS idx_document_tags_tag_document
		ON document_tags (tag_id, document_id);

	-- 8. Media Folders
	CREATE TABLE IF NOT EXISTS media_folders (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		document_id INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_media_folders_doc ON media_folders (document_id);

	CREATE TABLE IF NOT EXISTS invite_codes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		code_hash TEXT NOT NULL UNIQUE,
		created_by INTEGER NOT NULL,
		status TEXT NOT NULL DEFAULT 'active',
		max_uses INTEGER DEFAULT 1 CHECK (max_uses IS NULL OR max_uses > 0),
		used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
		expires_at DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (created_by) REFERENCES users(id)
	);
	CREATE INDEX IF NOT EXISTS idx_invite_codes_status ON invite_codes (status);
	`

	if _, err := db.Exec(schema); err != nil {
		return fmt.Errorf("执行基础数据表迁移失败: %w", err)
	}

	// 平滑升级 media 表：检查 folder_id 列是否存在
	var folderColCount int
	_ = db.QueryRow("SELECT COUNT(*) FROM pragma_table_info('media') WHERE name='folder_id'").Scan(&folderColCount)
	if folderColCount == 0 {
		if _, err := db.Exec("ALTER TABLE media ADD COLUMN folder_id INTEGER DEFAULT 0"); err != nil {
			log.Printf("[WARN] 添加 media.folder_id 列失败或已存在: %v", err)
		}
	}
	_, _ = db.Exec("CREATE INDEX IF NOT EXISTS idx_media_folder ON media (folder_id)")

	var statusColCount int
	_ = db.QueryRow("SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='status'").Scan(&statusColCount)
	if statusColCount == 0 {
		if _, err := db.Exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"); err != nil {
			return fmt.Errorf("添加 users.status 列失败: %w", err)
		}
	}
	_, _ = db.Exec("UPDATE users SET role = 'admin', status = 'active' WHERE role IS NULL OR role = '' OR role = 'admin'")

	var authVersionColCount int
	_ = db.QueryRow("SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='auth_version'").Scan(&authVersionColCount)
	if authVersionColCount == 0 {
		if _, err := db.Exec("ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1"); err != nil {
			return fmt.Errorf("添加 users.auth_version 列失败: %w", err)
		}
	}

	// 初始化 FTS5 全文搜索表与触发器 (容错处理)
	ftsSchema := `
	CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
		title,
		content,
		excerpt,
		content='documents',
		content_rowid='id',
		tokenize='unicode61'
	);

	CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
		INSERT INTO documents_fts(rowid, title, content, excerpt) VALUES (new.id, new.title, new.content, new.excerpt);
	END;

	CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
		INSERT INTO documents_fts(documents_fts, rowid, title, content, excerpt) VALUES('delete', old.id, old.title, old.content, old.excerpt);
	END;

	CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
		INSERT INTO documents_fts(documents_fts, rowid, title, content, excerpt) VALUES('delete', old.id, old.title, old.content, old.excerpt);
		INSERT INTO documents_fts(rowid, title, content, excerpt) VALUES (new.id, new.title, new.content, new.excerpt);
	END;
	`
	if _, err := db.Exec(ftsSchema); err != nil {
		log.Printf("[WARN] 初始化 FTS5 表告警 (将使用 LIKE 降级搜索): %v", err)
	}

	// 初始默认数据播种
	return db.seedInitialData(cfg)
}

func (db *DB) seedInitialData(cfg *config.Config) error {
	// 将旧版本默认管理员账号迁移为当前配置的管理员账号。
	// 仅在目标用户名不存在时执行，避免覆盖用户已主动创建的账号。
	if cfg.AdminUser != "admin" {
		var targetCount int
		if err := db.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", cfg.AdminUser).Scan(&targetCount); err != nil {
			return fmt.Errorf("检查管理员账号迁移状态失败: %w", err)
		}
		if targetCount == 0 {
			if _, err := db.Exec("UPDATE users SET username = ? WHERE username = 'admin'", cfg.AdminUser); err != nil {
				return fmt.Errorf("迁移管理员账号失败: %w", err)
			}
		}
	}

	// 1. 种子管理员
	var userCount int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&userCount); err != nil {
		return fmt.Errorf("检查管理员初始化状态失败: %w", err)
	}
	isFreshInstall := userCount == 0
	if isFreshInstall {
		hash, err := utils.HashPassword(cfg.AdminPass)
		if err != nil {
			return err
		}
		_, err = db.Exec(`
			INSERT INTO users (username, password_hash, nickname, email, role)
			VALUES (?, ?, ?, ?, 'admin')
		`, cfg.AdminUser, hash, "知识库管理员", "admin@example.com")
		if err != nil {
			return fmt.Errorf("创建初始管理员失败: %w", err)
		}
		log.Printf("[INIT] 初始管理员创建成功: 用户名=%s", cfg.AdminUser)
	}

	// 2. 种子系统设置
	defaultSettings := map[string]string{
		"site_name":      cfg.SiteName,
		"site_subtitle":  "简洁、清晰的只读知识库与博客系统",
		"site_logo":      "",
		"footer_text":    "© 2026 知识库. All Rights Reserved. Built with Go & React.",
		"allow_download": "true",
		"show_author":    "true",
		"show_views":     "true",
	}

	for k, v := range defaultSettings {
		_, _ = db.Exec(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, k, v)
	}
	if err := migrateLegacyThemeDefaults(db.DB); err != nil {
		return fmt.Errorf("迁移旧主题默认内容失败: %w", err)
	}

	// 3. 仅在首次安装时播种演示分类与文档。不能只根据分类为空判断，
	// 否则管理员主动删除全部分类后，服务重启会把演示内容重新创建出来。
	var catCount int
	if err := db.QueryRow("SELECT COUNT(*) FROM categories").Scan(&catCount); err != nil {
		return fmt.Errorf("检查演示内容初始化状态失败: %w", err)
	}
	if isFreshInstall && catCount == 0 {
		res, err := db.Exec(`
			INSERT INTO categories (name, slug, description, icon, parent_id, sort_order)
			VALUES ('使用指南', 'guide', '知识库快速上手与云端文档阅读体验介绍', 'BookOpen', 0, 1)
		`)
		if err == nil {
			catID, _ := res.LastInsertId()

			// 创建子分类
			resSub, _ := db.Exec(`
				INSERT INTO categories (name, slug, description, icon, parent_id, sort_order)
				VALUES ('排版与语法', 'formatting', 'Markdown 与扩展排版组件演示', 'FileText', ?, 1)
			`, catID)
			subCatID, _ := resSub.LastInsertId()

			// 插入演示文档
			demoDoc1 := "# 欢迎使用只读知识库系统\n\n" +
				"这是一个基于 **Go + Gin + SQLite** 与 **React + TypeScript + Vite + Tailwind CSS** 打造的现代化、高颜值知识库系统。\n\n" +
				"> [!NOTE]\n" +
				"> 本知识库专为低资源（2 CPU / 2GB RAM）且运行关键服务的服务器优化，内存占用低至 **30MB**，且与现有生产服务（如 3X-UI / Xray）完全隔离。\n\n" +
				"---\n\n" +
				"## 🌟 核心特性\n\n" +
				"- **云端文档阅读体验**：左侧树状目录导航、右侧滚动联动文章大纲 (TOC)。\n" +
				"- **严格只读访客模式**：普通访客只能阅读与搜索，后端 API 层面阻断任何写操作。\n" +
				"- **全方位富文本支持**：支持 GFM 表格、任务列表、代码高亮复制、数学公式 (KaTeX)、流程图 (Mermaid)、提示框 (Callouts)。\n" +
				"- **内置富媒体播放**：文档内直接嵌入现代自适应视频播放器与大图画廊预览。\n" +
				"- **全文检索**：毫秒级全文匹配，支持快捷键搜索。\n\n" +
				"---\n\n" +
				"## 💡 提示框 (Callouts) 演示\n\n" +
				"> [!TIP]\n" +
				"> 这是一个 **TIP** 提示框，用于展示最佳实践、操作技巧或温馨提示。\n\n" +
				"> [!WARNING]\n" +
				"> 这是一个 **WARNING** 警告提示框，提醒注意潜在风险与注意事项。\n\n" +
				"---\n\n" +
				"## 💻 代码高亮演示\n\n" +
				"```go\n" +
				"package main\n\n" +
				"import (\n" +
				"\t\"fmt\"\n" +
				"\t\"net/http\"\n" +
				")\n\n" +
				"func main() {\n" +
				"\tfmt.Println(\"🚀 Knowledge Base Server Running on :3799\")\n" +
				"\thttp.ListenAndServe(\":8090\", nil)\n" +
				"}\n" +
				"```\n\n" +
				"---\n\n" +
				"## 📊 表格与任务列表演示\n\n" +
				"| 特性分类 | 支持能力 | 性能表现 |\n" +
				"| :--- | :--- | :--- |\n" +
				"| **存储引擎** | SQLite + WAL + FTS5 | 单文件免运维，极速查询 |\n" +
				"| **前端架构** | React 19 + Tailwind CSS | 秒开响应，流畅无卡顿 |\n" +
				"| **媒体支持** | 图片画廊 / 视频播放 / 附件 | 严密白名单与路径防穿越 |\n\n" +
				"- [x] 搭建 Go 极简分层后端\n" +
				"- [x] 云端文档三栏排版\n" +
				"- [x] Markdown 实时双栏编辑器\n" +
				"- [x] 零冲突独立 Nginx 反代部署\n\n" +
				"---\n\n" +
				"## 📐 数学公式 (KaTeX)\n\n" +
				"$$\n" +
				"E = mc^2 \\quad \\text{与} \\quad \\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n" +
				"$$\n\n" +
				"感谢使用知识库系统！"

			_, _ = db.Exec(`
				INSERT INTO documents (title, slug, content, excerpt, status, category_id, author_id, is_pinned, views, published_at)
				VALUES (?, 'welcome-to-knowledge-base', ?, '欢迎使用只读知识库系统，体验清晰排版与高效阅读。', 'published', ?, 1, 1, 42, CURRENT_TIMESTAMP)
			`, "欢迎使用只读知识库系统", demoDoc1, subCatID)
		}
	}

	return nil
}

func migrateLegacyThemeDefaults(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	settingReplacements := []struct {
		key     string
		legacy  string
		current string
	}{
		{"site_name", "\u98de\u4e66\u98ce\u77e5\u8bc6\u5e93", "知识库"},
		{"site_name", "\u98de\u4e66\u98ce\u53ea\u8bfb\u77e5\u8bc6\u5e93", "知识库"},
		{"site_subtitle", "\u6781\u7b80\u3001\u4f18\u96c5\u7684\u98de\u4e66\u98ce\u53ea\u8bfb\u77e5\u8bc6\u5e93\u4e0e\u535a\u5ba2\u7cfb\u7edf", "简洁、清晰的只读知识库与博客系统"},
		{"footer_text", "© 2026 \u98de\u4e66\u98ce\u683c\u77e5\u8bc6\u5e93. All Rights Reserved. Built with Go & React.", "© 2026 知识库. All Rights Reserved. Built with Go & React."},
		{"footer_text", "© 2026 \u98de\u4e66\u98ce\u683c\u77e5\u8bc6\u5e93. All Rights Reserved.", "© 2026 知识库. All Rights Reserved."},
	}
	for _, replacement := range settingReplacements {
		if _, err := tx.Exec(`UPDATE settings SET value = ? WHERE key = ? AND value = ?`, replacement.current, replacement.key, replacement.legacy); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(`
		UPDATE categories
		SET description = '知识库快速上手与云端文档阅读体验介绍'
		WHERE slug = 'guide' AND description = ?
	`, "知识库快速上手与\u98de\u4e66\u98ce阅读体验介绍"); err != nil {
		return err
	}

	if _, err := tx.Exec(`
		UPDATE documents
		SET title = '欢迎使用只读知识库系统',
			slug = 'welcome-to-knowledge-base',
			excerpt = '欢迎使用只读知识库系统，体验清晰排版与高效阅读。',
			content = replace(replace(replace(replace(replace(content, ?, ?), ?, ?), ?, ?), ?, ?), ?, ?)
		WHERE slug = 'welcome-to-feishu-kb' AND title = ?
	`,
		"欢迎使用\u98de\u4e66\u98ce只读知识库系统", "欢迎使用只读知识库系统",
		"飞书/Notion 阅读体验", "云端文档阅读体验",
		"Feishu Knowledge Base Server Running", "Knowledge Base Server Running",
		"飞书三栏优雅排版", "云端文档三栏排版",
		"感谢使用\u98de\u4e66\u98ce知识库系统", "感谢使用知识库系统",
		"欢迎使用\u98de\u4e66\u98ce只读知识库系统",
	); err != nil {
		return err
	}

	return tx.Commit()
}
