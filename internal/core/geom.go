package core

import (
	"fmt"
	"math"
)

// CalculateLength computes the total track length in meters
func CalculateLength(project *TrackProject) (float64, error) {
	totalCm := 0.0

	// Calculate from pieces (legacy)
	for _, piece := range project.Pieces {
		switch piece.Type {
		case "straight":
			totalCm += piece.Params.Length
		case "curve":
			// Arc length = radius * angle_in_radians
			angleRad := piece.Params.Angle * math.Pi / 180.0
			totalCm += piece.Params.Radius * angleRad
		default:
			return 0, fmt.Errorf("unknown piece type: %s", piece.Type)
		}
	}

	// Calculate from boundary (if present and no pieces)
	if len(project.Pieces) == 0 && project.Boundary != nil {
		totalCm = calculatePolylineLength(project.Boundary)
	}

	// Convert to meters with 2 decimal places
	return math.Round(totalCm) / 100.0, nil
}

func calculatePolylineLength(boundary *Boundary) float64 {
	if len(boundary.Points) < 2 {
		return 0
	}

	totalCm := 0.0
	points := boundary.Points

	for i := 0; i < len(points)-1; i++ {
		dx := points[i+1].X - points[i].X
		dy := points[i+1].Y - points[i].Y
		totalCm += math.Sqrt(dx*dx + dy*dy)
	}

	// Close the loop if needed
	if boundary.Closed && len(points) > 2 {
		dx := points[0].X - points[len(points)-1].X
		dy := points[0].Y - points[len(points)-1].Y
		totalCm += math.Sqrt(dx*dx + dy*dy)
	}

	// Convert px to cm if needed (1cm = 2px)
	if boundary.Unit == "px" {
		totalCm /= 2.0
	}

	return totalCm
}

// GenerateBOM creates a bill of materials
func GenerateBOM(project *TrackProject) *BOMSummary {
	bom := make(map[string]int)
	
	for _, piece := range project.Pieces {
		key := generateBOMKey(piece)
		bom[key]++
	}

	length, _ := CalculateLength(project)

	return &BOMSummary{
		TotalPieces: len(project.Pieces),
		TotalLength: fmt.Sprintf("%.2f", length),
		BOM:         bom,
		Details:     project.Pieces,
	}
}

func generateBOMKey(piece Piece) string {
	switch piece.Type {
	case "straight":
		return fmt.Sprintf("L%.0f", piece.Params.Length)
	case "curve":
		return fmt.Sprintf("R%.0f-%.0f", piece.Params.Radius, piece.Params.Angle)
	default:
		return "UNKNOWN"
	}
}
