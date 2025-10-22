# GitHub OAuth 2.0 认证系统实现总结

## 已创建的文件

### 1. 配置模块 (`internal/config/config.go`)
扩展了配置结构，添加：
- `GitHubClientID` - GitHub OAuth 客户端 ID
- `GitHubClientSecret` - GitHub OAuth 客户端密钥
- `GitHubCallbackURL` - OAuth 回调 URL
- `JWTSecret` - JWT 签名密钥
- `JWTExpiryHours` - JWT 过期时间
- `.env` 文件加载器（支持环境变量配置）

### 2. JWT 工具 (`internal/auth/jwt.go`)
实现了 JWT 令牌管理：
- `GenerateToken()` - 生成 JWT 令牌
- `ValidateToken()` - 验证 JWT 令牌
- 使用 HS256 签名算法
- 自定义 Claims 包含用户信息（ID、用户名、头像）

### 3. 用户模型 (`internal/auth/models.go`)
定义了数据结构：
- `User` - 应用内部用户模型
- `GitHubUser` - GitHub API 返回的用户信息
- `GitHubTokenResponse` - GitHub OAuth Token 响应

### 4. OAuth 认证处理器 (`internal/api/auth.go`)
实现了完整的 OAuth 2.0 流程：
- `GitHubLogin()` - 发起 GitHub 登录（生成 state，重定向到 GitHub）
- `GitHubCallback()` - 处理 GitHub 回调（验证 state，交换 token，获取用户信息）
- `GetCurrentUser()` - 获取当前登录用户
- `Logout()` - 登出（清除 Cookie）
- CSRF 保护（state 参数验证）
- 错误处理和日志记录

### 5. 认证中间件 (`internal/middleware/auth.go`)
提供中间件功能：
- `RequireAuth` - 强制认证中间件（未登录返回 401）
- `OptionalAuth` - 可选认证中间件（登录则注入用户信息）
- `ExtendUserInfo` - 扩展用户信息到上下文
- `GetCurrentUser()` - 从上下文获取用户
- `GetUploaderInfo()` - 获取上传者信息

### 6. 主程序更新 (`cmd/trackd/main.go`)
集成认证系统：
- 初始化 `AuthHandler` 和 `AuthMiddleware`
- 配置认证路由：
  - `GET /api/auth/github` - 登录
  - `GET /api/auth/callback` - 回调
  - `GET /api/auth/user` - 获取用户（需认证）
  - `POST /api/auth/logout` - 登出
- 保护敏感接口（删除操作需要认证）
- 可选认证接口（上传赛道）
- 启动时显示 OAuth 配置状态

### 7. 环境配置文件 (`.env.example`)
提供配置模板：
- 服务器配置
- GitHub OAuth 配置
- JWT 配置
- 生产环境示例

### 8. OAuth 使用指南 (`docs/OAUTH_GUIDE.md`)
详细文档包含：
- 快速开始指南
- GitHub OAuth App 创建步骤
- 环境变量配置
- 生产环境部署指南
- Nginx 反向代理配置
- API 接口说明
- 前端调用示例
- 安全特性说明
- OAuth 流程图
- 故障排查指南

---

## OAuth 2.0 流程图

```
用户                     服务器                    GitHub
 │                        │                         │
 │  1. 点击登录            │                         │
 ├───────────────────────>│                         │
 │                        │                         │
 │  2. 重定向到 GitHub     │                         │
 │<───────────────────────┤                         │
 │                        │                         │
 │  3. 授权请求（state）                             │
 ├─────────────────────────────────────────────────>│
 │                        │                         │
 │  4. 授权页面                                      │
 │<─────────────────────────────────────────────────┤
 │                        │                         │
 │  5. 用户授权                                      │
 ├─────────────────────────────────────────────────>│
 │                        │                         │
 │  6. 回调（code + state）                         │
 │<─────────────────────────────────────────────────┤
 │                        │                         │
 │  7. 转发到服务器        │                         │
 ├───────────────────────>│                         │
 │                        │                         │
 │                        │  8. 验证 state           │
 │                        │  9. 交换 access_token    │
 │                        ├────────────────────────>│
 │                        │                         │
 │                        │  10. 返回 access_token   │
 │                        │<────────────────────────┤
 │                        │                         │
 │                        │  11. 获取用户信息        │
 │                        ├────────────────────────>│
 │                        │                         │
 │                        │  12. 返回用户信息        │
 │                        │<────────────────────────┤
 │                        │                         │
 │                        │  13. 生成 JWT            │
 │                        │  14. 设置 Cookie         │
 │                        │                         │
 │  15. 重定向到应用       │                         │
 │<───────────────────────┤                         │
 │                        │                         │
```

---

## API 接口

### 认证接口

#### 1. 发起登录
```http
GET /api/auth/github
```
- 生成随机 state（CSRF 保护）
- 存储 state 到 Cookie
- 重定向到 GitHub 授权页面

#### 2. 处理回调
```http
GET /api/auth/callback?code={code}&state={state}
```
- 验证 state 参数
- 用 code 交换 access_token
- 获取 GitHub 用户信息
- 生成 JWT 并设置 Cookie
- 重定向到前端（`/?auth=success`）

#### 3. 获取当前用户
```http
GET /api/auth/user
```
- **需要认证**
- 返回当前登录用户信息

响应：
```json
{
  "success": true,
  "data": {
    "id": "123456",
    "username": "johndoe",
    "name": "John Doe",
    "email": "john@example.com",
    "avatar_url": "https://avatars.githubusercontent.com/u/123456"
  }
}
```

#### 4. 登出
```http
POST /api/auth/logout
```
- 清除认证 Cookie

响应：
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

### 受保护的接口

以下接口需要认证：
- `DELETE /api/tracks/{id}` - 删除赛道
- `GET /api/auth/user` - 获取用户信息

以下接口可选认证（登录后自动关联用户）：
- `POST /api/tracks` - 上传赛道

---

## 安全特性

### 1. CSRF 保护
- 使用随机 state 参数（32 字节 base64 编码）
- state 存储在 HttpOnly Cookie
- 回调时验证 state 一致性
- state 有效期 5 分钟

### 2. JWT 安全
- **HttpOnly Cookie** - 防止 XSS 攻击
- **SameSite=Lax** - 防止 CSRF 攻击
- **Secure Flag** - HTTPS 环境下自动启用
- **7 天过期时间** - 自动过期
- **HS256 签名** - 防止篡改

### 3. Cookie 配置
```go
http.SetCookie(w, &http.Cookie{
    Name:     "asc_track_token",
    Value:    jwtToken,
    MaxAge:   604800,              // 7 days
    HttpOnly: true,                 // 防止 JavaScript 访问
    Secure:   r.TLS != nil,         // HTTPS only
    SameSite: http.SameSiteLaxMode, // CSRF 保护
    Path:     "/",
})
```

### 4. 速率限制
- 认证接口：10 请求/分钟
- 上传接口：5 请求/10 分钟
- 下载接口：20 请求/分钟
- 列表接口：30 请求/分钟

---

## 环境变量配置

### 开发环境
```env
PORT=8080
DATA_DIR=./data
GITHUB_CLIENT_ID=你的开发Client_ID
GITHUB_CLIENT_SECRET=你的开发Client_Secret
GITHUB_CALLBACK_URL=http://localhost:8080/api/auth/callback
JWT_SECRET=开发环境密钥
```

### 生产环境
```env
PORT=8080
DATA_DIR=/opt/trackd/data
GITHUB_CLIENT_ID=你的生产Client_ID
GITHUB_CLIENT_SECRET=你的生产Client_Secret
GITHUB_CALLBACK_URL=https://yourdomain.com/api/auth/callback
JWT_SECRET=强随机密钥（使用 openssl rand -base64 32 生成）
```

---

## 前端集成示例

### 发起登录
```typescript
// 方法 1: 直接跳转
window.location.href = '/api/auth/github';

// 方法 2: 使用按钮
<button onClick={() => window.location.href = '/api/auth/github'}>
  Login with GitHub
</button>
```

### 获取当前用户
```typescript
async function getCurrentUser() {
  try {
    const response = await fetch('/api/auth/user', {
      credentials: 'include' // 重要：携带 Cookie
    });

    if (!response.ok) {
      // 未登录或 Token 过期
      return null;
    }

    const { data: user } = await response.json();
    return user;
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
}
```

### 登出
```typescript
async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });

    // 重定向到首页
    window.location.href = '/';
  } catch (error) {
    console.error('Logout failed:', error);
  }
}
```

### React Hook 示例
```typescript
import { useState, useEffect } from 'react';

function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setLoading(false);
    }
    loadUser();
  }, []);

  const login = () => {
    window.location.href = '/api/auth/github';
  };

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    setUser(null);
    window.location.href = '/';
  };

  return { user, loading, login, logout };
}

// 使用
function App() {
  const { user, loading, login, logout } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {user ? (
        <div>
          <img src={user.avatar_url} alt={user.username} />
          <span>Welcome, {user.username}</span>
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <button onClick={login}>Login with GitHub</button>
      )}
    </div>
  );
}
```

---

## 测试步骤

### 1. 配置 GitHub OAuth App
1. 访问 https://github.com/settings/developers
2. 创建 New OAuth App
3. 设置 Callback URL: `http://localhost:8080/api/auth/callback`
4. 复制 Client ID 和 Secret

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env，填入 GitHub 凭据
```

### 3. 安装依赖
```bash
go mod download
```

### 4. 启动服务
```bash
go run cmd/trackd/main.go
```

### 5. 测试登录流程
1. 访问 `http://localhost:8080`
2. 点击登录按钮（或访问 `/api/auth/github`）
3. 授权 GitHub 应用
4. 检查是否成功重定向并登录

### 6. 测试 API
```bash
# 获取当前用户（需要先登录）
curl -X GET http://localhost:8080/api/auth/user \
  -H "Cookie: asc_track_token=YOUR_JWT_TOKEN"

# 登出
curl -X POST http://localhost:8080/api/auth/logout \
  -H "Cookie: asc_track_token=YOUR_JWT_TOKEN"
```

---

## 故障排查

### 问题：OAuth 回调失败
**症状**: 回调时显示 "redirect_uri_mismatch"

**解决方案**:
1. 检查 `.env` 中的 `GITHUB_CALLBACK_URL`
2. 确保与 GitHub OAuth App 配置一致
3. 开发环境：`http://localhost:8080/api/auth/callback`
4. 生产环境：`https://yourdomain.com/api/auth/callback`

### 问题：JWT 验证失败
**症状**: `/api/auth/user` 返回 401

**解决方案**:
1. 检查 Cookie 是否正确设置（浏览器开发者工具 → Application → Cookies）
2. 检查 `JWT_SECRET` 是否一致
3. 检查前端请求是否包含 `credentials: 'include'`

### 问题：CORS 错误
**症状**: 浏览器控制台显示 CORS 错误

**解决方案**:
1. 确保前端请求包含 `credentials: 'include'`
2. 检查后端 CORS 配置允许 credentials
3. 生产环境配置特定域名白名单

### 问题：State mismatch
**症状**: 回调时显示 "State mismatch"

**解决方案**:
1. 检查浏览器是否启用 Cookie
2. 检查浏览器是否允许第三方 Cookie
3. 确保没有多次点击登录按钮

---

## 依赖项

所有依赖已包含在 `go.mod`：
- `github.com/golang-jwt/jwt/v5` - JWT 令牌处理
- `github.com/go-chi/chi/v5` - HTTP 路由
- `github.com/go-chi/cors` - CORS 中间件
- `golang.org/x/time` - 速率限制

---

## 下一步改进

### 可选功能
1. **刷新令牌** - 实现 access token 刷新机制
2. **用户数据库** - 存储用户信息到 SQLite
3. **权限系统** - 实现细粒度权限控制
4. **多 OAuth 提供商** - 支持 Google、GitLab 等
5. **2FA 支持** - 两步验证
6. **会话管理** - 多设备登录管理

### 安全增强
1. **IP 白名单** - 限制 OAuth 回调来源
2. **审计日志** - 记录所有认证事件
3. **异常检测** - 检测异常登录行为
4. **自动封禁** - 暴力破解防护

---

## License

MIT License
