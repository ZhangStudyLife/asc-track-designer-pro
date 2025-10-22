package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
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
	// 添加SQLite连接参数以支持并发和WAL模式
	db, err := sql.Open("sqlite", dbPath+"?_busy_timeout=5000&_journal_mode=WAL")
	if err != nil {
		return nil, err
	}

	// 设置连接池参数以减少并发冲突
	db.SetMaxOpenConns(1)  // SQLite建议使用单连接
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(0)

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
		description TEXT DEFAULT '',
		tags TEXT DEFAULT '[]',
		uploader_id TEXT,
		uploader_name TEXT DEFAULT '',
		uploader_avatar TEXT DEFAULT '',
		created_at DATETIME NOT NULL,
		total_pieces INTEGER DEFAULT 0,
		total_length TEXT DEFAULT '0.00',
		total_length_cm INTEGER DEFAULT 0,
		thumbnail TEXT DEFAULT '',
		likes INTEGER DEFAULT 0,
		downloads INTEGER DEFAULT 0
	);
	CREATE INDEX IF NOT EXISTS idx_tracks_created ON tracks(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_tracks_length ON tracks(total_length_cm);
	CREATE INDEX IF NOT EXISTS idx_tracks_likes ON tracks(likes DESC);
	CREATE INDEX IF NOT EXISTS idx_tracks_downloads ON tracks(downloads DESC);

	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		login TEXT NOT NULL UNIQUE,
		name TEXT DEFAULT '',
		email TEXT DEFAULT '',
		avatar_url TEXT DEFAULT '',
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);

	-- 用户点赞记录表(防止重复点赞)
	CREATE TABLE IF NOT EXISTS track_likes (
		track_id TEXT NOT NULL,
		user_ip TEXT NOT NULL,
		liked_at DATETIME NOT NULL,
		PRIMARY KEY (track_id, user_ip)
	);
	CREATE INDEX IF NOT EXISTS idx_track_likes_track ON track_likes(track_id);
	`
	if _, err := s.db.Exec(schema); err != nil {
		return err
	}

	// Migrate existing tables: add new columns if they don't exist
	// SQLite doesn't have ALTER TABLE IF NOT EXISTS, so we ignore errors for existing columns
	s.db.Exec("ALTER TABLE tracks ADD COLUMN description TEXT DEFAULT ''")
	s.db.Exec("ALTER TABLE tracks ADD COLUMN thumbnail TEXT DEFAULT ''")
	s.db.Exec("ALTER TABLE tracks ADD COLUMN tags TEXT DEFAULT '[]'")
	s.db.Exec("ALTER TABLE tracks ADD COLUMN total_length_cm INTEGER DEFAULT 0")
	s.db.Exec("ALTER TABLE tracks ADD COLUMN uploader_name TEXT DEFAULT ''")
	s.db.Exec("ALTER TABLE tracks ADD COLUMN uploader_avatar TEXT DEFAULT ''")
	s.db.Exec("ALTER TABLE tracks ADD COLUMN likes INTEGER DEFAULT 0")
	s.db.Exec("ALTER TABLE tracks ADD COLUMN downloads INTEGER DEFAULT 0")

	return nil
}

func (s *Store) SaveTrack(project *core.TrackProject, thumbnail string) error {
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

	// Convert total length to cm (stored as string "12.34" meters)
	totalLengthCm := 0
	if _, err := fmt.Sscanf(bom.TotalLength, "%d", &totalLengthCm); err == nil {
		totalLengthCm = int(totalLengthCm * 100) // convert meters to cm
	}

	// Serialize tags to JSON
	tagsJSON, err := json.Marshal(project.Tags)
	if err != nil {
		tagsJSON = []byte("[]")
	}

	// Get description from project
	description := ""
	if project.Description != "" {
		description = project.Description
	}

	// Save metadata
	_, err = s.db.Exec(`
		INSERT OR REPLACE INTO tracks (
			id, name, description, tags,
			uploader_id, uploader_name, uploader_avatar,
			created_at, total_pieces, total_length, total_length_cm, thumbnail, likes, downloads
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, project.ID, project.Name, description, string(tagsJSON),
		project.UploaderID, project.UploaderName, project.UploaderAvatar,
		project.CreatedAt, bom.TotalPieces, bom.TotalLength, totalLengthCm, thumbnail)

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
		SELECT id, name, description, tags,
		       uploader_id, uploader_name, uploader_avatar,
		       created_at, total_pieces, total_length, total_length_cm, thumbnail, likes, downloads
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
		var tagsJSON string
		err := rows.Scan(
			&track.ID, &track.Name, &track.Description, &tagsJSON,
			&track.UploaderID, &track.UploaderName, &track.UploaderAvatar,
			&createdAt, &track.TotalPieces, &track.TotalLength, &track.TotalLengthCm, &track.Thumbnail,
			&track.Likes, &track.Downloads)
		if err != nil {
			continue
		}
		track.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)

		// Parse tags JSON
		if tagsJSON != "" {
			json.Unmarshal([]byte(tagsJSON), &track.Tags)
		}

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

// ListTracksWithFilters searches tracks with tag and length filters
func (s *Store) ListTracksWithFilters(page, size int, query string, tags []string, minLength, maxLength int) ([]core.TrackMetadata, int, error) {
	offset := (page - 1) * size

	// Build WHERE clause
	whereConditions := []string{}
	args := []interface{}{}

	if query != "" {
		whereConditions = append(whereConditions, "name LIKE ?")
		args = append(args, "%"+query+"%")
	}

	// Tag filtering: check if tags JSON contains any of the requested tags
	// SQLite has limited JSON support, so we use simple string matching
	if len(tags) > 0 {
		tagConditions := []string{}
		for _, tag := range tags {
			tagConditions = append(tagConditions, "tags LIKE ?")
			args = append(args, "%\""+tag+"\"%")
		}
		whereConditions = append(whereConditions, "("+joinStrings(tagConditions, " OR ")+")")
	}

	// Length filtering (in cm)
	if minLength > 0 {
		whereConditions = append(whereConditions, "total_length_cm >= ?")
		args = append(args, minLength)
	}
	if maxLength > 0 {
		whereConditions = append(whereConditions, "total_length_cm <= ?")
		args = append(args, maxLength)
	}

	whereClause := ""
	if len(whereConditions) > 0 {
		whereClause = " WHERE " + joinStrings(whereConditions, " AND ")
	}

	// Count total
	var total int
	countSQL := "SELECT COUNT(*) FROM tracks" + whereClause
	if err := s.db.QueryRow(countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Get page
	listSQL := `
		SELECT id, name, description, tags,
		       uploader_id, uploader_name, uploader_avatar,
		       created_at, total_pieces, total_length, total_length_cm, thumbnail, likes, downloads
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
		var tagsJSON string
		err := rows.Scan(
			&track.ID, &track.Name, &track.Description, &tagsJSON,
			&track.UploaderID, &track.UploaderName, &track.UploaderAvatar,
			&createdAt, &track.TotalPieces, &track.TotalLength, &track.TotalLengthCm, &track.Thumbnail,
			&track.Likes, &track.Downloads)
		if err != nil {
			continue
		}
		track.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)

		// Parse tags JSON
		if tagsJSON != "" {
			json.Unmarshal([]byte(tagsJSON), &track.Tags)
		}

		tracks = append(tracks, track)
	}

	return tracks, total, nil
}

// GetAllTags retrieves all unique tags used across all tracks
func (s *Store) GetAllTags() ([]string, error) {
	rows, err := s.db.Query("SELECT DISTINCT tags FROM tracks WHERE tags != '[]' AND tags != ''")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tagSet := make(map[string]bool)
	for rows.Next() {
		var tagsJSON string
		if err := rows.Scan(&tagsJSON); err != nil {
			continue
		}

		var tags []string
		if err := json.Unmarshal([]byte(tagsJSON), &tags); err == nil {
			for _, tag := range tags {
				if tag != "" {
					tagSet[tag] = true
				}
			}
		}
	}

	// Convert map to sorted slice
	tags := make([]string, 0, len(tagSet))
	for tag := range tagSet {
		tags = append(tags, tag)
	}

	return tags, nil
}

// Helper function to join strings
func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += sep + strs[i]
	}
	return result
}

// User management methods

// UpsertUser inserts or updates a user
func (s *Store) UpsertUser(user *User) error {
	_, err := s.db.Exec(`
		INSERT INTO users (id, login, name, email, avatar_url, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			login = excluded.login,
			name = excluded.name,
			email = excluded.email,
			avatar_url = excluded.avatar_url,
			updated_at = excluded.updated_at
	`, user.ID, user.Login, user.Name, user.Email, user.AvatarURL,
		user.CreatedAt.Format(time.RFC3339), user.UpdatedAt.Format(time.RFC3339))

	return err
}

// GetUser retrieves a user by ID
func (s *Store) GetUser(id string) (*User, error) {
	var user User
	var createdAt, updatedAt string

	err := s.db.QueryRow(`
		SELECT id, login, name, email, avatar_url, created_at, updated_at
		FROM users
		WHERE id = ?
	`, id).Scan(&user.ID, &user.Login, &user.Name, &user.Email, &user.AvatarURL, &createdAt, &updatedAt)

	if err != nil {
		return nil, err
	}

	user.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	user.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)

	return &user, nil
}

// GetUserByLogin retrieves a user by login name
func (s *Store) GetUserByLogin(login string) (*User, error) {
	var user User
	var createdAt, updatedAt string

	err := s.db.QueryRow(`
		SELECT id, login, name, email, avatar_url, created_at, updated_at
		FROM users
		WHERE login = ?
	`, login).Scan(&user.ID, &user.Login, &user.Name, &user.Email, &user.AvatarURL, &createdAt, &updatedAt)

	if err != nil {
		return nil, err
	}

	user.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	user.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)

	return &user, nil
}

// User model for store
type User struct {
	ID        string
	Login     string
	Name      string
	Email     string
	AvatarURL string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// ToggleLike toggles a like for a track (returns new like count and whether liked)
func (s *Store) ToggleLike(trackID, userIP string) (int, bool, error) {
	// Check if already liked
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM track_likes WHERE track_id = ? AND user_ip = ?)
	`, trackID, userIP).Scan(&exists)
	if err != nil {
		return 0, false, err
	}

	tx, err := s.db.Begin()
	if err != nil {
		return 0, false, err
	}
	defer tx.Rollback()

	if exists {
		// Unlike: remove record and decrement
		_, err = tx.Exec(`DELETE FROM track_likes WHERE track_id = ? AND user_ip = ?`, trackID, userIP)
		if err != nil {
			return 0, false, err
		}
		_, err = tx.Exec(`UPDATE tracks SET likes = likes - 1 WHERE id = ? AND likes > 0`, trackID)
		if err != nil {
			return 0, false, err
		}
	} else {
		// Like: add record and increment
		_, err = tx.Exec(`INSERT INTO track_likes (track_id, user_ip, liked_at) VALUES (?, ?, ?)`,
			trackID, userIP, time.Now().Format(time.RFC3339))
		if err != nil {
			return 0, false, err
		}
		_, err = tx.Exec(`UPDATE tracks SET likes = likes + 1 WHERE id = ?`, trackID)
		if err != nil {
			return 0, false, err
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, false, err
	}

	// Get new like count
	var likes int
	err = s.db.QueryRow(`SELECT likes FROM tracks WHERE id = ?`, trackID).Scan(&likes)
	if err != nil {
		return 0, false, err
	}

	return likes, !exists, nil
}

// IncrementDownloads increments download count for a track
func (s *Store) IncrementDownloads(trackID string) error {
	_, err := s.db.Exec(`UPDATE tracks SET downloads = downloads + 1 WHERE id = ?`, trackID)
	return err
}

// GetLikeStatus checks if a user has liked a track
func (s *Store) GetLikeStatus(trackID, userIP string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM track_likes WHERE track_id = ? AND user_ip = ?)
	`, trackID, userIP).Scan(&exists)
	return exists, err
}
