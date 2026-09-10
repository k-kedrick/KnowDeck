package repository

import (
	"testing"

	"knowledge-base/backend/internal/model"
)

func TestMediaRepositoryCRUDAndFilters(t *testing.T) {
	db := newTestDB(t)
	repo := NewMediaRepository(db)
	folderRepo := NewMediaFolderRepository(db)

	folderID, err := folderRepo.Create(&model.MediaFolder{Name: "Screenshots"})
	if err != nil {
		t.Fatalf("Create folder failed: %v", err)
	}

	m1 := &model.Media{
		FolderID:     0,
		OriginalName: "Alpha Image.png",
		Filename:     "uuid-1.png",
		Path:         "images/uuid-1.png",
		URL:          "/uploads/images/uuid-1.png",
		MediaType:    "image",
		MimeType:     "image/png",
		Size:         1024,
		Source:       "manual upload",
	}
	id1, err := repo.Create(m1)
	if err != nil {
		t.Fatalf("Create media 1 failed: %v", err)
	}

	m2 := &model.Media{
		FolderID:     folderID,
		OriginalName: "Beta Video.mp4",
		Filename:     "uuid-2.mp4",
		Path:         "videos/uuid-2.mp4",
		URL:          "/uploads/videos/uuid-2.mp4",
		MediaType:    "video",
		MimeType:     "video/mp4",
		Size:         2048,
		Source:       "document/editor",
	}
	id2, err := repo.Create(m2)
	if err != nil {
		t.Fatalf("Create media 2 failed: %v", err)
	}

	// 1. GetByID
	got1, err := repo.GetByID(id1)
	if err != nil || got1 == nil {
		t.Fatalf("GetByID(id1) error = %v, got = %#v", err, got1)
	}
	if got1.OriginalName != "Alpha Image.png" || got1.Source != "manual upload" {
		t.Fatalf("unexpected media 1 data: %#v", got1)
	}

	// 2. Filter All
	all, total, err := repo.List(MediaFilter{})
	if err != nil || total != 2 || len(all) != 2 {
		t.Fatalf("List all: total=%d len=%d err=%v", total, len(all), err)
	}

	// 3. Filter Unclassified (FolderID = 0)
	unclassifiedFolderID := int64(0)
	unclassified, totalUnclassified, err := repo.List(MediaFilter{FolderID: &unclassifiedFolderID})
	if err != nil || totalUnclassified != 1 || len(unclassified) != 1 || unclassified[0].ID != id1 {
		t.Fatalf("List unclassified failed: total=%d err=%v", totalUnclassified, err)
	}

	// 4. Filter Folder
	inFolder, totalInFolder, err := repo.List(MediaFilter{FolderID: &folderID})
	if err != nil || totalInFolder != 1 || len(inFolder) != 1 || inFolder[0].ID != id2 {
		t.Fatalf("List in folder failed: total=%d err=%v", totalInFolder, err)
	}

	// 5. BatchMove
	if err := repo.BatchMove([]int64{id1}, folderID); err != nil {
		t.Fatalf("BatchMove failed: %v", err)
	}
	moved, err := repo.GetByID(id1)
	if err != nil || moved.FolderID != folderID {
		t.Fatalf("FolderID after batch move = %d, want %d", moved.FolderID, folderID)
	}
}

func TestMediaDocumentReferencesAndSync(t *testing.T) {
	db := newTestDB(t)
	mediaRepo := NewMediaRepository(db)
	docRepo := NewDocumentRepository(db)
	folderRepo := NewMediaFolderRepository(db)

	m1ID, _ := mediaRepo.Create(&model.Media{
		OriginalName: "Chart.png",
		Filename:     "chart-uuid.png",
		Path:         "images/chart-uuid.png",
		URL:          "/uploads/images/chart-uuid.png",
		MediaType:    "image",
		Size:         500,
	})

	m2ID, _ := mediaRepo.Create(&model.Media{
		OriginalName: "Unused.png",
		Filename:     "unused-uuid.png",
		Path:         "images/unused-uuid.png",
		URL:          "/uploads/images/unused-uuid.png",
		MediaType:    "image",
		Size:         600,
	})

	docID1, err := docRepo.Create(&model.Document{
		Title:    "Gemini Tutorial",
		Slug:     "gemini-tutorial",
		Status:   "published",
		Content:  "Here is our chart: ![Chart](/uploads/images/chart-uuid.png)",
		AuthorID: 1,
	})
	if err != nil {
		t.Fatalf("Create doc 1 failed: %v", err)
	}

	docID2, err := docRepo.Create(&model.Document{
		Title:    "Architecture Guide",
		Slug:     "arch-guide",
		Status:   "published",
		Content:  "Embedded image: <img src='/uploads/images/chart-uuid.png'>",
		AuthorID: 1,
	})
	if err != nil {
		t.Fatalf("Create doc 2 failed: %v", err)
	}

	// 1. Rebuild / Sync references
	count, err := mediaRepo.RebuildReferences()
	if err != nil {
		t.Fatalf("RebuildReferences failed: %v", err)
	}
	if count < 2 {
		t.Fatalf("RebuildReferences count = %d, want at least 2", count)
	}

	// Check refs for m1
	refs, err := mediaRepo.ReferenceDocuments(m1ID)
	if err != nil {
		t.Fatalf("ReferenceDocuments(m1ID) failed: %v", err)
	}
	if len(refs) != 2 {
		t.Fatalf("m1 reference count = %d, want 2", len(refs))
	}

	// Check refs for m2
	refsUnused, err := mediaRepo.ReferenceDocuments(m2ID)
	if err != nil {
		t.Fatalf("ReferenceDocuments(m2ID) failed: %v", err)
	}
	if len(refsUnused) != 0 {
		t.Fatalf("m2 reference count = %d, want 0", len(refsUnused))
	}

	// 2. Filter Unused = true
	isUnused := true
	unusedList, unusedTotal, err := mediaRepo.List(MediaFilter{Unused: &isUnused})
	if err != nil || unusedTotal != 1 || len(unusedList) != 1 || unusedList[0].ID != m2ID {
		t.Fatalf("List unused: total=%d len=%d want m2ID", unusedTotal, len(unusedList))
	}

	// 3. Filter DocumentID = docID1
	docFilterList, docFilterTotal, err := mediaRepo.List(MediaFilter{DocumentID: &docID1})
	if err != nil || docFilterTotal != 1 || len(docFilterList) != 1 || docFilterList[0].ID != m1ID {
		t.Fatalf("List by documentID: total=%d len=%d want m1ID", docFilterTotal, len(docFilterList))
	}

	// 4. Keyword search matching document title
	kwList, kwTotal, err := mediaRepo.List(MediaFilter{Keyword: "Gemini"})
	if err != nil || kwTotal != 1 || len(kwList) != 1 || kwList[0].ID != m1ID {
		t.Fatalf("List by document title keyword: total=%d len=%d want m1ID", kwTotal, len(kwList))
	}

	// 5. Check FolderStats and Document References
	totalMedia, unclassified, usedMedia, unusedMedia, err := folderRepo.GetStats()
	if err != nil {
		t.Fatalf("folderRepo.GetStats() failed: %v", err)
	}
	if totalMedia != 2 || unclassified != 2 || usedMedia != 1 || unusedMedia != 1 {
		t.Fatalf("GetStats mismatch: total=%d unclassified=%d used=%d unused=%d", totalMedia, unclassified, usedMedia, unusedMedia)
	}

	docRefs, err := folderRepo.ListDocumentReferences()
	if err != nil {
		t.Fatalf("ListDocumentReferences failed: %v", err)
	}
	if len(docRefs) != 2 {
		t.Fatalf("ListDocumentReferences len = %d, want 2", len(docRefs))
	}

	// 6. Delete document reference when document is updated or deleted
	if err := mediaRepo.DeleteDocumentReferences(docID1); err != nil {
		t.Fatalf("DeleteDocumentReferences failed: %v", err)
	}
	refsAfterDelete, err := mediaRepo.ReferenceDocuments(m1ID)
	if err != nil || len(refsAfterDelete) != 1 || refsAfterDelete[0].ID != docID2 {
		t.Fatalf("refsAfterDelete mismatch: len=%d", len(refsAfterDelete))
	}
}

func TestAssignUnorganizedDocumentMediaMovesOnlyUniqueUnorganizedReferences(t *testing.T) {
	db := newTestDB(t)
	mediaRepo := NewMediaRepository(db)
	docRepo := NewDocumentRepository(db)

	docID, err := docRepo.Create(&model.Document{Title: "Gemini", Slug: "gemini", Status: "draft", AuthorID: 1})
	if err != nil {
		t.Fatalf("Create document: %v", err)
	}
	var folderID int64
	if err := db.QueryRow(`SELECT id FROM media_folders WHERE document_id = ?`, docID).Scan(&folderID); err != nil {
		t.Fatalf("Get document folder: %v", err)
	}

	create := func(name, source string, folderID int64) int64 {
		id, err := mediaRepo.Create(&model.Media{FolderID: folderID, OriginalName: name, Filename: name, Path: "images/" + name, URL: "/uploads/images/" + name, MediaType: "image", MimeType: "image/png", Size: 1, Source: source})
		if err != nil {
			t.Fatalf("Create media %s: %v", name, err)
		}
		return id
	}
	manualID := create("manual.png", "manual upload", 0)
	editorID := create("editor.png", "document/editor", 0)
	organizedID := create("organized.png", "manual upload", folderID)
	for _, id := range []int64{manualID, editorID, organizedID} {
		if err := mediaRepo.AddDocumentRef(id, docID); err != nil {
			t.Fatalf("Add document ref: %v", err)
		}
	}

	moved, err := mediaRepo.AssignUnorganizedDocumentMedia(docID, folderID)
	if err != nil || moved != 2 {
		t.Fatalf("AssignUnorganizedDocumentMedia moved=%d err=%v, want 2", moved, err)
	}
	for _, id := range []int64{manualID, editorID, organizedID} {
		media, err := mediaRepo.GetByID(id)
		if err != nil || media.FolderID != folderID {
			t.Fatalf("media %d folder=%d err=%v, want %d", id, media.FolderID, err, folderID)
		}
	}
}
