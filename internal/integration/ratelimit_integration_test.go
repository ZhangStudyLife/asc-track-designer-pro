package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/asc-lab/track-designer/internal/api"
	mw "github.com/asc-lab/track-designer/internal/middleware"
	"github.com/asc-lab/track-designer/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func setupTestServer(t *testing.T) (*httptest.Server, *mw.RateLimiterGroup, *store.Store) {
	// Create temporary store
	st, err := store.New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	// Create handler
	handler := api.NewHandler(st, 5)

	// Create rate limiters with test-friendly limits
	rateLimiters := mw.NewRateLimiterGroup()
	rateLimiters.Add("upload", mw.RateLimitConfig{
		RequestsPerSecond: 2.0, // 2 req/s for testing
		Burst:             2,
		CleanupInterval:   1 * time.Minute,
		TTL:               5 * time.Minute,
	})
	rateLimiters.Add("download", mw.RateLimitConfig{
		RequestsPerSecond: 5.0,
		Burst:             5,
		CleanupInterval:   1 * time.Minute,
		TTL:               5 * time.Minute,
	})
	rateLimiters.Add("list", mw.RateLimitConfig{
		RequestsPerSecond: 10.0,
		Burst:             10,
		CleanupInterval:   1 * time.Minute,
		TTL:               5 * time.Minute,
	})

	// Setup router
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(rateLimiters.Middleware)

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", handler.Health)
		r.Post("/tracks", handler.UploadTrack)
		r.Get("/tracks", handler.ListTracks)
		r.Get("/tracks/{id}", handler.GetTrack)
		r.Get("/tracks/{id}/download", handler.DownloadTrack)
		r.Delete("/tracks/{id}", handler.DeleteTrack)
	})

	server := httptest.NewServer(r)
	return server, rateLimiters, st
}

func TestRateLimiting_Upload(t *testing.T) {
	server, rateLimiters, st := setupTestServer(t)
	defer server.Close()
	defer rateLimiters.StopAll()
	defer st.Close()

	// Create test track data
	trackData := map[string]interface{}{
		"name":        "Test Track",
		"description": "Rate limit test",
		"project": map[string]interface{}{
			"version": "1.0",
			"pieces":  []interface{}{},
		},
	}

	// First 2 requests should succeed (burst = 2)
	for i := 0; i < 2; i++ {
		body, _ := json.Marshal(trackData)
		req, _ := http.NewRequest("POST", server.URL+"/api/tracks", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Real-IP", "192.168.1.100") // Same IP

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusCreated {
			t.Errorf("Request %d: expected status 201, got %d", i+1, resp.StatusCode)
		}
	}

	// Third request should be rate limited
	body, _ := json.Marshal(trackData)
	req, _ := http.NewRequest("POST", server.URL+"/api/tracks", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Real-IP", "192.168.1.100")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusTooManyRequests {
		t.Errorf("Expected status 429, got %d", resp.StatusCode)
	}

	// Check Retry-After header
	retryAfter := resp.Header.Get("Retry-After")
	if retryAfter != "60" {
		t.Errorf("Expected Retry-After: 60, got %s", retryAfter)
	}
}

func TestRateLimiting_DifferentIPs(t *testing.T) {
	server, rateLimiters, st := setupTestServer(t)
	defer server.Close()
	defer rateLimiters.StopAll()
	defer st.Close()

	// Requests from different IPs should not interfere
	ips := []string{"192.168.1.1", "192.168.1.2", "192.168.1.3"}

	for _, ip := range ips {
		req, _ := http.NewRequest("GET", server.URL+"/api/tracks", nil)
		req.Header.Set("X-Real-IP", ip)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Request from %s: expected status 200, got %d", ip, resp.StatusCode)
		}
	}
}

func TestRateLimiting_XForwardedFor(t *testing.T) {
	server, rateLimiters, st := setupTestServer(t)
	defer server.Close()
	defer rateLimiters.StopAll()
	defer st.Close()

	trackData := map[string]interface{}{
		"name":        "Test Track",
		"description": "XFF test",
		"project": map[string]interface{}{
			"version": "1.0",
			"pieces":  []interface{}{},
		},
	}

	// Use X-Forwarded-For header (common with reverse proxies)
	for i := 0; i < 3; i++ {
		body, _ := json.Marshal(trackData)
		req, _ := http.NewRequest("POST", server.URL+"/api/tracks", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Forwarded-For", "203.0.113.195, 70.41.3.18") // Same client, different proxy

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()

		if i < 2 {
			if resp.StatusCode != http.StatusCreated {
				t.Errorf("Request %d: expected status 201, got %d", i+1, resp.StatusCode)
			}
		} else {
			if resp.StatusCode != http.StatusTooManyRequests {
				t.Errorf("Request %d: expected status 429, got %d", i+1, resp.StatusCode)
			}
		}
	}
}

func TestRateLimiting_HealthCheck_NoLimit(t *testing.T) {
	server, rateLimiters, st := setupTestServer(t)
	defer server.Close()
	defer rateLimiters.StopAll()
	defer st.Close()

	// Health check should not be rate limited
	for i := 0; i < 50; i++ {
		req, _ := http.NewRequest("GET", server.URL+"/api/health", nil)
		req.Header.Set("X-Real-IP", "192.168.1.1")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Request %d: health check should not be rate limited, got status %d", i+1, resp.StatusCode)
		}
	}
}

func TestRateLimiting_ErrorResponse(t *testing.T) {
	server, rateLimiters, st := setupTestServer(t)
	defer server.Close()
	defer rateLimiters.StopAll()
	defer st.Close()

	// Trigger rate limit
	for i := 0; i < 3; i++ {
		req, _ := http.NewRequest("GET", server.URL+"/api/tracks", nil)
		req.Header.Set("X-Real-IP", "192.168.1.1")
		http.DefaultClient.Do(req)
	}

	// Check error response format
	req, _ := http.NewRequest("GET", server.URL+"/api/tracks", nil)
	req.Header.Set("X-Real-IP", "192.168.1.1")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusTooManyRequests {
		t.Errorf("Expected status 429, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}

	if success, ok := result["success"].(bool); !ok || success {
		t.Error("Expected success: false in error response")
	}

	if errorMsg, ok := result["error"].(string); !ok || errorMsg == "" {
		t.Error("Expected error message in response")
	}
}

func BenchmarkRateLimiter(b *testing.B) {
	server, rateLimiters, st := setupTestServer(&testing.T{})
	defer server.Close()
	defer rateLimiters.StopAll()
	defer st.Close()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			req, _ := http.NewRequest("GET", server.URL+"/api/health", nil)
			// Use different IPs to avoid rate limiting
			req.Header.Set("X-Real-IP", "192.168.1."+string(rune(i%255)))
			http.DefaultClient.Do(req)
			i++
		}
	})
}
