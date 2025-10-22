package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/asc-lab/track-designer/internal/core"
	"github.com/asc-lab/track-designer/internal/store"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	store       *store.Store
	maxUploadMB int64
}

func NewHandler(store *store.Store, maxUploadMB int64) *Handler {
	return &Handler{
		store:       store,
		maxUploadMB: maxUploadMB,
	}
}

type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, Response{
		Success: true,
		Data: map[string]string{
			"status":  "ok",
			"version": "1.0.0",
		},
	})
}

type UploadRequest struct {
	Name           string          `json:"name"`
	Description    string          `json:"description"`
	Tags           []string        `json:"tags"`
	UploaderName   string          `json:"uploaderName"`
	UploaderAvatar string          `json:"uploaderAvatar"`
	Thumbnail      string          `json:"thumbnail"`
	Project        json.RawMessage `json:"project"`
}

func (h *Handler) UploadTrack(w http.ResponseWriter, r *http.Request) {
	// Limit upload size
	r.Body = http.MaxBytesReader(w, r.Body, h.maxUploadMB*1024*1024)

	var req UploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, Response{
			Success: false,
			Error:   "Invalid request format",
		})
		return
	}

	// Try to import
	project, err := core.ImportLegacyJSON(req.Project)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, Response{
			Success: false,
			Error:   fmt.Sprintf("Invalid track data: %v", err),
		})
		return
	}

	// Set metadata from request
	project.ID = GenerateID()
	project.CreatedAt = time.Now()
	project.UpdatedAt = time.Now()

	if req.Name != "" {
		project.Name = req.Name
	} else if project.Name == "" {
		project.Name = "Untitled Track"
	}

	if req.Description != "" {
		project.Description = req.Description
	}

	// Set tags and uploader info
	if len(req.Tags) > 0 {
		project.Tags = req.Tags
	}
	if req.UploaderName != "" {
		project.UploaderName = req.UploaderName
	}
	if req.UploaderAvatar != "" {
		project.UploaderAvatar = req.UploaderAvatar
	}

	// Save (with thumbnail)
	if err := h.store.SaveTrack(project, req.Thumbnail); err != nil {
		writeJSON(w, http.StatusInternalServerError, Response{
			Success: false,
			Error:   "Failed to save track",
		})
		return
	}

	writeJSON(w, http.StatusCreated, Response{
		Success: true,
		Data: map[string]interface{}{
			"id":        project.ID,
			"name":      project.Name,
			"createdAt": project.CreatedAt,
		},
	})
}

func (h *Handler) ListTracks(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}

	size, _ := strconv.Atoi(r.URL.Query().Get("size"))
	if size < 1 || size > 100 {
		size = 20
	}

	query := r.URL.Query().Get("q")

	// Parse tag filters (comma-separated)
	var tags []string
	if tagsParam := r.URL.Query().Get("tags"); tagsParam != "" {
		for _, tag := range splitString(tagsParam, ",") {
			tag = trimString(tag)
			if tag != "" {
				tags = append(tags, tag)
			}
		}
	}

	// Parse length filters (in cm)
	minLength, _ := strconv.Atoi(r.URL.Query().Get("minLength"))
	maxLength, _ := strconv.Atoi(r.URL.Query().Get("maxLength"))

	// Use filtered query if filters are present
	var tracks []core.TrackMetadata
	var total int
	var err error

	if len(tags) > 0 || minLength > 0 || maxLength > 0 {
		tracks, total, err = h.store.ListTracksWithFilters(page, size, query, tags, minLength, maxLength)
	} else {
		tracks, total, err = h.store.ListTracks(page, size, query)
	}

	if err != nil {
		writeJSON(w, http.StatusInternalServerError, Response{
			Success: false,
			Error:   "Failed to list tracks",
		})
		return
	}

	writeJSON(w, http.StatusOK, Response{
		Success: true,
		Data: map[string]interface{}{
			"items": tracks,
			"total": total,
			"page":  page,
			"size":  size,
		},
	})
}

func (h *Handler) GetTrack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	project, err := h.store.GetTrack(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, Response{
			Success: false,
			Error:   "Track not found",
		})
		return
	}

	// Add BOM
	bom := core.GenerateBOM(project)

	writeJSON(w, http.StatusOK, Response{
		Success: true,
		Data: map[string]interface{}{
			"project": project,
			"bom":     bom,
		},
	})
}

func (h *Handler) DownloadTrack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	project, err := h.store.GetTrack(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, Response{
			Success: false,
			Error:   "Track not found",
		})
		return
	}

	// Increment download count (non-blocking, don't fail if this fails)
	if err := h.store.IncrementDownloads(id); err != nil {
		// Log error but don't block download
		fmt.Printf("Warning: failed to increment download count for track %s: %v\n", id, err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.json\"", project.Name))
	json.NewEncoder(w).Encode(project)
}

func (h *Handler) DeleteTrack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.store.DeleteTrack(id); err != nil {
		writeJSON(w, http.StatusInternalServerError, Response{
			Success: false,
			Error:   "Failed to delete track",
		})
		return
	}

	writeJSON(w, http.StatusOK, Response{
		Success: true,
	})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// GetTags returns all unique tags used across tracks
func (h *Handler) GetTags(w http.ResponseWriter, r *http.Request) {
	tags, err := h.store.GetAllTags()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, Response{
			Success: false,
			Error:   "Failed to get tags",
		})
		return
	}

	// Include predefined tags
	predefinedTags := []string{"初学者", "中级", "高级", "圆形", "8字形", "直线", "长距离", "短距离"}

	// Merge with unique existing tags
	tagSet := make(map[string]bool)
	for _, tag := range predefinedTags {
		tagSet[tag] = true
	}
	for _, tag := range tags {
		tagSet[tag] = true
	}

	// Convert to slice
	allTags := make([]string, 0, len(tagSet))
	for tag := range tagSet {
		allTags = append(allTags, tag)
	}

	writeJSON(w, http.StatusOK, Response{
		Success: true,
		Data: map[string]interface{}{
			"tags":       allTags,
			"predefined": predefinedTags,
		},
	})
}

// Helper functions
func splitString(s, sep string) []string {
	if s == "" {
		return []string{}
	}
	var result []string
	current := ""
	for _, c := range s {
		if string(c) == sep {
			if current != "" {
				result = append(result, current)
				current = ""
			}
		} else {
			current += string(c)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

func trimString(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}
