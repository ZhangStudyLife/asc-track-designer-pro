package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/asc-lab/track-designer/internal/store"
	"github.com/go-chi/chi/v5"
)

// CommunityHandler handles community interaction endpoints
type CommunityHandler struct {
	store  *store.Store
	logger *slog.Logger
}

// NewCommunityHandler creates a new community handler
func NewCommunityHandler(store *store.Store, logger *slog.Logger) *CommunityHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &CommunityHandler{
		store:  store,
		logger: logger,
	}
}

// ToggleLike toggles like for a track (no auth required, uses IP)
func (h *CommunityHandler) ToggleLike(w http.ResponseWriter, r *http.Request) {
	trackID := chi.URLParam(r, "id")
	if trackID == "" {
		http.Error(w, `{"error":"缺少赛道ID"}`, http.StatusBadRequest)
		return
	}

	// Get user IP from context (injected by IP middleware)
	userIP, ok := r.Context().Value("client_ip").(string)
	if !ok || userIP == "" {
		userIP = r.RemoteAddr // fallback
	}

	likes, liked, err := h.store.ToggleLike(trackID, userIP)
	if err != nil {
		h.logger.Error("点赞操作失败", "error", err, "track_id", trackID)
		http.Error(w, `{"error":"点赞操作失败"}`, http.StatusInternalServerError)
		return
	}

	h.logger.Info("点赞操作", "track_id", trackID, "ip", userIP, "liked", liked, "total_likes", likes)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"liked":   liked,
		"likes":   likes,
	})
}

// GetLikeStatus gets like status for a track
func (h *CommunityHandler) GetLikeStatus(w http.ResponseWriter, r *http.Request) {
	trackID := chi.URLParam(r, "id")
	if trackID == "" {
		http.Error(w, `{"error":"缺少赛道ID"}`, http.StatusBadRequest)
		return
	}

	userIP, ok := r.Context().Value("client_ip").(string)
	if !ok || userIP == "" {
		userIP = r.RemoteAddr
	}

	liked, err := h.store.GetLikeStatus(trackID, userIP)
	if err != nil {
		h.logger.Error("获取点赞状态失败", "error", err)
		http.Error(w, `{"error":"获取点赞状态失败"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"liked": liked,
	})
}
