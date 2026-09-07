package service

import (
	"bytes"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/internal/storage"
	"knowledge-base/backend/pkg/utils"
)

var (
	AllowedImageExts = []string{".jpg", ".jpeg", ".png", ".webp", ".gif"}
	AllowedVideoExts = []string{".mp4", ".webm", ".mov", ".mkv"}
	AllowedFileExts  = []string{".pdf", ".zip", ".rar", ".7z", ".txt", ".docx", ".xlsx", ".pptx", ".md", ".json"}

	DangerousExts = []string{
		".php", ".php3", ".php4", ".php5", ".phtml", ".pht",
		".jsp", ".jspx", ".asp", ".aspx", ".asa", ".asax",
		".exe", ".bat", ".cmd", ".sh", ".bash", ".py", ".pl", ".cgi",
		".dll", ".so", ".vbs", ".ps1", ".jar", ".war",
	}
)

type MediaService struct {
	mediaRepo  *repository.MediaRepository
	folderRepo *repository.MediaFolderRepository
	docRepo    *repository.DocumentRepository
	storage    storage.Storage
	cfg        *config.Config
}

func NewMediaService(mediaRepo *repository.MediaRepository, folderRepo *repository.MediaFolderRepository, docRepo *repository.DocumentRepository, storage storage.Storage, cfg *config.Config) *MediaService {
	return &MediaService{
		mediaRepo:  mediaRepo,
		folderRepo: folderRepo,
		docRepo:    docRepo,
		storage:    storage,
		cfg:        cfg,
	}
}

func (s *MediaService) Upload(file *multipart.FileHeader, folderID int64, documentID int64, docTitle string) (*model.Media, error) {
	if file == nil {
		return nil, errors.New("上传文件为空")
	}

	maxBytes := s.cfg.MaxUploadMB * 1024 * 1024
	if file.Size > maxBytes {
		return nil, fmt.Errorf("文件大小超过上限 (%d MB)", s.cfg.MaxUploadMB)
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		return nil, errors.New("文件缺少有效扩展名")
	}
	if ext == ".svg" || ext == ".svgz" {
		return nil, errors.New("出于同源脚本安全考虑，不支持上传 SVG 文件")
	}

	// 拦截危险文件
	for _, dang := range DangerousExts {
		if ext == dang {
			return nil, fmt.Errorf("禁止上传潜在危险的文件类型: %s", ext)
		}
	}

	// 确定媒体类型
	var mediaType string
	var subDir string

	if utils.IsAllowedExt(ext, AllowedImageExts) {
		mediaType = "image"
		subDir = "images"
	} else if utils.IsAllowedExt(ext, AllowedVideoExts) {
		mediaType = "video"
		subDir = "videos"
	} else if utils.IsAllowedExt(ext, AllowedFileExts) {
		mediaType = "file"
		subDir = "files"
	} else {
		return nil, fmt.Errorf("不支持的文件格式: %s", ext)
	}

	categoryLimitMB := s.maxMBForType(mediaType)
	if file.Size > categoryLimitMB*1024*1024 {
		return nil, fmt.Errorf("%s 文件大小超过上限 (%d MB)", mediaType, categoryLimitMB)
	}

	detectedMime, err := validateFileContent(file, ext)
	if err != nil {
		return nil, err
	}

	// 自动或指定关联文件夹
	folderID = s.ResolveFolderID(folderID, documentID, docTitle)

	// 存储文件
	relPath, url, filename, size, err := s.storage.Save(file, subDir)
	if err != nil {
		return nil, err
	}

	media := &model.Media{
		FolderID:     folderID,
		OriginalName: file.Filename,
		Filename:     filename,
		Path:         relPath,
		URL:          url,
		MediaType:    mediaType,
		MimeType:     detectedMime,
		Size:         size,
		Duration:     0,
		Thumbnail:    "",
	}

	id, err := s.mediaRepo.Create(media)
	if err != nil {
		_ = s.storage.Delete(relPath)
		return nil, fmt.Errorf("写入媒体记录失败: %w", err)
	}

	media.ID = id
	return media, nil
}

func (s *MediaService) maxMBForType(mediaType string) int64 {
	switch mediaType {
	case "image":
		return s.cfg.MaxImageMB
	case "video":
		return s.cfg.MaxVideoMB
	default:
		return s.cfg.MaxFileMB
	}
}

func (s *MediaService) MaxRequestBytes() int64 {
	// Multipart boundaries and headers need a small allowance beyond the file cap.
	return (s.cfg.MaxUploadMB + 1) * 1024 * 1024
}

func validateFileContent(file *multipart.FileHeader, ext string) (string, error) {
	src, err := file.Open()
	if err != nil {
		return "", fmt.Errorf("无法读取上传文件: %w", err)
	}
	defer src.Close()

	header := make([]byte, 512)
	n, err := io.ReadFull(src, header)
	if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
		return "", fmt.Errorf("读取上传文件头失败: %w", err)
	}
	header = header[:n]
	if n == 0 {
		return "", errors.New("不允许上传空文件")
	}

	mimeType, ok := mimeForVerifiedContent(strings.ToLower(ext), header)
	if !ok {
		return "", fmt.Errorf("文件内容与扩展名 %s 不匹配或格式不受支持", ext)
	}
	return mimeType, nil
}

func mimeForVerifiedContent(ext string, header []byte) (string, bool) {
	hasPrefix := func(prefix []byte) bool { return bytes.HasPrefix(header, prefix) }
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg", hasPrefix([]byte{0xff, 0xd8, 0xff})
	case ".png":
		return "image/png", hasPrefix([]byte("\x89PNG\r\n\x1a\n"))
	case ".gif":
		return "image/gif", hasPrefix([]byte("GIF87a")) || hasPrefix([]byte("GIF89a"))
	case ".webp":
		return "image/webp", len(header) >= 12 && string(header[:4]) == "RIFF" && string(header[8:12]) == "WEBP"
	case ".mp4":
		return "video/mp4", len(header) >= 12 && string(header[4:8]) == "ftyp"
	case ".mov":
		return "video/quicktime", len(header) >= 12 && string(header[4:8]) == "ftyp"
	case ".webm":
		return "video/webm", hasPrefix([]byte{0x1a, 0x45, 0xdf, 0xa3})
	case ".mkv":
		return "video/x-matroska", hasPrefix([]byte{0x1a, 0x45, 0xdf, 0xa3})
	case ".pdf":
		return "application/pdf", hasPrefix([]byte("%PDF-"))
	case ".zip":
		return "application/zip", hasPrefix([]byte("PK\x03\x04")) || hasPrefix([]byte("PK\x05\x06"))
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document", hasPrefix([]byte("PK\x03\x04"))
	case ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", hasPrefix([]byte("PK\x03\x04"))
	case ".pptx":
		return "application/vnd.openxmlformats-officedocument.presentationml.presentation", hasPrefix([]byte("PK\x03\x04"))
	case ".rar":
		return "application/vnd.rar", hasPrefix([]byte("Rar!\x1a\x07"))
	case ".7z":
		return "application/x-7z-compressed", hasPrefix([]byte{'7', 'z', 0xbc, 0xaf, 0x27, 0x1c})
	case ".txt", ".md":
		return "text/plain; charset=utf-8", utf8.Valid(header) && !bytes.ContainsRune(header, '\x00')
	case ".json":
		trimmed := bytes.TrimSpace(header)
		return "application/json", utf8.Valid(header) && len(trimmed) > 0 && (json.Valid(trimmed) || (trimmed[0] == '{' || trimmed[0] == '['))
	default:
		return "", false
	}
}

func (s *MediaService) List(filter repository.MediaFilter) ([]*model.Media, int64, error) {
	return s.mediaRepo.List(filter)
}

func (s *MediaService) GetByID(id int64) (*model.Media, error) {
	return s.mediaRepo.GetByID(id)
}

func (s *MediaService) Delete(id int64) error {
	m, err := s.mediaRepo.GetByID(id)
	if err != nil || m == nil {
		return errors.New("媒体文件不存在")
	}

	referenced, docTitle, err := s.mediaRepo.IsReferencedInDocuments(m.Filename, m.URL)
	if err == nil && referenced {
		return fmt.Errorf("该媒体文件仍被文档《%s》引用，暂无法物理删除", docTitle)
	}

	if err := s.mediaRepo.Delete(id); err != nil {
		return err
	}
	if err := s.storage.Delete(m.Path); err != nil {
		return fmt.Errorf("媒体记录已删除，但物理文件删除失败: %w", err)
	}
	return nil
}

func (s *MediaService) GetAbsolutePath(relPath string) (string, error) {
	return s.storage.GetAbsolutePath(relPath)
}

func (s *MediaService) ListFolders() ([]*model.MediaFolder, error) {
	return s.folderRepo.List()
}

func (s *MediaService) CreateFolder(name string, documentID int64) (*model.MediaFolder, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("文件夹名称不能为空")
	}
	folder := &model.MediaFolder{
		Name:       name,
		DocumentID: documentID,
	}
	id, err := s.folderRepo.Create(folder)
	if err != nil {
		return nil, err
	}
	folder.ID = id
	return folder, nil
}

func (s *MediaService) UpdateFolder(id int64, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return errors.New("文件夹名称不能为空")
	}
	return s.folderRepo.Update(id, name)
}

func (s *MediaService) DeleteFolder(id int64, keepMedia bool) error {
	if keepMedia {
		_ = s.mediaRepo.MoveAllFromFolder(id, 0)
	}
	return s.folderRepo.Delete(id)
}

func (s *MediaService) MoveMedia(id int64, folderID int64) error {
	return s.mediaRepo.MoveToFolder(id, folderID)
}

func (s *MediaService) BatchMoveMedia(ids []int64, folderID int64) error {
	return s.mediaRepo.BatchMove(ids, folderID)
}

func (s *MediaService) GetFolderStats() (int64, int64, error) {
	return s.folderRepo.GetStats()
}

func (s *MediaService) ResolveFolderID(folderID int64, documentID int64, docTitle string) int64 {
	if folderID > 0 {
		return folderID
	}
	if documentID > 0 {
		folder, err := s.folderRepo.GetByDocumentID(documentID)
		if err == nil && folder != nil {
			return folder.ID
		}
	}
	folderName := strings.TrimSpace(docTitle)
	if folderName == "" && documentID > 0 && s.docRepo != nil {
		doc, err := s.docRepo.GetByID(documentID)
		if err == nil && doc != nil && doc.Title != "" {
			folderName = doc.Title
		}
	}
	if folderName == "" && documentID > 0 {
		folderName = fmt.Sprintf("文档 #%d", documentID)
	}
	if folderName == "" {
		folderName = "未分类"
		return 0
	}

	// 查找是否已有同名文件夹
	folders, _ := s.folderRepo.List()
	for _, f := range folders {
		if (documentID > 0 && f.DocumentID == documentID) || f.Name == folderName {
			return f.ID
		}
	}

	// 创建新专属文件夹
	newFolder := &model.MediaFolder{
		Name:       folderName,
		DocumentID: documentID,
	}
	newID, err := s.folderRepo.Create(newFolder)
	if err == nil && newID > 0 {
		return newID
	}
	return 0
}

func (s *MediaService) SaveExternalImage(rawURL string, folderID int64, documentID int64, docTitle string) (*model.Media, error) {
	cleanURL := strings.ReplaceAll(rawURL, "&amp;", "&")
	cleanURL = strings.TrimSpace(cleanURL)

	folderID = s.ResolveFolderID(folderID, documentID, docTitle)

	var data []byte
	var ext string
	var mimeType string

	if strings.HasPrefix(cleanURL, "data:image/") {
		parts := strings.SplitN(cleanURL, ",", 2)
		if len(parts) != 2 {
			return nil, errors.New("无效的 Base64 图片数据")
		}
		header := parts[0]
		if strings.Contains(header, "image/png") {
			ext = ".png"
			mimeType = "image/png"
		} else if strings.Contains(header, "image/jpeg") || strings.Contains(header, "image/jpg") {
			ext = ".jpg"
			mimeType = "image/jpeg"
		} else if strings.Contains(header, "image/webp") {
			ext = ".webp"
			mimeType = "image/webp"
		} else if strings.Contains(header, "image/gif") {
			ext = ".gif"
			mimeType = "image/gif"
		} else {
			ext = ".png"
			mimeType = "image/png"
		}
		var err error
		data, err = base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			return nil, fmt.Errorf("Base64 解码失败: %w", err)
		}
	} else if strings.HasPrefix(cleanURL, "http://") || strings.HasPrefix(cleanURL, "https://") {
		client := &http.Client{Timeout: 15 * time.Second}
		req, err := http.NewRequest("GET", cleanURL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
		req.Header.Set("Accept", "image/*")

		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("下载外部图片失败: HTTP %d", resp.StatusCode)
		}

		var errRead error
		data, errRead = io.ReadAll(io.LimitReader(resp.Body, s.cfg.MaxImageMB*1024*1024))
		if errRead != nil {
			return nil, errRead
		}

		cType := resp.Header.Get("Content-Type")
		if strings.Contains(cType, "jpeg") || strings.Contains(cType, "jpg") {
			ext = ".jpg"
			mimeType = "image/jpeg"
		} else if strings.Contains(cType, "webp") {
			ext = ".webp"
			mimeType = "image/webp"
		} else if strings.Contains(cType, "gif") {
			ext = ".gif"
			mimeType = "image/gif"
		} else {
			ext = ".png"
			mimeType = "image/png"
		}
	} else {
		return nil, errors.New("不支持的图片格式")
	}

	hash := fmt.Sprintf("%x", md5.Sum(data))[:12]
	filename := fmt.Sprintf("img_%s_%d%s", hash, time.Now().UnixNano()%10000, ext)

	relPath, url, savedFilename, size, err := s.storage.SaveBytes(data, filename, "images")
	if err != nil {
		return nil, err
	}

	media := &model.Media{
		FolderID:     folderID,
		OriginalName: savedFilename,
		Filename:     savedFilename,
		Path:         relPath,
		URL:          url,
		MediaType:    "image",
		MimeType:     mimeType,
		Size:         size,
		Duration:     0,
		Thumbnail:    "",
	}

	id, err := s.mediaRepo.Create(media)
	if err != nil {
		_ = s.storage.Delete(relPath)
		return nil, fmt.Errorf("写入媒体记录失败: %w", err)
	}

	media.ID = id
	return media, nil
}

func (s *MediaService) LocalizeContentImages(content string, documentID int64, docTitle string) (string, int, error) {
	if content == "" {
		return content, 0, nil
	}

	imgRe := regexp.MustCompile(`(?i)(?:<img\b[^>]*?\bsrc=["']([^"']+)["']|!\[[^\]]*\]\((https?://[^)\s]+|data:image/[^)\s]+)\))`)
	matches := imgRe.FindAllStringSubmatch(content, -1)
	if len(matches) == 0 {
		return content, 0, nil
	}

	folderID := s.ResolveFolderID(0, documentID, docTitle)
	localizedCount := 0
	urlMap := make(map[string]string)

	for _, match := range matches {
		var rawURL string
		if len(match) > 1 && match[1] != "" {
			rawURL = match[1]
		} else if len(match) > 2 && match[2] != "" {
			rawURL = match[2]
		}
		rawURL = strings.TrimSpace(rawURL)
		if rawURL == "" || strings.HasPrefix(rawURL, "/uploads/") || strings.HasPrefix(rawURL, "./uploads/") {
			continue
		}
		if _, seen := urlMap[rawURL]; seen {
			continue
		}

		media, err := s.SaveExternalImage(rawURL, folderID, documentID, docTitle)
		if err == nil && media != nil {
			urlMap[rawURL] = media.URL
			localizedCount++
		}
	}

	newContent := content
	for oldURL, newURL := range urlMap {
		newContent = strings.ReplaceAll(newContent, oldURL, newURL)
	}

	return newContent, localizedCount, nil
}
