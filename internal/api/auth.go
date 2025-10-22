package api

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/asc-lab/track-designer/internal/auth"
	"github.com/asc-lab/track-designer/internal/store"
)

// AuthHandler GitHub OAuth 认证处理器
type AuthHandler struct {
	clientID     string
	clientSecret string
	redirectURL  string
	jwtManager   *auth.JWTManager
	store        *store.Store
	logger       *slog.Logger

	// CSRF state管理
	states   sync.Map // map[string]time.Time
	statesMu sync.Mutex
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(
	clientID, clientSecret, redirectURL string,
	jwtManager *auth.JWTManager,
	st *store.Store,
	logger *slog.Logger,
) *AuthHandler {
	if logger == nil {
		logger = slog.Default()
	}

	h := &AuthHandler{
		clientID:     clientID,
		clientSecret: clientSecret,
		redirectURL:  redirectURL,
		jwtManager:   jwtManager,
		store:        st,
		logger:       logger,
	}

	// 定期清理过期的state
	go h.cleanupStates()

	return h
}

// GitHubLogin 生成GitHub登录URL
func (h *AuthHandler) GitHubLogin(w http.ResponseWriter, r *http.Request) {
	// 检查OAuth是否已配置
	if h.clientID == "" || h.clientSecret == "" {
		http.Error(w, `{"error":"GitHub OAuth未配置，请设置GITHUB_CLIENT_ID和GITHUB_CLIENT_SECRET环境变量"}`, http.StatusServiceUnavailable)
		return
	}

	// 生成CSRF state
	state := h.generateState()
	h.states.Store(state, time.Now().Add(10*time.Minute))

	// 构建GitHub OAuth URL
	authURL := fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&state=%s&scope=user:email",
		h.clientID,
		url.QueryEscape(h.redirectURL),
		state,
	)

	// 返回JSON格式的URL（前端会重定向）
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"url": authURL,
	})
}

// GitHubCallback GitHub OAuth 回调
func (h *AuthHandler) GitHubCallback(w http.ResponseWriter, r *http.Request) {
	// 验证state（CSRF防护）
	state := r.URL.Query().Get("state")
	if _, ok := h.states.Load(state); !ok {
		h.logger.Warn("无效的OAuth state")
		http.Error(w, "Invalid state", http.StatusBadRequest)
		return
	}
	h.states.Delete(state)

	// 获取code
	code := r.URL.Query().Get("code")
	if code == "" {
		h.logger.Warn("缺少OAuth code")
		http.Error(w, "Missing code", http.StatusBadRequest)
		return
	}

	// 用code换取access_token
	accessToken, err := h.exchangeCodeForToken(code)
	if err != nil {
		h.logger.Error("换取access token失败", "error", err)
		http.Error(w, "Failed to exchange code for token", http.StatusInternalServerError)
		return
	}

	// 获取GitHub用户信息
	githubUser, err := h.getGitHubUser(accessToken)
	if err != nil {
		h.logger.Error("获取GitHub用户信息失败", "error", err)
		http.Error(w, "Failed to get user info", http.StatusInternalServerError)
		return
	}

	// 转换为内部用户模型
	user := &auth.User{
		ID:        fmt.Sprintf("%d", githubUser.ID),
		Login:     githubUser.Login,
		Name:      githubUser.Name,
		AvatarURL: githubUser.AvatarURL,
		Email:     githubUser.Email,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// 保存或更新用户信息到数据库
	// 转换为store.User类型
	storeUser := &store.User{
		ID:        user.ID,
		Login:     user.Login,
		Name:      user.Name,
		Email:     user.Email,
		AvatarURL: user.AvatarURL,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
	}
	if err := h.store.UpsertUser(storeUser); err != nil {
		h.logger.Error("保存用户失败", "error", err)
		http.Error(w, "Failed to save user", http.StatusInternalServerError)
		return
	}

	// 生成JWT token
	token, err := h.jwtManager.Generate(user)
	if err != nil {
		h.logger.Error("生成JWT失败", "error", err)
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// 方案:将token通过URL传给前端,由前端存储到localStorage
	// 这样可以避免浏览器Cookie的第三方策略问题
	h.logger.Info("用户登录成功", "user", user.Login, "user_id", user.ID)

	// 重定向到前端,使用query参数传递token(临时方案,更可靠)
	// TODO: 生产环境应该使用更安全的方式,如POST到回调页面
	redirectURL := fmt.Sprintf("/?auth_token=%s", token)
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// GetCurrentUser 获取当前登录用户
func (h *AuthHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	// 从context获取用户信息（由auth middleware注入）
	claimsValue := r.Context().Value("user")
	if claimsValue == nil {
		h.logger.Error("context中没有用户信息")
		http.Error(w, `{"error":"未登录"}`, http.StatusUnauthorized)
		return
	}

	claims, ok := claimsValue.(*auth.TokenClaims)
	if !ok {
		h.logger.Error("context中的用户信息类型错误")
		http.Error(w, `{"error":"认证信息错误"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":         claims.UserID,
		"login":      claims.Login,
		"name":       claims.Name,
		"avatar_url": claims.AvatarURL,
	})
}

// Logout 登出
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	// 清除cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "auth_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "已登出",
	})
}

// exchangeCodeForToken 用code换取access_token
func (h *AuthHandler) exchangeCodeForToken(code string) (string, error) {
	data := url.Values{
		"client_id":     {h.clientID},
		"client_secret": {h.clientSecret},
		"code":          {code},
		"redirect_uri":  {h.redirectURL},
	}

	resp, err := http.PostForm("https://github.com/login/oauth/access_token", data)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	// 解析响应
	params, err := url.ParseQuery(string(body))
	if err != nil {
		return "", err
	}

	accessToken := params.Get("access_token")
	if accessToken == "" {
		return "", fmt.Errorf("no access token in response: %s", string(body))
	}

	return accessToken, nil
}

// getGitHubUser 获取GitHub用户信息
func (h *AuthHandler) getGitHubUser(accessToken string) (*auth.GitHubUser, error) {
	req, err := http.NewRequest("GET", "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API error: %d - %s", resp.StatusCode, string(body))
	}

	var user auth.GitHubUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

// generateState 生成随机state
func (h *AuthHandler) generateState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// cleanupStates 定期清理过期的state
func (h *AuthHandler) cleanupStates() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		h.states.Range(func(key, value interface{}) bool {
			if expiry, ok := value.(time.Time); ok && now.After(expiry) {
				h.states.Delete(key)
			}
			return true
		})
	}
}
