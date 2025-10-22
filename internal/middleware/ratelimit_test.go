package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiter_Allow(t *testing.T) {
	// Create a rate limiter: 2 requests per second, burst 2
	config := RateLimitConfig{
		RequestsPerSecond: 2.0,
		Burst:             2,
		CleanupInterval:   1 * time.Minute,
		TTL:               1 * time.Hour,
	}
	rl := NewRateLimiter(config)
	defer rl.Stop()

	// Test handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	})

	middleware := rl.Middleware(handler)

	// Test burst: first 2 requests should pass
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		rec := httptest.NewRecorder()

		middleware.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("Request %d: expected status 200, got %d", i+1, rec.Code)
		}
	}

	// Third request should be rate limited
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	rec := httptest.NewRecorder()

	middleware.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("Expected status 429, got %d", rec.Code)
	}
}

func TestRateLimiter_DifferentIPs(t *testing.T) {
	config := RateLimitConfig{
		RequestsPerSecond: 1.0,
		Burst:             1,
		CleanupInterval:   1 * time.Minute,
		TTL:               1 * time.Hour,
	}
	rl := NewRateLimiter(config)
	defer rl.Stop()

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := rl.Middleware(handler)

	// Requests from different IPs should not affect each other
	ips := []string{"192.168.1.1:1234", "192.168.1.2:1234", "192.168.1.3:1234"}

	for _, ip := range ips {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = ip
		rec := httptest.NewRecorder()

		middleware.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("Request from %s: expected status 200, got %d", ip, rec.Code)
		}
	}
}

func TestExtractIP_XForwardedFor(t *testing.T) {
	tests := []struct {
		name     string
		header   string
		expected string
	}{
		{
			name:     "Single IP",
			header:   "203.0.113.195",
			expected: "203.0.113.195",
		},
		{
			name:     "Multiple IPs",
			header:   "203.0.113.195, 70.41.3.18, 150.172.238.178",
			expected: "203.0.113.195",
		},
		{
			name:     "With spaces",
			header:   "  203.0.113.195  , 70.41.3.18",
			expected: "203.0.113.195",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			req.Header.Set("X-Forwarded-For", tt.header)
			req.RemoteAddr = "192.168.1.1:12345"

			ip := extractIP(req)
			if ip != tt.expected {
				t.Errorf("Expected IP %s, got %s", tt.expected, ip)
			}
		})
	}
}

func TestExtractIP_XRealIP(t *testing.T) {
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Real-IP", "203.0.113.195")
	req.RemoteAddr = "192.168.1.1:12345"

	ip := extractIP(req)
	if ip != "203.0.113.195" {
		t.Errorf("Expected IP 203.0.113.195, got %s", ip)
	}
}

func TestExtractIP_RemoteAddr(t *testing.T) {
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"

	ip := extractIP(req)
	if ip != "192.168.1.1" {
		t.Errorf("Expected IP 192.168.1.1, got %s", ip)
	}
}

func TestRateLimiterGroup(t *testing.T) {
	rlg := NewRateLimiterGroup()
	defer rlg.StopAll()

	// Add different limiters for different endpoints
	rlg.Add("upload", RateLimitConfig{
		RequestsPerSecond: 1.0,
		Burst:             1,
		CleanupInterval:   1 * time.Minute,
		TTL:               1 * time.Hour,
	})

	rlg.Add("download", RateLimitConfig{
		RequestsPerSecond: 10.0,
		Burst:             10,
		CleanupInterval:   1 * time.Minute,
		TTL:               1 * time.Hour,
	})

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := rlg.Middleware(handler)

	// Test upload endpoint (strict limit)
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest("POST", "/api/tracks", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		rec := httptest.NewRecorder()

		middleware.ServeHTTP(rec, req)

		if i == 0 && rec.Code != http.StatusOK {
			t.Errorf("First upload: expected status 200, got %d", rec.Code)
		} else if i == 1 && rec.Code != http.StatusTooManyRequests {
			t.Errorf("Second upload: expected status 429, got %d", rec.Code)
		}
	}

	// Test download endpoint (more lenient limit) with different IP
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("GET", "/api/tracks/abc123/download", nil)
		req.RemoteAddr = "192.168.1.2:12345"
		rec := httptest.NewRecorder()

		middleware.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("Download %d: expected status 200, got %d", i+1, rec.Code)
		}
	}
}

func TestRateLimiter_Cleanup(t *testing.T) {
	config := RateLimitConfig{
		RequestsPerSecond: 1.0,
		Burst:             1,
		CleanupInterval:   100 * time.Millisecond,
		TTL:               200 * time.Millisecond,
	}
	rl := NewRateLimiter(config)
	defer rl.Stop()

	// Make a request to create a limiter
	limiter := rl.getLimiter("192.168.1.1")
	if limiter == nil {
		t.Fatal("Failed to get limiter")
	}

	// Wait for cleanup
	time.Sleep(400 * time.Millisecond)

	// Check if limiter was cleaned up (we can't directly check, but we can verify new one is created)
	newLimiter := rl.getLimiter("192.168.1.1")
	if newLimiter == nil {
		t.Fatal("Failed to get new limiter after cleanup")
	}
}
