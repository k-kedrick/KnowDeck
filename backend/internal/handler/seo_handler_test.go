package handler

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/internal/service"

	"github.com/gin-gonic/gin"
)

const testFrontendShell = `<!doctype html><html lang="zh-CN"><head><!-- seo:head:start --><title>fallback</title><!-- seo:head:end --><script type="module" src="/assets/index-test.js"></script></head><body><div id="root"></div></body></html>`

func newSEOTestRouter(t *testing.T) (*gin.Engine, *repository.DB) {
	t.Helper()
	directory := t.TempDir()
	cfg := &config.Config{
		Environment:  "development",
		DBPath:       filepath.Join(directory, "seo-test.db"),
		UploadDir:    filepath.Join(directory, "uploads"),
		AdminUser:    "seo-admin",
		AdminPass:    "seo-test-password",
		SiteName:     "测试知识库",
		SiteURL:      "https://kb.example.com",
		JWTSecret:    "seo-test-secret",
		JWTExpireHrs: 24,
		MaxUploadMB:  10,
		MaxImageMB:   10,
		MaxVideoMB:   10,
		MaxFileMB:    10,
	}
	db, err := repository.InitDB(cfg)
	if err != nil {
		t.Fatalf("initialize test database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if _, err := db.Exec("DELETE FROM document_tags; DELETE FROM documents; DELETE FROM tags; DELETE FROM categories"); err != nil {
		t.Fatalf("clear seed content: %v", err)
	}
	categoryResult, err := db.Exec("INSERT INTO categories (name, slug) VALUES (?, ?)", "安全", "security")
	if err != nil {
		t.Fatalf("insert category: %v", err)
	}
	categoryID, _ := categoryResult.LastInsertId()
	if _, err := db.Exec(`
		INSERT INTO documents (title, slug, content, excerpt, cover, status, category_id, author_id, published_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 'published', ?, 1, '2026-08-01T12:00:00Z', '2026-08-02T12:00:00Z'),
		       (?, ?, ?, ?, '', 'draft', ?, 1, NULL, '2026-08-03T12:00:00Z')
	`, `Safe </title><script>alert(1)</script>`, "safe-doc", "# Safe content", "Summary < unsafe", "/uploads/cover.jpg", categoryID,
		"Draft document", "draft-doc", "# Draft", "Draft excerpt", categoryID); err != nil {
		t.Fatalf("insert documents: %v", err)
	}

	docRepo := repository.NewDocumentRepository(db)
	settingService := service.NewSettingService(
		repository.NewSettingRepository(db),
		docRepo,
		repository.NewCategoryRepository(db),
		repository.NewTagRepository(db),
	)
	seo := NewSEOHandler(docRepo, settingService, cfg)
	seo.loadIndex = func() (string, error) { return testFrontendShell, nil }

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/", seo.Home)
	router.GET("/blog", seo.Blog)
	router.GET("/docs/:slug", seo.Article)
	router.GET("/robots.txt", seo.Robots)
	router.GET("/sitemap.xml", seo.Sitemap)
	return router, db
}

func performSEORequest(router http.Handler, target string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, target, nil)
	router.ServeHTTP(recorder, request)
	return recorder
}

func TestSEOArticleShellUsesPublishedDataAndEscapesContent(t *testing.T) {
	router, _ := newSEOTestRouter(t)
	response := performSEORequest(router, "/docs/safe-doc")
	body := response.Body.String()

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", response.Code, body)
	}
	for _, expected := range []string{
		`<html lang="zh-CN">`,
		`Safe &lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt; - 测试知识库`,
		`rel="canonical" href="https://kb.example.com/docs/safe-doc"`,
		`property="og:type" content="article"`,
		`property="article:published_time" content="2026-08-01T12:00:00Z"`,
		`"@type":"TechArticle"`,
		`src="/assets/index-test.js"`,
	} {
		if !strings.Contains(body, expected) {
			t.Errorf("response is missing %q", expected)
		}
	}
	if strings.Contains(body, "</title><script>alert(1)</script>") {
		t.Fatal("article title was injected into the HTML shell without escaping")
	}
}

func TestSEOSitemapAndRobotsOnlyExposePublicRoutes(t *testing.T) {
	router, _ := newSEOTestRouter(t)
	sitemap := performSEORequest(router, "/sitemap.xml")
	if sitemap.Code != http.StatusOK {
		t.Fatalf("expected sitemap status 200, got %d", sitemap.Code)
	}
	body := sitemap.Body.String()
	for _, expected := range []string{"https://kb.example.com/", "https://kb.example.com/blog", "https://kb.example.com/docs/safe-doc", "2026-08-02"} {
		if !strings.Contains(body, expected) {
			t.Errorf("sitemap is missing %q", expected)
		}
	}
	if strings.Contains(body, "draft-doc") {
		t.Fatal("draft document must not appear in sitemap")
	}

	robots := performSEORequest(router, "/robots.txt")
	if robots.Code != http.StatusOK || !strings.Contains(robots.Body.String(), "Sitemap: https://kb.example.com/sitemap.xml") {
		t.Fatalf("unexpected robots response: %d %s", robots.Code, robots.Body.String())
	}
}

func TestSEORestrictedDocumentNeverLeaksBodyOrSitemapURL(t *testing.T) {
	router, db := newSEOTestRouter(t)
	const secret = "SEO-RESTRICTED-SECRET-9F31A7"
	if _, err := db.Exec(`INSERT INTO documents (title, slug, content, excerpt, cover, status, access_level, author_id, published_at) VALUES (?, ?, ?, ?, ?, 'published', 'authenticated', 1, CURRENT_TIMESTAMP)`, "Restricted SEO", "restricted-seo-test", secret, secret, "https://example.invalid/restricted-secret-image.jpg"); err != nil {
		t.Fatal(err)
	}
	article := performSEORequest(router, "/docs/restricted-seo-test")
	if article.Code != http.StatusOK || !strings.Contains(article.Body.String(), `content="noindex,nofollow"`) {
		t.Fatalf("unexpected restricted shell: %d %s", article.Code, article.Body.String())
	}
	for _, forbidden := range []string{secret, "restricted-secret-image.jpg", `"@type":"TechArticle"`} {
		if strings.Contains(article.Body.String(), forbidden) {
			t.Fatalf("restricted SEO shell leaked %q", forbidden)
		}
	}
	sitemap := performSEORequest(router, "/sitemap.xml")
	if strings.Contains(sitemap.Body.String(), "restricted-seo-test") || strings.Contains(sitemap.Body.String(), secret) {
		t.Fatal("restricted document leaked into sitemap")
	}
}

func TestSEOIndexingRulesRedirectAndMissingArticle(t *testing.T) {
	router, _ := newSEOTestRouter(t)

	filteredBlog := performSEORequest(router, "/blog?tag=go&page=2&preview=1")
	for _, expected := range []string{`name="robots" content="noindex,follow"`, `href="https://kb.example.com/blog?page=2&amp;tag=go"`} {
		if !strings.Contains(filteredBlog.Body.String(), expected) {
			t.Errorf("filtered blog response is missing %q", expected)
		}
	}

	missing := performSEORequest(router, "/docs/draft-doc")
	if missing.Code != http.StatusNotFound || !strings.Contains(missing.Body.String(), `content="noindex,nofollow"`) {
		t.Fatalf("draft document should return a noindex 404 shell: %d %s", missing.Code, missing.Body.String())
	}

	legacy := performSEORequest(router, "/?doc=legacy%20doc")
	if legacy.Code != http.StatusPermanentRedirect || legacy.Header().Get("Location") != "/docs/legacy%20doc" {
		t.Fatalf("unexpected legacy redirect: %d %q", legacy.Code, legacy.Header().Get("Location"))
	}
}
