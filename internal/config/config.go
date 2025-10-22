package config

import (
	"bufio"
	"flag"
	"log"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Port             string
	DataDir          string
	MaxUploadMB      int64

	// OAuth Configuration
	GitHubClientID     string
	GitHubClientSecret string
	GitHubCallbackURL  string

	// JWT Configuration
	JWTSecret          string
	JWTExpiryHours     int
}

func Load() *Config {
	// Load .env file if exists
	loadEnvFile()

	cfg := &Config{}

	flag.StringVar(&cfg.Port, "port", getEnv("PORT", "8080"), "HTTP port")
	flag.StringVar(&cfg.DataDir, "data", getEnv("DATA_DIR", "./data"), "Data directory")
	flag.Int64Var(&cfg.MaxUploadMB, "max-upload", 5, "Max upload size in MB")
	flag.Parse()

	// Load OAuth configuration from environment
	cfg.GitHubClientID = getEnv("GITHUB_CLIENT_ID", "")
	cfg.GitHubClientSecret = getEnv("GITHUB_CLIENT_SECRET", "")
	cfg.GitHubCallbackURL = getEnv("GITHUB_CALLBACK_URL", "http://localhost:8080/api/auth/github/callback")

	// Load JWT configuration
	cfg.JWTSecret = getEnv("JWT_SECRET", "")
	if cfg.JWTSecret == "" {
		log.Println("WARNING: JWT_SECRET not set, using insecure default. Set JWT_SECRET environment variable in production!")
		cfg.JWTSecret = "insecure-default-secret-change-me"
	}
	cfg.JWTExpiryHours = 24 * 7 // 7 days default

	// Ensure data directory exists
	os.MkdirAll(cfg.DataDir, 0755)
	os.MkdirAll(filepath.Join(cfg.DataDir, "tracks"), 0755)
	os.MkdirAll(filepath.Join(cfg.DataDir, "exports"), 0755)

	return cfg
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// loadEnvFile loads environment variables from .env file if it exists
func loadEnvFile() {
	envFile := ".env"
	file, err := os.Open(envFile)
	if err != nil {
		// .env file is optional
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Parse KEY=VALUE
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		// Remove quotes if present
		value = strings.Trim(value, "\"'")

		// Only set if not already in environment
		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}
}
