package utils

import "testing"

func TestPasswordHashAndCheck(t *testing.T) {
	hash, err := HashPassword("secret123")
	if err != nil {
		t.Fatalf("HashPassword returned error: %v", err)
	}
	if !CheckPasswordHash("secret123", hash) {
		t.Fatal("expected password to match generated hash")
	}
	if CheckPasswordHash("wrong", hash) {
		t.Fatal("expected wrong password to be rejected")
	}
}

func TestSlugify(t *testing.T) {
	got := Slugify("Hello 世界 2026!")
	want := "hello-世界-2026"
	if got != want {
		t.Fatalf("Slugify() = %q, want %q", got, want)
	}

	if got := Slugify("!!!"); got == "" {
		t.Fatal("Slugify should generate fallback slug for symbol-only input")
	}
}

func TestParseFlexibleTime(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		isZero  bool
		wantY   int
		wantM   int
		wantD   int
		wantH   int
		wantMin int
		wantSec int
	}{
		{
			name:    "SQLite default CURRENT_TIMESTAMP format",
			input:   "2026-09-01 12:34:56",
			isZero:  false,
			wantY:   2026,
			wantM:   9,
			wantD:   1,
			wantH:   12,
			wantMin: 34,
			wantSec: 56,
		},
		{
			name:    "SQLite format with fractional seconds",
			input:   "2026-09-01 12:34:56.789",
			isZero:  false,
			wantY:   2026,
			wantM:   9,
			wantD:   1,
			wantH:   12,
			wantMin: 34,
			wantSec: 56,
		},
		{
			name:    "RFC3339 UTC format",
			input:   "2026-09-01T12:34:56Z",
			isZero:  false,
			wantY:   2026,
			wantM:   9,
			wantD:   1,
			wantH:   12,
			wantMin: 34,
			wantSec: 56,
		},
		{
			name:    "RFC3339 with timezone offset",
			input:   "2026-09-01T20:34:56+08:00",
			isZero:  false,
			wantY:   2026,
			wantM:   9,
			wantD:   1,
			wantH:   20,
			wantMin: 34,
			wantSec: 56,
		},
		{
			name:    "Date only format",
			input:   "2026-09-01",
			isZero:  false,
			wantY:   2026,
			wantM:   9,
			wantD:   1,
			wantH:   0,
			wantMin: 0,
			wantSec: 0,
		},
		{
			name:   "Empty string returns zero time",
			input:  "",
			isZero: true,
		},
		{
			name:   "Invalid string returns zero time",
			input:  "invalid-date-string",
			isZero: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := ParseFlexibleTime(tc.input)
			if tc.isZero {
				if !got.IsZero() {
					t.Fatalf("ParseFlexibleTime(%q) = %v, want zero time", tc.input, got)
				}
				return
			}

			if got.IsZero() {
				t.Fatalf("ParseFlexibleTime(%q) returned zero time, want non-zero", tc.input)
			}
			if got.Year() != tc.wantY || int(got.Month()) != tc.wantM || got.Day() != tc.wantD {
				t.Fatalf("ParseFlexibleTime(%q) date = %04d-%02d-%02d, want %04d-%02d-%02d",
					tc.input, got.Year(), got.Month(), got.Day(), tc.wantY, tc.wantM, tc.wantD)
			}
			if got.Hour() != tc.wantH || got.Minute() != tc.wantMin || got.Second() != tc.wantSec {
				t.Fatalf("ParseFlexibleTime(%q) time = %02d:%02d:%02d, want %02d:%02d:%02d",
					tc.input, got.Hour(), got.Minute(), got.Second(), tc.wantH, tc.wantMin, tc.wantSec)
			}
		})
	}
}
