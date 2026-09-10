package service

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"knowledge-base/backend/internal/model"
)

const chunkUploadSize int64 = 20 * 1024 * 1024

type ChunkUploadRequest struct {
	Filename   string `json:"filename" binding:"required"`
	Size       int64  `json:"size" binding:"required"`
	FolderID   int64  `json:"folder_id"`
	DocumentID int64  `json:"document_id"`
	DocTitle   string `json:"doc_title"`
}

type chunkUploadMeta struct {
	ChunkUploadRequest
	Chunks int `json:"chunks"`
}

func (s *MediaService) StartChunkUpload(req ChunkUploadRequest) (string, int, error) {
	if _, _, _, err := s.validateUpload(req.Filename, req.Size); err != nil {
		return "", 0, err
	}
	base := s.chunkUploadBase()
	if err := os.MkdirAll(base, 0700); err != nil {
		return "", 0, fmt.Errorf("创建分片上传目录失败: %w", err)
	}
	s.cleanupExpiredChunkUploads(base)

	idBytes := make([]byte, 16)
	if _, err := rand.Read(idBytes); err != nil {
		return "", 0, fmt.Errorf("创建上传会话失败: %w", err)
	}
	id := hex.EncodeToString(idBytes)
	meta := chunkUploadMeta{ChunkUploadRequest: req, Chunks: int((req.Size + chunkUploadSize - 1) / chunkUploadSize)}
	dir := filepath.Join(base, id)
	if err := os.Mkdir(dir, 0700); err != nil {
		return "", 0, fmt.Errorf("创建上传会话失败: %w", err)
	}
	encoded, err := json.Marshal(meta)
	if err != nil {
		_ = os.RemoveAll(dir)
		return "", 0, err
	}
	if err := os.WriteFile(filepath.Join(dir, "meta.json"), encoded, 0600); err != nil {
		_ = os.RemoveAll(dir)
		return "", 0, fmt.Errorf("保存上传会话失败: %w", err)
	}
	return id, meta.Chunks, nil
}

func (s *MediaService) SaveChunk(id string, index int, src io.Reader) error {
	meta, dir, err := s.chunkUploadMeta(id)
	if err != nil {
		return err
	}
	if index < 0 || index >= meta.Chunks {
		return errors.New("分片序号无效")
	}
	expected := s.chunkSize(meta, index)
	target := filepath.Join(dir, fmt.Sprintf("%06d.part", index))
	temporary := target + ".uploading"
	file, err := os.OpenFile(temporary, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		if errors.Is(err, os.ErrExist) {
			return errors.New("该分片正在上传，请稍后重试")
		}
		return fmt.Errorf("保存上传分片失败: %w", err)
	}
	n, copyErr := io.Copy(file, io.LimitReader(src, expected+1))
	closeErr := file.Close()
	if copyErr != nil || closeErr != nil || n != expected {
		_ = os.Remove(temporary)
		if copyErr != nil {
			return fmt.Errorf("写入上传分片失败: %w", copyErr)
		}
		return errors.New("上传分片大小不正确")
	}
	if err := os.Rename(temporary, target); err != nil {
		_ = os.Remove(temporary)
		return fmt.Errorf("确认上传分片失败: %w", err)
	}
	return nil
}

func (s *MediaService) CompleteChunkUpload(id string) (*model.Media, error) {
	meta, dir, err := s.chunkUploadMeta(id)
	if err != nil {
		return nil, err
	}
	lock, err := os.OpenFile(filepath.Join(dir, ".finalizing"), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return nil, errors.New("上传正在合并，请稍后重试")
	}
	_ = lock.Close()
	defer os.RemoveAll(dir)

	readers := make([]io.Reader, 0, meta.Chunks)
	closers := make([]io.Closer, 0, meta.Chunks)
	defer func() {
		for _, closer := range closers {
			_ = closer.Close()
		}
	}()
	for index := 0; index < meta.Chunks; index++ {
		partPath := filepath.Join(dir, fmt.Sprintf("%06d.part", index))
		info, err := os.Stat(partPath)
		if err != nil || info.Size() != s.chunkSize(meta, index) {
			return nil, errors.New("上传分片不完整，请重新上传文件")
		}
		part, err := os.Open(partPath)
		if err != nil {
			return nil, fmt.Errorf("读取上传分片失败: %w", err)
		}
		readers = append(readers, part)
		closers = append(closers, part)
	}
	return s.uploadReader(io.MultiReader(readers...), meta.Filename, meta.Size, meta.FolderID, meta.DocumentID, meta.DocTitle)
}

func (s *MediaService) ChunkUploadSize() int64 { return chunkUploadSize }

func (s *MediaService) chunkUploadBase() string {
	return filepath.Join(s.cfg.UploadDir, ".chunk_uploads")
}

func (s *MediaService) chunkUploadMeta(id string) (chunkUploadMeta, string, error) {
	if len(id) != 32 {
		return chunkUploadMeta{}, "", errors.New("上传会话不存在或已过期")
	}
	if _, err := hex.DecodeString(id); err != nil {
		return chunkUploadMeta{}, "", errors.New("上传会话不存在或已过期")
	}
	dir := filepath.Join(s.chunkUploadBase(), id)
	raw, err := os.ReadFile(filepath.Join(dir, "meta.json"))
	if err != nil {
		return chunkUploadMeta{}, "", errors.New("上传会话不存在或已过期")
	}
	var meta chunkUploadMeta
	if err := json.Unmarshal(raw, &meta); err != nil || meta.Chunks < 1 {
		return chunkUploadMeta{}, "", errors.New("上传会话无效")
	}
	return meta, dir, nil
}

func (s *MediaService) chunkSize(meta chunkUploadMeta, index int) int64 {
	remaining := meta.Size - int64(index)*chunkUploadSize
	if remaining < chunkUploadSize {
		return remaining
	}
	return chunkUploadSize
}

func (s *MediaService) cleanupExpiredChunkUploads(base string) {
	entries, err := os.ReadDir(base)
	if err != nil {
		return
	}
	cutoff := time.Now().Add(-24 * time.Hour)
	for _, entry := range entries {
		if info, err := entry.Info(); err == nil && info.IsDir() && info.ModTime().Before(cutoff) {
			_ = os.RemoveAll(filepath.Join(base, entry.Name()))
		}
	}
}
