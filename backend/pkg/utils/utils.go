package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// HashPassword 哈希密码
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 11)
	return string(bytes), err
}

// CheckPasswordHash 验证密码
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateUUID 生成唯一ID
func GenerateUUID() string {
	return uuid.New().String()
}

// GenerateRandomHex 生成随机十六进制字符串
func GenerateRandomHex(n int) string {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return uuid.New().String()
	}
	return hex.EncodeToString(bytes)
}

var nonAlphanumericRegex = regexp.MustCompile(`[^\p{L}\p{N}]+`)

// Slugify 转换标题为 URL Slug (支持中文和拼音/英文)
func Slugify(text string) string {
	text = strings.TrimSpace(text)
	text = strings.ToLower(text)

	// 将空格和特殊字符替换为 -
	slug := nonAlphanumericRegex.ReplaceAllString(text, "-")
	slug = strings.Trim(slug, "-")

	if slug == "" {
		slug = fmt.Sprintf("doc-%s", GenerateRandomHex(4))
	}
	return slug
}

// EstimateReadingTime 预估阅读时间 (分钟)
func EstimateReadingTime(content string) int {
	// 中文字符数 + 英文单词数
	chineseCount := 0
	englishWordCount := 0
	inWord := false

	for _, r := range content {
		if unicode.Is(unicode.Han, r) {
			chineseCount++
		} else if unicode.IsLetter(r) || unicode.IsDigit(r) {
			if !inWord {
				englishWordCount++
				inWord = true
			}
		} else {
			inWord = false
		}
	}

	// 假设阅读速度：中文 350 字/分钟，英文 180 词/分钟
	totalMinutes := float64(chineseCount)/350.0 + float64(englishWordCount)/180.0
	if totalMinutes < 1.0 {
		return 1
	}
	return int(totalMinutes + 0.5)
}

// SafeFilename 获取安全的文件名
func SafeFilename(filename string) string {
	base := filepath.Base(filename)
	ext := filepath.Ext(base)
	return fmt.Sprintf("%s%s", uuid.New().String(), strings.ToLower(ext))
}

// IsAllowedExt 校验扩展名
func IsAllowedExt(ext string, allowedList []string) bool {
	ext = strings.ToLower(strings.TrimPrefix(ext, "."))
	for _, allowed := range allowedList {
		if ext == strings.ToLower(strings.TrimPrefix(allowed, ".")) {
			return true
		}
	}
	return false
}

// ParseFlexibleTime 解析 SQLite 中的多种时间格式
func ParseFlexibleTime(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	formats := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05Z",
		"2006-01-02 15:04:05-07:00",
		"2006-01-02",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t
		}
	}
	return time.Time{}
}

