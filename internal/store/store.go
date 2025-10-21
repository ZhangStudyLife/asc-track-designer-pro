package store

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/asc-lab/track-designer/internal/core"
	_ "modernc.org/sqlite"
)

type Store struct {
	db      *sql.DB
	dataDir string
}

func New(dataDir string) (*Store, error) {
	dbPath := filepath.Join(dataDir, "tracks.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	store := &Store{
		db:      db,
		dataDir: dataDir,
	}

	if err := store.init(); err != nil {
		return nil, err
	}

	return store, nil
}

func (s *Store) init() error {
	schema := `
	CREATE TABLE IF NOT EXISTS tracks (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		uploader_id TEXT,
		created_at DATETIME NOT NULL,
		total_pieces INTEGER DEFAULT 0,
		total_length TEXT DEFAULT '0.00'
	);
	CREATE INDEX IF NOT EXISTS idx_tracks_created ON tracks(created_at DESC);
	`
	_, err := s.db.Exec(schema)
	return err
}

func (s *Store) SaveTrack(project *core.TrackProject) error {
	// Save JSON file
	trackPath := filepath.Join(s.dataDir, "tracks", project.ID+".json")
	data, err := json.MarshalIndent(project, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(trackPath, data, 0644); err != nil {
		return err
	}

	// Calculate stats
	bom := core.GenerateBOM(project)

	// Save metadata
	_, err = s.db.Exec(`
		INSERT OR REPLACE INTO tracks (id, name, uploader_id, created_at, total_pieces, total_length)
		VALUES (?, ?, ?, ?, ?, ?)
	`, project.ID, project.Name, "", project.CreatedAt, bom.TotalPieces, bom.TotalLength)

	return err
}

func (s *Store) GetTrack(id string) (*core.TrackProject, error) {
	trackPath := filepath.Join(s.dataDir, "tracks", id+".json")
	data, err := os.ReadFile(trackPath)
	if err != nil {
		return nil, err
	}

	var project core.TrackProject
	if err := json.Unmarshal(data, &project); err != nil {
		return nil, err
	}

	return &project, nil
}

func (s *Store) ListTracks(page, size int, query string) ([]core.TrackMetadata, int, error) {
	offset := (page - 1) * size

	// Count total
	var total int
	countSQL := "SELECT COUNT(*) FROM tracks"
	whereClause := ""
	args := []interface{}{}

	if query != "" {
		whereClause = " WHERE name LIKE ?"
		args = append(args, "%"+query+"%")
		if err := s.db.QueryRow(countSQL+whereClause, args...).Scan(&total); err != nil {
			return nil, 0, err
		}
	} else {
		if err := s.db.QueryRow(countSQL).Scan(&total); err != nil {
			return nil, 0, err
		}
	}

	// Get page
	listSQL := `
		SELECT id, name, uploader_id, created_at, total_pieces, total_length
		FROM tracks` + whereClause + `
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`
	args = append(args, size, offset)

	rows, err := s.db.Query(listSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	tracks := []core.TrackMetadata{}
	for rows.Next() {
		var track core.TrackMetadata
		var createdAt string
		err := rows.Scan(&track.ID, &track.Name, &track.UploaderID, &createdAt, &track.TotalPieces, &track.TotalLength)
		if err != nil {
			continue
		}
		track.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		tracks = append(tracks, track)
	}

	return tracks, total, nil
}

func (s *Store) DeleteTrack(id string) error {
	trackPath := filepath.Join(s.dataDir, "tracks", id+".json")
	os.Remove(trackPath)

	_, err := s.db.Exec("DELETE FROM tracks WHERE id = ?", id)
	return err
}

func (s *Store) Close() error {
	return s.db.Close()
}
