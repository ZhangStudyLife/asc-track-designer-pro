package api

import (
	"crypto/rand"
	"encoding/hex"
)

// GenerateID creates a simple unique ID
func GenerateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
