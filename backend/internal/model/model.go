package model

import "time"

// User 模型 (管理员)
type User struct {
	ID           int64     `json:"id" db:"id"`
	Username     string    `json:"username" db:"username"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Nickname     string    `json:"nickname" db:"nickname"`
	Avatar       string    `json:"avatar" db:"avatar"`
	Email        string    `json:"email" db:"email"`
	Role         string    `json:"role" db:"role"`
	Status       string    `json:"status" db:"status"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
	AuthVersion  int64     `json:"-" db:"auth_version"`
}

// Category 分类模型 (支持树状层级)
type Category struct {
	ID          int64       `json:"id" db:"id"`
	Name        string      `json:"name" db:"name"`
	Slug        string      `json:"slug" db:"slug"`
	Description string      `json:"description" db:"description"`
	Icon        string      `json:"icon" db:"icon"`
	ParentID    int64       `json:"parent_id" db:"parent_id"`
	SortOrder   int         `json:"sort_order" db:"sort_order"`
	DocCount    int         `json:"doc_count,omitempty"`
	Children    []*Category `json:"children,omitempty"`
	CreatedAt   time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at" db:"updated_at"`
}

// Tag 标签模型
type Tag struct {
	ID        int64     `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Slug      string    `json:"slug" db:"slug"`
	DocCount  int       `json:"doc_count"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// Document 文档模型
type Document struct {
	ID          int64      `json:"id" db:"id"`
	Title       string     `json:"title" db:"title"`
	Slug        string     `json:"slug" db:"slug"`
	Content     string     `json:"content,omitempty" db:"content"`
	Excerpt     string     `json:"excerpt" db:"excerpt"`
	Cover       string     `json:"cover" db:"cover"`
	Status      string     `json:"status" db:"status"`             // draft, published, archived
	AccessLevel string     `json:"access_level" db:"access_level"` // public, authenticated
	CategoryID  int64      `json:"category_id" db:"category_id"`
	AuthorID    int64      `json:"author_id" db:"author_id"`
	SortOrder   int        `json:"sort_order" db:"sort_order"`
	IsPinned    bool       `json:"is_pinned" db:"is_pinned"`
	Views       int        `json:"views" db:"views"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
	PublishedAt *time.Time `json:"published_at,omitempty" db:"published_at"`

	// 关联扩展字段
	CategoryName string   `json:"category_name,omitempty"`
	CategorySlug string   `json:"category_slug,omitempty"`
	AuthorName   string   `json:"author_name,omitempty"`
	Tags         []string `json:"tags,omitempty"`
	ReadingTime  int      `json:"reading_time,omitempty"` // 预估分钟
}

// DocumentNeighbor 上下篇导航
type DocumentNeighbor struct {
	Prev *DocumentSummary `json:"prev"`
	Next *DocumentSummary `json:"next"`
}

// DocumentSummary 摘要
type DocumentSummary struct {
	ID        int64     `json:"id"`
	Title     string    `json:"title"`
	Slug      string    `json:"slug"`
	Excerpt   string    `json:"excerpt"`
	Cover     string    `json:"cover"`
	Views     int       `json:"views"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CategoryTreeNode 知识库树节点 (用于前台左侧导航)
type CategoryTreeNode struct {
	ID          int64               `json:"id"`
	Name        string              `json:"name"`
	Slug        string              `json:"slug"`
	Description string              `json:"description"`
	Icon        string              `json:"icon"`
	Children    []*CategoryTreeNode `json:"children"`
	Documents   []*DocumentSummary  `json:"documents"`
}

// MediaFolder 媒体文件夹模型
type MediaFolder struct {
	ID         int64     `json:"id" db:"id"`
	Name       string    `json:"name" db:"name"`
	DocumentID int64     `json:"document_id" db:"document_id"`
	MediaCount int       `json:"media_count" db:"media_count"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// Media 媒体文件模型
type Media struct {
	ID           int64     `json:"id" db:"id"`
	FolderID     int64     `json:"folder_id" db:"folder_id"`
	OriginalName string    `json:"original_name" db:"original_name"`
	Filename     string    `json:"filename" db:"filename"`
	Path         string    `json:"path" db:"path"`
	URL          string    `json:"url" db:"url"`
	MediaType    string    `json:"media_type" db:"media_type"` // image, video, file
	MimeType     string    `json:"mime_type" db:"mime_type"`
	Size         int64     `json:"size" db:"size"`
	Duration     int       `json:"duration" db:"duration"` // 视频时长(秒)
	Thumbnail    string    `json:"thumbnail" db:"thumbnail"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// Setting 系统配置模型
type Setting struct {
	Key         string    `json:"key" db:"key"`
	Value       string    `json:"value" db:"value"`
	Description string    `json:"description" db:"description"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// SearchResult 搜索结果
type SearchResult struct {
	ID           int64     `json:"id"`
	Title        string    `json:"title"`
	Slug         string    `json:"slug"`
	Snippet      string    `json:"snippet"`
	CategoryName string    `json:"category_name"`
	CategorySlug string    `json:"category_slug"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// DTOs
type LoginReq struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResp struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
}

type ChangePasswordReq struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required"`
}

type UpdateCredentialsReq struct {
	Username        string `json:"username" binding:"required"`
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password"`
}


type DocumentSaveReq struct {
	Title       string   `json:"title" binding:"required"`
	Slug        string   `json:"slug"`
	Content     string   `json:"content"`
	Excerpt     string   `json:"excerpt"`
	Cover       string   `json:"cover"`
	Status      string   `json:"status"`       // draft, published, archived
	AccessLevel string   `json:"access_level"` // public, authenticated
	CategoryID  int64    `json:"category_id"`
	SortOrder   int      `json:"sort_order"`
	IsPinned    bool     `json:"is_pinned"`
	Tags        []string `json:"tags"`
}

type DocumentStatusReq struct {
	Status string `json:"status" binding:"required"`
}

type CategorySaveReq struct {
	Name        string `json:"name" binding:"required"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	ParentID    int64  `json:"parent_id"`
	SortOrder   int    `json:"sort_order"`
}

type TagSaveReq struct {
	Name string `json:"name" binding:"required"`
	Slug string `json:"slug"`
}

type SiteInfoResp struct {
	SiteName      string `json:"site_name"`
	SiteSubtitle  string `json:"site_subtitle"`
	SiteLogo      string `json:"site_logo"`
	FooterText    string `json:"footer_text"`
	AllowDownload bool   `json:"allow_download"`
	DocCount      int    `json:"doc_count"`
	CategoryCount int    `json:"category_count"`
	TagCount      int    `json:"tag_count"`
}

type InviteCode struct {
	ID        int64
	Code      string
	CodeHash  string
	CreatedBy int64
	Remark    string
	Status    string
	MaxUses   *int
	UsedCount int
	ExpiresAt *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

type InviteUserUsage struct {
	UserID       int64     `json:"user_id"`
	Username     string    `json:"username"`
	Nickname     string    `json:"nickname"`
	RegisteredAt time.Time `json:"registered_at"`
}
