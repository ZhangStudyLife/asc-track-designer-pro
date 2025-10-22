package auth

import "time"

// User 用户模型
type User struct {
	ID        string    `json:"id"`         // 用户唯一标识（GitHub ID）
	Login     string    `json:"login"`      // GitHub 用户名
	Name      string    `json:"name"`       // 显示名称
	AvatarURL string    `json:"avatar_url"` // 头像URL
	Email     string    `json:"email"`      // 邮箱（可能为空）
	CreatedAt time.Time `json:"created_at"` // 创建时间
	UpdatedAt time.Time `json:"updated_at"` // 更新时间
}

// GitHubUser GitHub API 返回的用户信息
type GitHubUser struct {
	ID        int    `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
}

// OAuthState OAuth 状态（用于CSRF防护）
type OAuthState struct {
	State     string    `json:"state"`
	ExpiresAt time.Time `json:"expires_at"`
}

// TokenClaims JWT Claims
type TokenClaims struct {
	UserID    string `json:"user_id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}
