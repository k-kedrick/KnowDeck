package config

import "testing"

func validProductionConfig() *Config {
	return &Config{
		Environment: "production", Port: 8090,
		JWTSecret: "0123456789abcdef0123456789abcdef", JWTExpireHrs: 24,
		AdminPass: "a-strong-password", MaxUploadMB: 1024,
		MaxImageMB: 20, MaxVideoMB: 1024, MaxFileMB: 100,
		CORSOrigins:    []string{"https://kb.example.com"},
		TrustedProxies: []string{"172.16.0.0/12"},
		SiteURL:        "https://kb.example.com",
	}
}

func TestDevelopmentDefaultsRemainValid(t *testing.T) {
	cfg := validProductionConfig()
	cfg.Environment = "development"
	cfg.JWTSecret = developmentJWTSecret
	cfg.AdminPass = developmentAdminPass
	if err := cfg.Validate(); err != nil {
		t.Fatalf("development config should remain usable: %v", err)
	}
}

func TestProductionRejectsUnsafeSecretsAndOrigins(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*Config)
	}{
		{"default jwt secret", func(c *Config) { c.JWTSecret = developmentJWTSecret }},
		{"documented development jwt secret", func(c *Config) { c.JWTSecret = "development-only-secret-change-me-1234567890" }},
		{"documented jwt placeholder", func(c *Config) { c.JWTSecret = "CHANGE_ME_generate-a-random-secret" }},
		{"short jwt secret", func(c *Config) { c.JWTSecret = "too-short" }},
		{"default admin password", func(c *Config) { c.AdminPass = developmentAdminPass }},
		{"documented admin placeholder", func(c *Config) { c.AdminPass = "CHANGE_ME_admin-password" }},
		{"short admin password", func(c *Config) { c.AdminPass = "short" }},
		{"wildcard cors", func(c *Config) { c.CORSOrigins = []string{"*"} }},
		{"trust all proxies", func(c *Config) { c.TrustedProxies = []string{"0.0.0.0/0"} }},
		{"localhost site url", func(c *Config) { c.SiteURL = "http://localhost:3799" }},
		{"invalid site url", func(c *Config) { c.SiteURL = "kb.example.com" }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := validProductionConfig()
			tt.mutate(cfg)
			if err := cfg.Validate(); err == nil {
				t.Fatal("expected unsafe production config to be rejected")
			}
		})
	}
}

func TestProductionConfigIsAccepted(t *testing.T) {
	if err := validProductionConfig().Validate(); err != nil {
		t.Fatalf("valid production config rejected: %v", err)
	}
}
