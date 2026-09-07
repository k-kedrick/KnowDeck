package handler

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gin-gonic/gin"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestNormalizePublicPagination(t *testing.T) {
	tests := []struct {
		name                   string
		page, pageSize         int
		wantPage, wantPageSize int
	}{
		{name: "defaults invalid values", page: 0, pageSize: 0, wantPage: 1, wantPageSize: 10},
		{name: "keeps normal values", page: 2, pageSize: 25, wantPage: 2, wantPageSize: 25},
		{name: "clamps large page size", page: 3, pageSize: 1000, wantPage: 3, wantPageSize: 100},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			page, pageSize := normalizePublicPagination(test.page, test.pageSize)
			if page != test.wantPage || pageSize != test.wantPageSize {
				t.Fatalf("got page=%d pageSize=%d, want page=%d pageSize=%d", page, pageSize, test.wantPage, test.wantPageSize)
			}
		})
	}
}

func TestAllowedExternalImageURL(t *testing.T) {
	valid := "https://scnyv437r6d7.feishu.cn/space/api/box/stream/download/asynccode/?code=signed"
	if _, ok := isAllowedExternalImageURL(valid); !ok {
		t.Fatal("expected current Feishu image URL to be allowed")
	}

	blocked := []string{
		"http://scnyv437r6d7.feishu.cn/space/api/box/stream/download/asynccode/?code=signed",
		"https://evil.example/space/api/box/stream/download/asynccode/?code=signed",
		"https://scnyv437r6d7.feishu.cn/other/path?code=signed",
		"https://scnyv437r6d7.feishu.cn/space/api/box/stream/download/asynccode/",
		"file:///etc/passwd",
	}
	for _, candidate := range blocked {
		if _, ok := isAllowedExternalImageURL(candidate); ok {
			t.Fatalf("expected URL to be blocked: %s", candidate)
		}
	}
}

func TestProxyExternalImage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	imageBody := []byte{0x89, 0x50, 0x4e, 0x47}
	handler := &PublicHandler{externalImageClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode:    http.StatusOK,
			Header:        http.Header{"Content-Type": []string{"image/png"}},
			Body:          io.NopCloser(bytes.NewReader(imageBody)),
			ContentLength: int64(len(imageBody)),
			Request:       req,
		}, nil
	})}}

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	upstream := "https://scnyv437r6d7.feishu.cn/space/api/box/stream/download/asynccode/?code=signed"
	request := httptest.NewRequest(http.MethodGet, "/api/public/external-image?url="+url.QueryEscape(upstream), nil)
	context.Request = request
	handler.ProxyExternalImage(context)

	if recorder.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200", recorder.Code)
	}
	if contentType := recorder.Header().Get("Content-Type"); contentType != "image/png" {
		t.Fatalf("got content type %q", contentType)
	}
	if !bytes.Equal(recorder.Body.Bytes(), imageBody) {
		t.Fatal("proxied image body changed")
	}
}
