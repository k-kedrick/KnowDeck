package service

import (
	"testing"

	"knowledge-base/backend/internal/config"
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
