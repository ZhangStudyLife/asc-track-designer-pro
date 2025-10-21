package core

import "time"

// TrackProject represents a complete track design
type TrackProject struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Version   string    `json:"version"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	// New model: polygon boundary
	Boundary *Boundary `json:"boundary,omitempty"`
	
	// Track skin/styling
	Skin *TrackSkin `json:"skin,omitempty"`

	// Legacy model: discrete pieces
	Pieces []Piece `json:"pieces,omitempty"`
}

// Boundary defines the track area as a polygon
type Boundary struct {
	Unit   string  `json:"unit"` // "cm" or "px"
	Points []Point `json:"points"`
	Closed bool    `json:"closed"`
}

type Point struct {
	Idx int     `json:"idx"`
	X   float64 `json:"x"`
	Y   float64 `json:"y"`
}

// TrackSkin defines track appearance
type TrackSkin struct {
	TrackWidthCm float64 `json:"trackWidthCm"`
	Color        string  `json:"color,omitempty"`
}

// Piece represents a track segment (legacy compatibility)
type Piece struct {
	ID       interface{} `json:"id"` // can be number or string
	Type     string      `json:"type"`
	Params   PieceParams `json:"params"`
	X        float64     `json:"x"`
	Y        float64     `json:"y"`
	Rotation float64     `json:"rotation"`
}

type PieceParams struct {
	Length float64 `json:"length,omitempty"` // for straight
	Radius float64 `json:"radius,omitempty"` // for curve
	Angle  float64 `json:"angle,omitempty"`  // for curve
}

// BOMSummary provides bill of materials
type BOMSummary struct {
	TotalPieces int               `json:"totalPieces"`
	TotalLength string            `json:"totalLength"` // in meters, 2 decimals
	BOM         map[string]int    `json:"bom"`
	Details     []Piece           `json:"details,omitempty"`
}

// TrackMetadata for storage and listing
type TrackMetadata struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	UploaderID  string    `json:"uploaderId,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	TotalPieces int       `json:"totalPieces"`
	TotalLength string    `json:"totalLength"`
}
