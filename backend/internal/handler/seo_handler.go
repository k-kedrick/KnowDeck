package handler

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"errors"
	stdhtml "html"
	"html/template"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/internal/service"

	"github.com/gin-gonic/gin"
)

const (
	seoHeadStart = "<!-- seo:head:start -->"
	seoHeadEnd   = "<!-- seo:head:end -->"
)

var (
	seoHeadTemplate = template.Must(template.New("seo-head").Parse(`
<title>{{.Title}}</title>
<meta data-seo="description" name="description" content="{{.Description}}" />
<meta data-seo="robots" name="robots" content="{{.Robots}}" />
<meta data-seo="site-url" name="site-url" content="{{.SiteURL}}" />
{{if .Canonical}}<link data-seo="canonical" rel="canonical" href="{{.Canonical}}" />{{end}}
<meta data-seo="og:title" property="og:title" content="{{.Title}}" />
<meta data-seo="og:description" property="og:description" content="{{.Description}}" />
<meta data-seo="og:type" property="og:type" content="{{.OGType}}" />
{{if .Canonical}}<meta data-seo="og:url" property="og:url" content="{{.Canonical}}" />{{end}}
<meta data-seo="og:site_name" property="og:site_name" content="{{.SiteName}}" />
{{if .Image}}<meta data-seo="og:image" property="og:image" content="{{.Image}}" />{{end}}
<meta data-seo="twitter:card" name="twitter:card" content="{{if .Image}}summary_large_image{{else}}summary{{end}}" />
<meta data-seo="twitter:title" name="twitter:title" content="{{.Title}}" />
<meta data-seo="twitter:description" name="twitter:description" content="{{.Description}}" />
{{if .Image}}<meta data-seo="twitter:image" name="twitter:image" content="{{.Image}}" />{{end}}
{{if .PublishedTime}}<meta data-seo="article:published_time" property="article:published_time" content="{{.PublishedTime}}" />{{end}}
{{if .ModifiedTime}}<meta data-seo="article:modified_time" property="article:modified_time" content="{{.ModifiedTime}}" />{{end}}
{{if .Section}}<meta data-seo="article:section" property="article:section" content="{{.Section}}" />{{end}}
{{range .Tags}}<meta data-seo="article:tag" property="article:tag" content="{{.}}" />{{end}}
{{if .JSONLD}}<script id="seo-structured-data" type="application/ld+json">{{.JSONLD}}</script>{{end}}
`))
	codeBlockPattern = regexp.MustCompile("(?s)```.*?```")
	htmlTagPattern   = regexp.MustCompile(`<[^>]+>`)
	markdownPattern  = regexp.MustCompile(`(?m)^[#>*+\-]+|[\x60_*~|]`)
	spacePattern     = regexp.MustCompile(`\s+`)
)

type seoPageMeta struct {
	Title, Description, Robots, SiteURL, Canonical, SiteName, OGType, Image string
	PublishedTime, ModifiedTime, Section                                    string
	Tags                                                                    []string
	JSONLD                                                                  template.JS
}

type SEOHandler struct {
	docRepo        *repository.DocumentRepository
	settingService *service.SettingService
	siteURL        string
	loadIndex      func() (string, error)
}

func NewSEOHandler(docRepo *repository.DocumentRepository, settingService *service.SettingService, cfg *config.Config) *SEOHandler {
	return &SEOHandler{
		docRepo:        docRepo,
		settingService: settingService,
		siteURL:        strings.TrimRight(cfg.SiteURL, "/"),
		loadIndex:      newFrontendIndexLoader(cfg.FrontendIndexPath, cfg.FrontendIndexURL),
	}
}

func newFrontendIndexLoader(path, remoteURL string) func() (string, error) {
	var mutex sync.Mutex
	var cached string
	var cachedAt time.Time
	client := &http.Client{Timeout: 5 * time.Second}
	return func() (string, error) {
		mutex.Lock()
		defer mutex.Unlock()
		if cached != "" && time.Since(cachedAt) < 30*time.Second {
			return cached, nil
		}
		if path != "" {
			if data, err := os.ReadFile(path); err == nil {
				cached = string(data)
				cachedAt = time.Now()
				return cached, nil
			}
		}
		if remoteURL == "" {
			if cached != "" {
				return cached, nil
			}
			return "", errors.New("frontend index is unavailable")
		}
		response, err := client.Get(remoteURL)
		if err != nil {
			if cached != "" {
				return cached, nil
			}
			return "", err
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusOK {
			if cached != "" {
				return cached, nil
			}
			return "", errors.New("frontend index returned non-200 status")
		}
		data, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
		if err != nil {
			if cached != "" {
				return cached, nil
			}
			return "", err
		}
		cached = string(data)
		cachedAt = time.Now()
		return cached, nil
	}
}

func (h *SEOHandler) Home(c *gin.Context) {
	if legacySlug := strings.TrimSpace(c.Query("doc")); legacySlug != "" {
		c.Redirect(http.StatusPermanentRedirect, "/docs/"+url.PathEscape(legacySlug))
		return
	}
	info, err := h.settingService.GetPublicSiteInfo()
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	siteURL := h.requestSiteURL(c)
	jsonLD := safeJSON(map[string]any{
		"@context":    "https://schema.org",
		"@type":       "WebSite",
		"name":        info.SiteName,
		"description": info.SiteSubtitle,
		"url":         siteURL + "/",
	})
	h.render(c, http.StatusOK, seoPageMeta{Title: info.SiteName, Description: info.SiteSubtitle, Robots: "index,follow", SiteURL: siteURL, Canonical: siteURL + "/", SiteName: info.SiteName, OGType: "website", JSONLD: jsonLD})
}

func (h *SEOHandler) Blog(c *gin.Context) {
	info, err := h.settingService.GetPublicSiteInfo()
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	siteURL := h.requestSiteURL(c)
	page, _ := strconv.Atoi(c.Query("page"))
	if page < 1 {
		page = 1
	}
	canonicalQuery := url.Values{}
	if category := strings.TrimSpace(c.Query("category")); category != "" {
		canonicalQuery.Set("category", category)
	}
	if tag := strings.TrimSpace(c.Query("tag")); tag != "" {
		canonicalQuery.Set("tag", tag)
	}
	if page > 1 {
		canonicalQuery.Set("page", strconv.Itoa(page))
	}
	hasUnsupported := false
	for key := range c.Request.URL.Query() {
		if key != "category" && key != "tag" && key != "page" {
			hasUnsupported = true
		}
	}
	filtered := canonicalQuery.Has("category") || canonicalQuery.Has("tag") || hasUnsupported
	canonical := siteURL + "/blog"
	if encoded := canonicalQuery.Encode(); encoded != "" {
		canonical += "?" + encoded
	}
	pageLabel := ""
	if page > 1 {
		pageLabel = " - 第 " + strconv.Itoa(page) + " 页"
	}
	robots := "index,follow"
	if filtered {
		robots = "noindex,follow"
	}
	description := "浏览 " + info.SiteName + " 的技术文章、项目说明与知识库文档" + pageLabel + "。"
	h.render(c, http.StatusOK, seoPageMeta{Title: "文章" + pageLabel + " - " + info.SiteName, Description: description, Robots: robots, SiteURL: siteURL, Canonical: canonical, SiteName: info.SiteName, OGType: "website"})
}

func (h *SEOHandler) Article(c *gin.Context) {
	document, err := h.docRepo.GetBySlug(c.Param("slug"))
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	info, infoErr := h.settingService.GetPublicSiteInfo()
	if infoErr != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	siteURL := h.requestSiteURL(c)
	if document == nil || document.Status != "published" {
		h.render(c, http.StatusNotFound, seoPageMeta{Title: "文章不存在 - " + info.SiteName, Description: "该文章不存在、未发布或地址有误。", Robots: "noindex,nofollow", SiteURL: siteURL, SiteName: info.SiteName, OGType: "website"})
		return
	}

	canonical := siteURL + "/docs/" + url.PathEscape(document.Slug)
	if document.AccessLevel == "authenticated" {
		h.render(c, http.StatusOK, seoPageMeta{Title: document.Title + " - " + info.SiteName, Description: "此内容仅对登录用户开放。", Robots: "noindex,nofollow", SiteURL: siteURL, Canonical: canonical, SiteName: info.SiteName, OGType: "article"})
		return
	}
	description := seoDescription(document.Excerpt, document.Content, 160)
	if description == "" {
		description = document.Title
	}
	image := absoluteSiteURL(siteURL, document.Cover)
	structuredData := map[string]any{
		"@context":         "https://schema.org",
		"@type":            "TechArticle",
		"headline":         document.Title,
		"description":      description,
		"url":              canonical,
		"mainEntityOfPage": canonical,
		"dateModified":     document.UpdatedAt.Format(time.RFC3339),
	}
	if document.PublishedAt != nil {
		structuredData["datePublished"] = document.PublishedAt.Format(time.RFC3339)
	}
	if document.AuthorName != "" {
		structuredData["author"] = map[string]string{"@type": "Person", "name": document.AuthorName}
	}
	if len(document.Tags) > 0 {
		structuredData["keywords"] = document.Tags
	}
	if image != "" {
		structuredData["image"] = image
	}
	meta := seoPageMeta{Title: document.Title + " - " + info.SiteName, Description: description, Robots: "index,follow", SiteURL: siteURL, Canonical: canonical, SiteName: info.SiteName, OGType: "article", Image: image, ModifiedTime: document.UpdatedAt.Format(time.RFC3339), Section: document.CategoryName, Tags: document.Tags, JSONLD: safeJSON(structuredData)}
	if document.PublishedAt != nil {
		meta.PublishedTime = document.PublishedAt.Format(time.RFC3339)
	}
	h.render(c, http.StatusOK, meta)
}

func (h *SEOHandler) Robots(c *gin.Context) {
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte("User-agent: *\nAllow: /\nDisallow: /wang\nDisallow: /api/\n\nSitemap: "+h.requestSiteURL(c)+"/sitemap.xml\n"))
}

type sitemapURL struct {
	Loc     string `xml:"loc"`
	LastMod string `xml:"lastmod,omitempty"`
}

type sitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	XMLNS   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

func (h *SEOHandler) Sitemap(c *gin.Context) {
	documents, err := h.docRepo.ListPublishedForSitemap()
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	siteURL := h.requestSiteURL(c)
	entries := []sitemapURL{{Loc: siteURL + "/"}, {Loc: siteURL + "/blog"}}
	for _, document := range documents {
		entries = append(entries, sitemapURL{Loc: siteURL + "/docs/" + url.PathEscape(document.Slug), LastMod: document.UpdatedAt.Format("2006-01-02")})
	}
	payload, err := xml.MarshalIndent(sitemapURLSet{XMLNS: "http://www.sitemaps.org/schemas/sitemap/0.9", URLs: entries}, "", "  ")
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	c.Data(http.StatusOK, "application/xml; charset=utf-8", append([]byte(xml.Header), payload...))
}

func (h *SEOHandler) requestSiteURL(c *gin.Context) string {
	if h.siteURL != "" {
		return h.siteURL
	}
	host := strings.TrimSpace(c.Request.Host)
	if host == "" || strings.ContainsAny(host, "\r\n") {
		return ""
	}
	scheme := "http"
	if forwarded := strings.Split(c.GetHeader("X-Forwarded-Proto"), ",")[0]; strings.EqualFold(strings.TrimSpace(forwarded), "https") {
		scheme = "https"
	}
	return scheme + "://" + host
}

func (h *SEOHandler) render(c *gin.Context, status int, meta seoPageMeta) {
	baseHTML, err := h.loadIndex()
	if err != nil {
		c.String(http.StatusServiceUnavailable, "frontend shell unavailable")
		return
	}
	start := strings.Index(baseHTML, seoHeadStart)
	end := strings.Index(baseHTML, seoHeadEnd)
	if start < 0 || end < start {
		c.String(http.StatusServiceUnavailable, "frontend shell is missing SEO markers")
		return
	}
	var fragment bytes.Buffer
	if err := seoHeadTemplate.Execute(&fragment, meta); err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	start += len(seoHeadStart)
	result := baseHTML[:start] + fragment.String() + baseHTML[end:]
	c.Data(status, "text/html; charset=utf-8", []byte(result))
}

func safeJSON(value any) template.JS {
	data, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return template.JS(data)
}

func seoDescription(excerpt, content string, maxLength int) string {
	source := strings.TrimSpace(excerpt)
	if source == "" {
		source = content
	}
	source = codeBlockPattern.ReplaceAllString(source, " ")
	source = htmlTagPattern.ReplaceAllString(source, " ")
	source = markdownPattern.ReplaceAllString(source, " ")
	source = spacePattern.ReplaceAllString(stdhtml.UnescapeString(source), " ")
	source = strings.TrimSpace(source)
	runes := []rune(source)
	if len(runes) <= maxLength {
		return source
	}
	return strings.TrimSpace(string(runes[:maxLength-1])) + "…"
}

func absoluteSiteURL(siteURL, value string) string {
	if strings.TrimSpace(value) == "" {
		return ""
	}
	base, baseErr := url.Parse(siteURL + "/")
	reference, refErr := url.Parse(value)
	if baseErr != nil || refErr != nil {
		return ""
	}
	return base.ResolveReference(reference).String()
}
