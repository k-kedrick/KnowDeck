package service

import (
	"bytes"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
	"knowledge-base/backend/internal/storage"
)

func TestMimeForVerifiedContent(t *testing.T) {
	tests := []struct {
		name   string
		ext    string
		header []byte
		wantOK bool
	}{
		{"png", ".png", append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 16)...), true},
		{"jpeg", ".jpg", []byte{0xff, 0xd8, 0xff, 0xdb}, true},
		{"mp4", ".mp4", []byte{0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'}, true},
		{"pdf", ".pdf", []byte("%PDF-1.7"), true},
		{"text", ".md", []byte("# safe markdown"), true},
		{"spoofed png", ".png", []byte("<script>alert(1)</script>"), false},
		{"svg is forbidden", ".svg", []byte("<svg xmlns='http://www.w3.org/2000/svg'/>"), false},
		{"exe renamed zip", ".zip", []byte("MZ executable"), false},
		{"binary renamed text", ".txt", []byte{'a', 0, 'b'}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, ok := mimeForVerifiedContent(tt.ext, tt.header)
			if ok != tt.wantOK {
				t.Fatalf("verification result = %v, want %v", ok, tt.wantOK)
			}
		})
	}
}

func TestChunkUploadCompletesVideoWithoutLoadingWholeFile(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	uploadDir := t.TempDir()
	svc := NewMediaService(
		repository.NewMediaRepository(db), repository.NewMediaFolderRepository(db), repository.NewDocumentRepository(db),
		storage.NewLocalStorage(uploadDir, "/uploads"),
		&config.Config{UploadDir: uploadDir, MaxImageMB: 20, MaxVideoMB: 1024, MaxFileMB: 100, MaxUploadMB: 1024},
	)

	data := make([]byte, chunkUploadSize+1)
	copy(data, []byte{0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'})
	id, chunks, err := svc.StartChunkUpload(ChunkUploadRequest{Filename: "large.mp4", Size: int64(len(data))})
	if err != nil || chunks != 2 {
		t.Fatalf("StartChunkUpload() id=%q chunks=%d err=%v", id, chunks, err)
	}
	for index := 0; index < chunks; index++ {
		start := int64(index) * chunkUploadSize
		end := start + chunkUploadSize
		if end > int64(len(data)) {
			end = int64(len(data))
		}
		if err := svc.SaveChunk(id, index, bytes.NewReader(data[start:end])); err != nil {
			t.Fatalf("SaveChunk(%d): %v", index, err)
		}
	}
	media, err := svc.CompleteChunkUpload(id)
	if err != nil {
		t.Fatalf("CompleteChunkUpload(): %v", err)
	}
	if media.MediaType != "video" || media.Size != int64(len(data)) {
		t.Fatalf("completed media = %#v", media)
	}
	if _, err := os.Stat(filepath.Join(uploadDir, ".chunk_uploads", id)); !os.IsNotExist(err) {
		t.Fatalf("chunk directory should be removed, stat err=%v", err)
	}
}

func TestUploadLimitsByMediaType(t *testing.T) {
	svc := &MediaService{cfg: &config.Config{MaxImageMB: 20, MaxVideoMB: 1024, MaxFileMB: 100, MaxUploadMB: 1024}}
	if got := svc.maxMBForType("image"); got != 20 {
		t.Fatalf("image limit = %d", got)
	}
	if got := svc.maxMBForType("video"); got != 1024 {
		t.Fatalf("video limit = %d", got)
	}
	if got := svc.maxMBForType("file"); got != 100 {
		t.Fatalf("file limit = %d", got)
	}
}

func TestMediaServiceDeleteAndBatchDelete(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	mediaRepo := repository.NewMediaRepository(db)
	folderRepo := repository.NewMediaFolderRepository(db)
	docRepo := repository.NewDocumentRepository(db)
	store := storage.NewLocalStorage(t.TempDir(), "/uploads")
	cfg := &config.Config{
		MaxImageMB:  20,
		MaxVideoMB:  1024,
		MaxFileMB:   100,
		MaxUploadMB: 1024,
	}
	svc := NewMediaService(mediaRepo, folderRepo, docRepo, store, cfg)

	// Create 2 dummy media
	m1ID, err := mediaRepo.Create(&model.Media{
		OriginalName: "safe_image.png",
		Filename:     "safe_uuid.png",
		Path:         "images/safe_uuid.png",
		URL:          "/uploads/images/safe_uuid.png",
		MediaType:    "image",
		Size:         100,
		Source:       "manual upload",
	})
	if err != nil {
		t.Fatalf("create safe media: %v", err)
	}

	m2ID, err := mediaRepo.Create(&model.Media{
		OriginalName: "referenced_image.png",
		Filename:     "ref_uuid.png",
		Path:         "images/ref_uuid.png",
		URL:          "/uploads/images/ref_uuid.png",
		MediaType:    "image",
		Size:         200,
		Source:       "document/editor",
	})
	if err != nil {
		t.Fatalf("create referenced media: %v", err)
	}

	// Create a document referencing m2
	docID, err := docRepo.Create(&model.Document{
		Title:    "Referencing Document",
		Slug:     "ref-doc",
		Status:   "published",
		Content:  "Content using ![Ref](/uploads/images/ref_uuid.png)",
		AuthorID: 1,
	})
	if err != nil {
		t.Fatalf("create doc: %v", err)
	}
	if err := mediaRepo.AddDocumentRef(m2ID, docID); err != nil {
		t.Fatalf("add document ref: %v", err)
	}

	// 1. Single Delete: referenced media should fail and be protected
	err = svc.Delete(m2ID)
	if err == nil {
		t.Fatal("expected error deleting referenced media, got nil")
	}
	if !strings.Contains(err.Error(), "仍被 1 篇文档引用") {
		t.Fatalf("unexpected error message: %v", err)
	}

	// Media m2 should still exist
	m2Got, err := mediaRepo.GetByID(m2ID)
	if err != nil || m2Got == nil {
		t.Fatalf("m2 should still exist in db: %v", err)
	}

	// 2. Batch Delete with both m1 (safe) and m2 (referenced)
	result, err := svc.BatchDelete([]int64{m1ID, m2ID})
	if err != nil {
		t.Fatalf("BatchDelete returned error: %v", err)
	}
	if result.DeletedCount != 1 {
		t.Fatalf("DeletedCount = %d, want 1", result.DeletedCount)
	}
	if result.BlockedCount != 1 {
		t.Fatalf("BlockedCount = %d, want 1", result.BlockedCount)
	}
	if len(result.Blocked) != 1 || result.Blocked[0].ID != m2ID {
		t.Fatalf("Blocked list mismatch: %#v", result.Blocked)
	}
	if len(result.Blocked[0].References) != 1 || result.Blocked[0].References[0].Title != "Referencing Document" {
		t.Fatalf("Blocked references mismatch: %#v", result.Blocked[0].References)
	}

	// m1 should be gone, m2 should remain
	m1Got, _ := mediaRepo.GetByID(m1ID)
	if m1Got != nil {
		t.Fatal("m1 should be deleted from db")
	}
	m2After, _ := mediaRepo.GetByID(m2ID)
	if m2After == nil {
		t.Fatal("m2 should still exist after batch delete")
	}
}

func TestDeleteFolderAlwaysPreservesMediaAndReferences(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	mediaRepo := repository.NewMediaRepository(db)
	folderRepo := repository.NewMediaFolderRepository(db)
	docRepo := repository.NewDocumentRepository(db)
	svc := NewMediaService(mediaRepo, folderRepo, docRepo, storage.NewLocalStorage(t.TempDir(), "/uploads"), &config.Config{MaxImageMB: 20, MaxVideoMB: 1024, MaxFileMB: 100, MaxUploadMB: 1024})

	folderID, err := folderRepo.Create(&model.MediaFolder{Name: "Delete target"})
	if err != nil {
		t.Fatalf("create folder: %v", err)
	}
	docID, err := docRepo.Create(&model.Document{Title: "Referenced media", Slug: "referenced-media", Status: "draft", AuthorID: 1})
	if err != nil {
		t.Fatalf("create document: %v", err)
	}
	mediaID, err := mediaRepo.Create(&model.Media{FolderID: folderID, OriginalName: "kept.png", Filename: "kept.png", Path: "images/kept.png", URL: "/uploads/images/kept.png", MediaType: "image", MimeType: "image/png", Size: 1, Source: "manual upload"})
	if err != nil {
		t.Fatalf("create media: %v", err)
	}
	if err := mediaRepo.AddDocumentRef(mediaID, docID); err != nil {
		t.Fatalf("add document reference: %v", err)
	}
	secondMediaID, err := mediaRepo.Create(&model.Media{FolderID: folderID, OriginalName: "also-kept.png", Filename: "also-kept.png", Path: "images/also-kept.png", URL: "/uploads/images/also-kept.png", MediaType: "image", MimeType: "image/png", Size: 1, Source: "manual upload"})
	if err != nil {
		t.Fatalf("create second media: %v", err)
	}

	if err := svc.DeleteFolder(folderID, false); err != nil {
		t.Fatalf("delete folder with keep_media=false: %v", err)
	}
	media, err := mediaRepo.GetByID(mediaID)
	if err != nil || media == nil || media.FolderID != 0 {
		t.Fatalf("media after folder deletion = %#v, err=%v; want folder_id=0", media, err)
	}
	secondMedia, err := mediaRepo.GetByID(secondMediaID)
	if err != nil || secondMedia == nil || secondMedia.FolderID != 0 {
		t.Fatalf("second media after folder deletion = %#v, err=%v; want folder_id=0", secondMedia, err)
	}
	refs, err := mediaRepo.ReferenceDocuments(mediaID)
	if err != nil || len(refs) != 1 || refs[0].ID != docID {
		t.Fatalf("media references after folder deletion = %#v, err=%v", refs, err)
	}
	unclassifiedID := int64(0)
	unclassified, total, err := mediaRepo.List(repository.MediaFilter{FolderID: &unclassifiedID})
	if err != nil || total != 2 || len(unclassified) != 2 {
		t.Fatalf("unclassified media after folder deletion = %#v, total=%d, err=%v", unclassified, total, err)
	}
	_, unclassifiedCount, _, _, err := folderRepo.GetStats()
	if err != nil || unclassifiedCount != 2 {
		t.Fatalf("unclassified stats after folder deletion = %d, err=%v", unclassifiedCount, err)
	}
	var danglingCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM media m LEFT JOIN media_folders f ON f.id = m.folder_id WHERE m.folder_id > 0 AND f.id IS NULL`).Scan(&danglingCount); err != nil || danglingCount != 0 {
		t.Fatalf("dangling media folder assignments = %d, err=%v", danglingCount, err)
	}
}

func TestUploadWritesExistingDocumentFolderID(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	mediaRepo := repository.NewMediaRepository(db)
	docRepo := repository.NewDocumentRepository(db)
	folderRepo := repository.NewMediaFolderRepository(db)
	svc := NewMediaService(mediaRepo, folderRepo, docRepo, storage.NewLocalStorage(t.TempDir(), "/uploads"), &config.Config{MaxImageMB: 20, MaxVideoMB: 1024, MaxFileMB: 100, MaxUploadMB: 1024})

	docID, err := docRepo.Create(&model.Document{Title: "Folder Binding Test", Slug: "folder-binding-test", Status: "draft", AuthorID: 1})
	if err != nil {
		t.Fatalf("Create document: %v", err)
	}
	var folderID int64
	if err := db.QueryRow(`SELECT id FROM media_folders WHERE document_id = ?`, docID).Scan(&folderID); err != nil {
		t.Fatalf("Get document folder: %v", err)
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "test-folder-binding.png")
	if err != nil {
		t.Fatalf("Create form file: %v", err)
	}
	if _, err := part.Write(append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 32)...)); err != nil {
		t.Fatalf("Write test image: %v", err)
	}
	writer.Close()
	form, err := multipart.NewReader(bytes.NewReader(body.Bytes()), writer.Boundary()).ReadForm(1024 * 1024)
	if err != nil {
		t.Fatalf("Read form: %v", err)
	}
	defer form.RemoveAll()

	media, err := svc.Upload(form.File["file"][0], 0, docID, "Folder Binding Test")
	if err != nil || media.FolderID != folderID {
		t.Fatalf("Upload folder_id=%d err=%v, want %d", media.FolderID, err, folderID)
	}
	persisted, err := mediaRepo.GetByID(media.ID)
	if err != nil || persisted.FolderID != folderID {
		t.Fatalf("Persisted folder_id=%d err=%v, want %d", persisted.FolderID, err, folderID)
	}
}
