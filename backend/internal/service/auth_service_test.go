package service

import (
	"testing"
	"time"

	"knowledge-base/backend/internal/config"
	"knowledge-base/backend/internal/model"

	"github.com/golang-jwt/jwt/v5"
)

func TestGenerateAndParseToken(t *testing.T) {
	svc := NewAuthService(nil, &config.Config{
		JWTSecret:    "test-secret",
		JWTExpireHrs: 1,
	})

	token, err := svc.GenerateToken(&model.User{
		ID:       42,
		Username: "admin",
		Role:     "admin",
	})
	if err != nil {
		t.Fatalf("GenerateToken returned error: %v", err)
	}

	claims, err := svc.ParseToken(token)
	if err != nil {
		t.Fatalf("ParseToken returned error: %v", err)
	}
	if claims.UserID != 42 || claims.Username != "admin" || claims.Role != "admin" {
		t.Fatalf("unexpected claims: %+v", claims)
	}
}

func TestParseTokenRejectsWrongAlgorithmAndIssuer(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret", JWTExpireHrs: 1}
	svc := NewAuthService(nil, cfg)

	wrongAlgorithm := jwt.NewWithClaims(jwt.SigningMethodHS384, JWTClaims{
		UserID: 1,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer: "feishu-kb", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})
	algorithmToken, err := wrongAlgorithm.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ParseToken(algorithmToken); err == nil {
		t.Fatal("expected non-HS256 token to be rejected")
	}

	wrongIssuer := jwt.NewWithClaims(jwt.SigningMethodHS256, JWTClaims{
		UserID: 1,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer: "another-app", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})
	issuerToken, err := wrongIssuer.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ParseToken(issuerToken); err == nil {
		t.Fatal("expected token from another issuer to be rejected")
	}
}

func TestParseTokenRequiresExpiration(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret", JWTExpireHrs: 1}
	svc := NewAuthService(nil, cfg)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, JWTClaims{
		UserID:           1,
		RegisteredClaims: jwt.RegisteredClaims{Issuer: "feishu-kb"},
	})
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ParseToken(tokenString); err == nil {
		t.Fatal("expected token without exp to be rejected")
	}
}
