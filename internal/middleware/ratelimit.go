package middleware

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// RateLimitConfig 速率限制配置
type RateLimitConfig struct {
	RequestsPerMinute int           // 每分钟请求数
	Burst             int           // 突发容量
	CleanupInterval   time.Duration // 清理间隔
	MaxIPs            int           // 最大IP数量
}

// RateLimiter 速率限制器
type RateLimiter struct {
	limiters        sync.Map          // map[string]*rate.Limiter
	config          RateLimitConfig
	logger          *slog.Logger
	lastAccess      sync.Map          // map[string]time.Time
	cleanupTicker   *time.Ticker
	cleanupDone     chan struct{}
}

// visitor 访问者记录
type visitor struct {
	limiter    *rate.Limiter
	lastAccess time.Time
}

// NewRateLimiter 创建速率限制器
func NewRateLimiter(config RateLimitConfig, logger *slog.Logger) *RateLimiter {
	if logger == nil {
		logger = slog.Default()
	}

	rl := &RateLimiter{
		config:        config,
		logger:        logger,
		cleanupDone:   make(chan struct{}),
	}

	// 启动定期清理
	if config.CleanupInterval > 0 {
		rl.cleanupTicker = time.NewTicker(config.CleanupInterval)
		go rl.cleanup()
	}

	return rl
}

// getLimiter 获取或创建限流器
func (rl *RateLimiter) getLimiter(ip string) *rate.Limiter {
	if v, ok := rl.limiters.Load(ip); ok {
		rl.lastAccess.Store(ip, time.Now())
		return v.(*rate.Limiter)
	}

	// 创建新限流器
	limiter := rate.NewLimiter(
		rate.Limit(float64(rl.config.RequestsPerMinute)/60.0),
		rl.config.Burst,
	)

	rl.limiters.Store(ip, limiter)
	rl.lastAccess.Store(ip, time.Now())

	rl.logger.Debug("创建新限流器", "ip", ip, "rpm", rl.config.RequestsPerMinute)

	return limiter
}

// cleanup 定期清理过期的限流器
func (rl *RateLimiter) cleanup() {
	for {
		select {
		case <-rl.cleanupTicker.C:
			now := time.Now()
			var count int

			rl.lastAccess.Range(func(key, value interface{}) bool {
				ip := key.(string)
				lastAccess := value.(time.Time)

				// 删除超过清理间隔*2的记录
				if now.Sub(lastAccess) > rl.config.CleanupInterval*2 {
					rl.limiters.Delete(ip)
					rl.lastAccess.Delete(ip)
					count++
				}
				return true
			})

			if count > 0 {
				rl.logger.Info("清理过期限流器", "count", count)
			}

		case <-rl.cleanupDone:
			return
		}
	}
}

// Stop 停止清理协程
func (rl *RateLimiter) Stop() {
	if rl.cleanupTicker != nil {
		rl.cleanupTicker.Stop()
		close(rl.cleanupDone)
	}
}

// Middleware 速率限制中间件
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractIP(r)

		limiter := rl.getLimiter(ip)

		if !limiter.Allow() {
			rl.logger.Warn("速率限制触发",
				"ip", ip,
				"path", r.URL.Path,
				"method", r.Method,
			)

			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			fmt.Fprintf(w, `{"error":"请求过于频繁，请稍后再试"}`)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// extractIP 提取真实IP地址（支持反向代理）
func extractIP(r *http.Request) string {
	// 1. X-Forwarded-For (标准代理头)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			ip := strings.TrimSpace(ips[0])
			if ip != "" {
				return ip
			}
		}
	}

	// 2. X-Real-IP (Nginx)
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}

	// 3. Forwarded (RFC 7239)
	if fwd := r.Header.Get("Forwarded"); fwd != "" {
		for _, part := range strings.Split(fwd, ";") {
			part = strings.TrimSpace(part)
			if strings.HasPrefix(part, "for=") {
				ip := strings.TrimPrefix(part, "for=")
				ip = strings.Trim(ip, "\"")
				// 移除端口
				if host, _, err := net.SplitHostPort(ip); err == nil {
					return host
				}
				return ip
			}
		}
	}

	// 4. RemoteAddr (直连)
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}

	return r.RemoteAddr
}

// ContextKey 用于在context中存储IP
type contextKey string

const IPContextKey contextKey = "client_ip"

// WithIPContext 将IP存入context
func WithIPContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractIP(r)
		ctx := context.WithValue(r.Context(), IPContextKey, ip)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetIPFromContext 从context获取IP
func GetIPFromContext(ctx context.Context) string {
	if ip, ok := ctx.Value(IPContextKey).(string); ok {
		return ip
	}
	return ""
}
