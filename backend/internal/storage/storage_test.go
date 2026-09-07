package storage

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestLocalStorageGetAbsolutePathRejectsTraversal(t *testing.T) {
	base := t.TempDir()
	store := NewLocalStorage(base, "/uploads")

	badPaths := []string{
		"../secret.txt",
		"..\\secret.txt",
		"images/../../secret.txt",
		filepath.Join(base, "absolute.txt"),
	}

	for _, path := range badPaths {
		if got, err := store.GetAbsolutePath(path); err == nil {
			t.Fatalf("GetAbsolutePath(%q) = %q, nil error; want rejection", path, got)
		}
	}
}

func TestLocalStorageGetAbsolutePathAllowsSafeRelativePath(t *testing.T) {
	base := t.TempDir()
	store := NewLocalStorage(base, "/uploads")

	got, err := store.GetAbsolutePath("images/2026/08/a.png")
	if err != nil {
		t.Fatalf("GetAbsolutePath returned error: %v", err)
	}
	if !strings.HasPrefix(got, base) {
		t.Fatalf("absolute path %q should stay under base %q", got, base)
	}
}
