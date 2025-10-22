package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("token expired")
)

// JWTManager JWT管理器
type JWTManager struct {
	secret     []byte
	expiry     time.Duration
	issuer     string
}

// NewJWTManager 创建JWT管理器
func NewJWTManager(secret string, expiryHours int) *JWTManager {
	return &JWTManager{
		secret: []byte(secret),
		expiry: time.Duration(expiryHours) * time.Hour,
		issuer: "asc-track-designer",
	}
}

// Generate 生成JWT token
func (j *JWTManager) Generate(user *User) (string, error) {
	now := time.Now()
	claims := TokenClaims{
		UserID:    user.ID,
		Login:     user.Login,
		Name:      user.Name,
		AvatarURL: user.AvatarURL,
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(j.expiry).Unix(),
	}

	// Header
	header := map[string]string{
		"alg": "HS256",
		"typ": "JWT",
	}
	headerJSON, _ := json.Marshal(header)
	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)

	// Payload
	payloadJSON, _ := json.Marshal(claims)
	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadJSON)

	// Signature
	message := headerB64 + "." + payloadB64
	signature := j.sign(message)

	return message + "." + signature, nil
}

// Verify 验证JWT token
func (j *JWTManager) Verify(tokenString string) (*TokenClaims, error) {
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return nil, ErrInvalidToken
	}

	headerB64, payloadB64, signature := parts[0], parts[1], parts[2]

	// 验证签名
	message := headerB64 + "." + payloadB64
	expectedSignature := j.sign(message)
	if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
		return nil, ErrInvalidToken
	}

	// 解析 payload
	payloadJSON, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return nil, ErrInvalidToken
	}

	var claims TokenClaims
	if err := json.Unmarshal(payloadJSON, &claims); err != nil {
		return nil, ErrInvalidToken
	}

	// 验证过期时间
	if time.Now().Unix() > claims.ExpiresAt {
		return nil, ErrExpiredToken
	}

	return &claims, nil
}

// sign 生成HMAC-SHA256签名
func (j *JWTManager) sign(message string) string {
	h := hmac.New(sha256.New, j.secret)
	h.Write([]byte(message))
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}

// Refresh 刷新token（如果距离过期时间小于1天）
func (j *JWTManager) Refresh(tokenString string) (string, error) {
	claims, err := j.Verify(tokenString)
	if err != nil && err != ErrExpiredToken {
		return "", err
	}

	// 如果token已过期超过7天，拒绝刷新
	if time.Now().Unix() > claims.ExpiresAt+int64(7*24*3600) {
		return "", fmt.Errorf("token expired too long ago")
	}

	// 重新生成token
	user := &User{
		ID:        claims.UserID,
		Login:     claims.Login,
		Name:      claims.Name,
		AvatarURL: claims.AvatarURL,
	}

	return j.Generate(user)
}
