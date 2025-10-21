package config

import (
	"flag"
	"os"
	"path/filepath"
)

type Config struct {
	Port       string
	DataDir    string
	MaxUploadMB int64
}

func Load() *Config {
	cfg := &Config{}
	
	flag.StringVar(&cfg.Port, "port", getEnv("PORT", "8080"), "HTTP port")
	flag.StringVar(&cfg.DataDir, "data", getEnv("DATA_DIR", "./data"), "Data directory")
	flag.Int64Var(&cfg.MaxUploadMB, "max-upload", 5, "Max upload size in MB")
	flag.Parse()

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
