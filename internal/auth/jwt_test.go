package auth

import (
	"testing"
	"time"
)

func TestJWTManager_GenerateAndValidate(t *testing.T) {
	secret := "test-secret-key"
	manager := NewJWTManager(secret, 24)

	// Test data
	userID := "123456"
	username := "testuser"
	avatarURL := "https://example.com/avatar.jpg"

	// Generate token
	token, err := manager.GenerateToken(userID, username, avatarURL)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	if token == "" {
		t.Fatal("Generated token is empty")
	}

	// Validate token
	claims, err := manager.ValidateToken(token)
	if err != nil {
		t.Fatalf("Failed to validate token: %v", err)
	}

	// Check claims
	if claims.UserID != userID {
		t.Errorf("UserID mismatch: expected %s, got %s", userID, claims.UserID)
	}

	if claims.Username != username {
		t.Errorf("Username mismatch: expected %s, got %s", username, claims.Username)
	}

	if claims.AvatarURL != avatarURL {
		t.Errorf("AvatarURL mismatch: expected %s, got %s", avatarURL, claims.AvatarURL)
	}
}

func TestJWTManager_InvalidToken(t *testing.T) {
	secret := "test-secret-key"
	manager := NewJWTManager(secret, 24)

	// Test invalid token
	_, err := manager.ValidateToken("invalid.token.here")
	if err == nil {
		t.Fatal("Expected error for invalid token, got nil")
	}

	if err != ErrInvalidToken {
		t.Errorf("Expected ErrInvalidToken, got %v", err)
	}
}

func TestJWTManager_WrongSecret(t *testing.T) {
	secret1 := "secret-1"
	secret2 := "secret-2"

	manager1 := NewJWTManager(secret1, 24)
	manager2 := NewJWTManager(secret2, 24)

	// Generate token with manager1
	token, err := manager1.GenerateToken("123", "user", "avatar.jpg")
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	// Try to validate with manager2 (wrong secret)
	_, err = manager2.ValidateToken(token)
	if err == nil {
		t.Fatal("Expected error for wrong secret, got nil")
	}

	if err != ErrInvalidToken {
		t.Errorf("Expected ErrInvalidToken, got %v", err)
	}
}

func TestJWTManager_ExpiredToken(t *testing.T) {
	secret := "test-secret-key"
	// Create manager with very short expiry (1 nanosecond)
	manager := &JWTManager{
		secret:         secret,
		expiryDuration: 1 * time.Nanosecond,
	}

	// Generate token
	token, err := manager.GenerateToken("123", "user", "avatar.jpg")
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	// Wait for token to expire
	time.Sleep(10 * time.Millisecond)

	// Try to validate expired token
	_, err = manager.ValidateToken(token)
	if err == nil {
		t.Fatal("Expected error for expired token, got nil")
	}

	// Note: jwt library might return ErrInvalidToken instead of ErrExpiredToken
	// in some cases, so we check for either
	if err != ErrExpiredToken && err != ErrInvalidToken {
		t.Errorf("Expected ErrExpiredToken or ErrInvalidToken, got %v", err)
	}
}

func TestClaims_ExpiresAt(t *testing.T) {
	secret := "test-secret-key"
	manager := NewJWTManager(secret, 24) // 24 hours

	token, err := manager.GenerateToken("123", "user", "avatar.jpg")
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	claims, err := manager.ValidateToken(token)
	if err != nil {
		t.Fatalf("Failed to validate token: %v", err)
	}

	// Check if expiry is set correctly (approximately 24 hours from now)
	expectedExpiry := time.Now().Add(24 * time.Hour)
	actualExpiry := claims.ExpiresAt.Time

	diff := actualExpiry.Sub(expectedExpiry).Abs()
	if diff > 1*time.Minute {
		t.Errorf("ExpiresAt time difference too large: %v", diff)
	}
}
