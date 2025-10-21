package api

import (
	"encoding/json"
	"fmt"
	"io"
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

func (h *Handler) UploadTrack(w http.ResponseWriter, r *http.Request) {
	// Limit upload size
	r.Body = http.MaxBytesReader(w, r.Body, h.maxUploadMB*1024*1024)

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, Response{
			Success: false,
			Error:   "Request too large",
		})
		return
	}

	// Try to import
	project, err := core.ImportLegacyJSON(body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, Response{
			Success: false,
			Error:   fmt.Sprintf("Invalid track data: %v", err),
		})
		return
	}

	// Set ID and timestamps
	project.ID = GenerateID()
	project.CreatedAt = time.Now()
	project.UpdatedAt = time.Now()

	if project.Name == "" {
		project.Name = "Untitled Track"
	}

	// Save
	if err := h.store.SaveTrack(project); err != nil {
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

	tracks, total, err := h.store.ListTracks(page, size, query)
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
