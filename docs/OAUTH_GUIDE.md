# GitHub OAuth 认证系统配置指南

## 快速开始

### 1. 创建 GitHub OAuth App

1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. 点击 "New OAuth App"
3. 填写以下信息：
   - **Application name**: ASC Track Designer
   - **Homepage URL**: `http://localhost:8080`
   - **Authorization callback URL**: `http://localhost:8080/api/auth/callback`
4. 点击 "Register application"
5. 复制 `Client ID` 和 `Client Secret`

### 2. 配置环境变量

复制 `.env.example` 到 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 GitHub OAuth 凭据：

```env
GITHUB_CLIENT_ID=你的Client_ID
GITHUB_CLIENT_SECRET=你的Client_Secret
JWT_SECRET=你的随机密钥
```

生成安全的 JWT Secret：

```bash
# Linux/Mac
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### 3. 启动服务

```bash
go run cmd/trackd/main.go
```

访问 `http://localhost:8080`，点击登录按钮即可使用 GitHub 账号登录。

---

## 生产环境部署

### 配置说明

生产环境需要修改以下配置：

```env
PORT=8080
DATA_DIR=/opt/trackd/data

# GitHub OAuth (使用生产域名)
GITHUB_CLIENT_ID=你的生产Client_ID
GITHUB_CLIENT_SECRET=你的生产Client_Secret
GITHUB_CALLBACK_URL=https://yourdomain.com/api/auth/callback

# JWT (必须使用强密钥)
JWT_SECRET=你的安全随机密钥
```

### 创建生产环境 OAuth App

1. 在 GitHub 创建新的 OAuth App
2. Callback URL 使用: `https://yourdomain.com/api/auth/callback`
3. 获取新的 Client ID 和 Secret

### Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 强制 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## API 接口说明

### 认证流程

1. **发起登录** (`GET /api/auth/github`)
   - 重定向到 GitHub 授权页面
   - 自动添加 CSRF 保护

2. **处理回调** (`GET /api/auth/callback`)
   - 验证 state 参数（CSRF 保护）
   - 交换 access token
   - 获取用户信息
   - 生成 JWT 并设置 Cookie
   - 重定向到前端

3. **获取当前用户** (`GET /api/auth/user`)
   - 需要认证
   - 返回当前登录用户信息

4. **登出** (`POST /api/auth/logout`)
   - 清除认证 Cookie

### 前端调用示例

```typescript
// 发起登录
window.location.href = '/api/auth/github';

// 获取当前用户
const response = await fetch('/api/auth/user', {
  credentials: 'include' // 重要：携带 Cookie
});
const { data: user } = await response.json();

// 登出
await fetch('/api/auth/logout', {
  method: 'POST',
  credentials: 'include'
});
```

### 受保护的接口

以下接口需要认证：
- `DELETE /api/tracks/{id}` - 删除赛道（需要登录）
- `GET /api/auth/user` - 获取用户信息（需要登录）

以下接口可选认证（登录后自动关联用户）：
- `POST /api/tracks` - 上传赛道

---

## 安全特性

### CSRF 保护
- 使用随机 state 参数
- state 存储在 HttpOnly Cookie
- 回调时验证 state 一致性

### JWT 安全
- HttpOnly Cookie（防止 XSS）
- SameSite=Lax（防止 CSRF）
- 7 天过期时间
- HS256 签名算法

### 生产环境建议
- 使用 HTTPS（Secure Cookie）
- 设置强 JWT Secret（≥32 字符）
- 配置正确的 CORS 白名单
- 启用速率限制（已内置）

---

## 故障排查

### 问题：OAuth 重定向失败
- 检查 Callback URL 是否与 GitHub 配置一致
- 检查 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET 是否正确

### 问题：JWT 验证失败
- 检查 JWT_SECRET 是否一致（前后端）
- 检查 Cookie 是否正确设置（浏览器开发者工具）

### 问题：CORS 错误
- 检查前端是否使用 `credentials: 'include'`
- 检查后端 CORS 配置是否允许 credentials

---

## OAuth 流程图

```
┌─────────┐                ┌─────────┐                ┌─────────┐
│ 用户    │                │ 服务器  │                │ GitHub  │
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     │ 1. 点击登录               │                          │
     ├─────────────────────────>│                          │
     │                          │                          │
     │ 2. 生成 state, 重定向     │                          │
     │<─────────────────────────┤                          │
     │                          │                          │
     │ 3. 授权请求（带 state）                              │
     ├────────────────────────────────────────────────────>│
     │                          │                          │
     │ 4. GitHub 授权页面                                   │
     │<────────────────────────────────────────────────────┤
     │                          │                          │
     │ 5. 用户授权                                          │
     ├────────────────────────────────────────────────────>│
     │                          │                          │
     │ 6. 回调（code + state）                             │
     │<────────────────────────────────────────────────────┤
     │                          │                          │
     │ 7. 转发回调              │                          │
     ├─────────────────────────>│                          │
     │                          │                          │
     │                          │ 8. 验证 state            │
     │                          ├──────┐                   │
     │                          │<─────┘                   │
     │                          │                          │
     │                          │ 9. 交换 access_token     │
     │                          ├────────────────────────>│
     │                          │                          │
     │                          │ 10. 返回 access_token    │
     │                          │<────────────────────────┤
     │                          │                          │
     │                          │ 11. 获取用户信息         │
     │                          ├────────────────────────>│
     │                          │                          │
     │                          │ 12. 返回用户信息         │
     │                          │<────────────────────────┤
     │                          │                          │
     │                          │ 13. 生成 JWT             │
     │                          ├──────┐                   │
     │                          │<─────┘                   │
     │                          │                          │
     │ 14. 设置 Cookie, 重定向   │                          │
     │<─────────────────────────┤                          │
     │                          │                          │
     │ 15. 访问应用（已登录）    │                          │
     ├─────────────────────────>│                          │
     │                          │                          │
```

---

## 开发模式 vs 生产模式

| 配置项 | 开发模式 | 生产模式 |
|--------|----------|----------|
| Callback URL | `http://localhost:8080/api/auth/callback` | `https://yourdomain.com/api/auth/callback` |
| Cookie Secure | `false` | `true` (需要 HTTPS) |
| JWT Secret | 简单密钥 | 强随机密钥（≥32字符） |
| CORS Origin | `*` (全部允许) | 特定域名白名单 |

---

## License

MIT License - 详见 LICENSE 文件
