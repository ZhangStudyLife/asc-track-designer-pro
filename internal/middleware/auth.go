package middleware

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/asc-lab/track-designer/internal/auth"
)

// AuthMiddleware 认证中间件
type AuthMiddleware struct {
	jwtManager *auth.JWTManager
	logger     *slog.Logger
}

// NewAuthMiddleware 创建认证中间件
func NewAuthMiddleware(jwtManager *auth.JWTManager, logger *slog.Logger) *AuthMiddleware {
	if logger == nil {
		logger = slog.Default()
	}
	return &AuthMiddleware{
		jwtManager: jwtManager,
		logger:     logger,
	}
}

// ContextKey 用于在context中存储用户信息
type authContextKey string

const UserContextKey authContextKey = "user"

// RequireAuth 要求认证的中间件（强制）
func (am *AuthMiddleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := extractToken(r)
		if token == "" {
			// 调试:列出所有cookies
			cookies := r.Cookies()
			am.logger.Warn("缺少认证token", "path", r.URL.Path, "cookies_count", len(cookies))
			respondUnauthorized(w, "未登录，请先登录")
			return
		}

		claims, err := am.jwtManager.Verify(token)
		if err != nil {
			am.logger.Warn("token验证失败", "error", err, "path", r.URL.Path)
			if err == auth.ErrExpiredToken {
				respondUnauthorized(w, "登录已过期，请重新登录")
			} else {
				respondUnauthorized(w, "无效的认证信息")
			}
			return
		}

		// 将用户信息存入context
		ctx := context.WithValue(r.Context(), UserContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// OptionalAuth 可选认证的中间件（不强制）
func (am *AuthMiddleware) OptionalAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := extractToken(r)
		if token != "" {
			claims, err := am.jwtManager.Verify(token)
			if err == nil {
				// token有效，存入context
				ctx := context.WithValue(r.Context(), UserContextKey, claims)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
			// token无效或过期，记录日志但不拦截
			am.logger.Debug("可选认证token无效", "error", err)
		}

		// 无token或token无效，继续执行但context中没有用户信息
		next.ServeHTTP(w, r)
	})
}

// extractToken 从请求中提取token
// 优先级：Cookie > Authorization header > Query parameter
func extractToken(r *http.Request) string {
	// 1. 从Cookie中获取
	if cookie, err := r.Cookie("auth_token"); err == nil {
		return cookie.Value
	}

	// 2. 从Authorization header获取
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		// 支持 "Bearer <token>" 格式
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
			return parts[1]
		}
		// 直接是token
		return authHeader
	}

	// 3. 从查询参数获取（不推荐，但为了兼容）
	return r.URL.Query().Get("token")
}

// GetUserFromContext 从context获取用户信息
func GetUserFromContext(ctx context.Context) *auth.TokenClaims {
	if claims, ok := ctx.Value(UserContextKey).(*auth.TokenClaims); ok {
		return claims
	}
	return nil
}

// IsAuthenticated 检查是否已认证
func IsAuthenticated(ctx context.Context) bool {
	return GetUserFromContext(ctx) != nil
}

// respondUnauthorized 返回401错误
func respondUnauthorized(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusUnauthorized)
	fmt.Fprintf(w, `{"error":"%s"}`, message)
}
