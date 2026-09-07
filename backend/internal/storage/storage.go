package storage

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"knowledge-base/backend/pkg/utils"
)

type Storage interface {
	Save(file *multipart.FileHeader, subDir string) (path string, url string, filename string, size int64, err error)
	SaveBytes(data []byte, filename string, subDir string) (path string, url string, savedFilename string, size int64, err error)
	Delete(relativePath string) error
	GetAbsolutePath(relativePath string) (string, error)
	Exists(relativePath string) bool
}

type LocalStorage struct {
	BaseDir string
	BaseURL string
}

func NewLocalStorage(baseDir string, baseURL string) *LocalStorage {
	if baseURL == "" {
		baseURL = "/uploads"
	}
	baseURL = strings.TrimSuffix(baseURL, "/")
	return &LocalStorage{
		BaseDir: baseDir,
		BaseURL: baseURL,
	}
}

func (s *LocalStorage) Save(file *multipart.FileHeader, subDir string) (string, string, string, int64, error) {
	now := time.Now()
	year := fmt.Sprintf("%d", now.Year())
	month := fmt.Sprintf("%02d", now.Month())

	// Safe unique filename
	safeName := utils.SafeFilename(file.Filename)

	// Subdir path: e.g., images/2026/08/
	relFolder := filepath.Join(subDir, year, month)
	targetFolder := filepath.Join(s.BaseDir, relFolder)

	if err := os.MkdirAll(targetFolder, 0755); err != nil {
		return "", "", "", 0, fmt.Errorf("创建存储目录失败: %w", err)
	}

	targetFilePath := filepath.Join(targetFolder, safeName)
	relFilePath := filepath.Join(relFolder, safeName)
	relFilePath = filepath.ToSlash(relFilePath)

	src, err := file.Open()
	if err != nil {
		return "", "", "", 0, fmt.Errorf("打开上传文件失败: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(targetFilePath)
	if err != nil {
		return "", "", "", 0, fmt.Errorf("写入文件失败: %w", err)
	}
	defer dst.Close()

	written, err := io.Copy(dst, src)
	if err != nil {
		return "", "", "", 0, fmt.Errorf("保存文件失败: %w", err)
	}

	url := fmt.Sprintf("%s/%s", s.BaseURL, relFilePath)
	return relFilePath, url, safeName, written, nil
}

func (s *LocalStorage) SaveBytes(data []byte, filename string, subDir string) (string, string, string, int64, error) {
	now := time.Now()
	year := fmt.Sprintf("%d", now.Year())
	month := fmt.Sprintf("%02d", now.Month())

	safeName := utils.SafeFilename(filename)
	relFolder := filepath.Join(subDir, year, month)
	targetFolder := filepath.Join(s.BaseDir, relFolder)

	if err := os.MkdirAll(targetFolder, 0755); err != nil {
		return "", "", "", 0, fmt.Errorf("创建存储目录失败: %w", err)
	}

	targetFilePath := filepath.Join(targetFolder, safeName)
	relFilePath := filepath.ToSlash(filepath.Join(relFolder, safeName))

	if err := os.WriteFile(targetFilePath, data, 0644); err != nil {
		return "", "", "", 0, fmt.Errorf("保存文件失败: %w", err)
	}

	url := fmt.Sprintf("%s/%s", s.BaseURL, relFilePath)
	return relFilePath, url, safeName, int64(len(data)), nil
}

func (s *LocalStorage) Delete(relativePath string) error {
	absPath, err := s.GetAbsolutePath(relativePath)
	if err != nil {
		return err
	}
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return nil
	}
	return os.Remove(absPath)
}

func (s *LocalStorage) GetAbsolutePath(relativePath string) (string, error) {
	cleaned := filepath.Clean(relativePath)
	if cleaned == "." || filepath.IsAbs(cleaned) {
		return "", fmt.Errorf("非法的相对路径")
	}
	for _, part := range strings.FieldsFunc(cleaned, func(r rune) bool {
		return r == filepath.Separator || r == '/' || r == '\\'
	}) {
		if part == ".." {
			return "", fmt.Errorf("非法的相对路径")
		}
	}

	baseAbs, err := filepath.Abs(s.BaseDir)
	if err != nil {
		return "", err
	}
	targetAbs, err := filepath.Abs(filepath.Join(baseAbs, cleaned))
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(baseAbs, targetAbs)
	if err != nil {
		return "", err
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return "", fmt.Errorf("非法的相对路径")
	}
	return targetAbs, nil
}

func (s *LocalStorage) Exists(relativePath string) bool {
	absPath, err := s.GetAbsolutePath(relativePath)
	if err != nil {
		return false
	}
	_, err = os.Stat(absPath)
	return err == nil
}
