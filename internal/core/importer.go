package core

import (
	"encoding/json"
	"fmt"
	"time"
)

// ImportLegacyJSON handles 4 different legacy formats
func ImportLegacyJSON(data []byte) (*TrackProject, error) {
	// Try to parse as generic JSON first
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		// Maybe it's a direct array
		var pieces []Piece
		if err := json.Unmarshal(data, &pieces); err != nil {
			return nil, fmt.Errorf("invalid JSON format")
		}
		return &TrackProject{
			Version:   "1.0",
			Pieces:    pieces,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}, nil
	}

	project := &TrackProject{
		Version:   "1.0",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Format 1: Has totalPieces and details
	if _, ok := raw["totalPieces"].(float64); ok {
		project.Name = getStringField(raw, "name", "Imported Track")

		if details, ok := raw["details"].([]interface{}); ok {
			project.Pieces = parsePiecesFromInterface(details)
		}

		// Extract BOM info if available
		if bom, ok := raw["bom"].(map[string]interface{}); ok {
			_ = bom // BOM will be recalculated
		}

		return project, nil
	}

	// Format 2: Standard pieces array
	if pieces, ok := raw["pieces"].([]interface{}); ok {
		project.Name = getStringField(raw, "name", "Imported Track")
		project.Pieces = parsePiecesFromInterface(pieces)

		if version, ok := raw["version"].(string); ok {
			project.Version = version
		}

		return project, nil
	}

	// Format 3: Only details array
	if details, ok := raw["details"].([]interface{}); ok {
		project.Name = getStringField(raw, "name", "Imported Track")
		project.Pieces = parsePiecesFromInterface(details)
		return project, nil
	}

	return nil, fmt.Errorf("unrecognized JSON format")
}

func parsePiecesFromInterface(items []interface{}) []Piece {
	pieces := make([]Piece, 0, len(items))

	for _, item := range items {
		pieceMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		piece := Piece{
			ID:       pieceMap["id"],
			Type:     getStringField(pieceMap, "type", "straight"),
			X:        getFloatField(pieceMap, "x", 0),
			Y:        getFloatField(pieceMap, "y", 0),
			Rotation: getFloatField(pieceMap, "rotation", 0),
		}

		// Parse params
		if params, ok := pieceMap["params"].(map[string]interface{}); ok {
			piece.Params = PieceParams{
				Length: getFloatField(params, "length", 0),
				Radius: getFloatField(params, "radius", 0),
				Angle:  getFloatField(params, "angle", 0),
			}
		}

		pieces = append(pieces, piece)
	}

	return pieces
}

func getStringField(m map[string]interface{}, key, defaultVal string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return defaultVal
}

func getFloatField(m map[string]interface{}, key string, defaultVal float64) float64 {
	if val, ok := m[key].(float64); ok {
		return val
	}
	return defaultVal
}
