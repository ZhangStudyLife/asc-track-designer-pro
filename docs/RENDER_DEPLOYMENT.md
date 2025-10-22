# Render.com 部署指南

## 🚀 使用 Render.com 免费部署

Render.com 提供免费的 Web Service，非常适合本项目！

### 特性
- ✅ 完全免费（有使用限制）
- ✅ 自动从 GitHub 部署
- ✅ 提供免费 HTTPS 域名
- ✅ 自动重启和健康检查
- ✅ 支持环境变量配置

### 限制
- ⚠️ 免费版会休眠（15 分钟无活动后）
- ⚠️ 512MB RAM 限制
- ⚠️ 磁盘数据会定期清空（需外部存储）

---

## 📋 部署步骤

### 1. 准备工作

确保你的代码已推送到 GitHub：

```bash
git push origin main
```

### 2. 创建 Render 账号

访问 https://render.com 并使用 GitHub 账号登录。

### 3. 创建新 Web Service

1. 点击 **"New +"** -> **"Web Service"**
2. 连接你的 GitHub 仓库：`asc-track-designer`
3. 配置如下：

**基本设置：**
```
Name: asc-track-designer
Region: Singapore (或选择最近的)
Branch: main
Runtime: Go
```

**构建设置：**
```
Build Command: bash render-build.sh
Start Command: ./trackd
```

**实例类型：**
```
Instance Type: Free
```

### 4. 配置环境变量

在 Render Dashboard 中添加环境变量：

```env
PORT=10000
HOST=0.0.0.0
DATA_DIR=/opt/render/project/data
JWT_SECRET=your-random-secret-key-here

# GitHub OAuth (可选)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URL=https://your-app.onrender.com/api/auth/github/callback

# 限流配置
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=50
RATE_LIMIT_WINDOW=60
```

**重要：** Render 默认使用端口 10000，必须设置 `PORT=10000`。

### 5. 部署

点击 **"Create Web Service"**，Render 会自动：
1. 克隆你的 GitHub 仓库
2. 运行构建脚本
3. 启动应用
4. 提供 HTTPS 域名

部署通常需要 **3-5 分钟**。

### 6. 获取访问地址

部署完成后，Render 会提供一个免费域名：
```
https://asc-track-designer.onrender.com
```

---

## 🔧 配置 GitHub OAuth

如果需要登录功能，更新 GitHub OAuth 应用：

1. 访问 https://github.com/settings/developers
2. 编辑你的 OAuth App
3. 更新 **Authorization callback URL**：
   ```
   https://your-app.onrender.com/api/auth/github/callback
   ```

---

## ⚠️ 重要注意事项

### 1. 数据持久化问题

**问题：** Render 免费版会定期清空磁盘数据（每次休眠后重启）。

**解决方案 A（推荐）：** 使用外部数据库

不使用本地 SQLite，改用 Render 提供的免费 PostgreSQL：

1. 创建 PostgreSQL 数据库（Render 免费提供）
2. 修改代码使用 PostgreSQL 而不是 SQLite
3. 数据会永久保存

**解决方案 B（临时）：** 仅用于演示

接受数据会丢失的事实，只用于功能演示。

### 2. 休眠问题

免费版应用会在 **15 分钟无活动后休眠**，下次访问需要等待 **30-60 秒**唤醒。

**解决方案：**
- 升级到付费版（$7/月）
- 或使用 Cron Job 定期访问保持唤醒

---

## 📊 性能建议

由于免费版只有 512MB RAM，建议：

1. **减少前端资源**
   ```bash
   # 在 web/package.json 中添加
   "build": "vite build --minify"
   ```

2. **启用 Gzip 压缩**（Go 代码中）

3. **限制并发请求**
   ```env
   RATE_LIMIT_REQUESTS=30  # 降低限制
   ```

---

## 🔄 自动部署

配置完成后，每次推送到 GitHub 都会**自动重新部署**：

```bash
git add .
git commit -m "feat: some changes"
git push origin main
# Render 会自动检测并部署
```

---

## 📈 监控和日志

### 查看日志

在 Render Dashboard 中点击你的服务 -> **"Logs"** 查看实时日志。

### 健康检查

Render 会自动监控 `/api/health` 端点（如果配置了）。

---

## 💰 费用对比

| 服务 | 免费配额 | 付费价格 |
|------|----------|----------|
| Render Free | 512MB RAM, 会休眠 | $7/月（永不休眠） |
| Render PostgreSQL | 1GB 存储 | $7/月（10GB） |
| Railway | $5 免费额度/月 | 按使用量付费 |
| Fly.io | 3 个应用免费 | 按使用量付费 |

---

## 🆚 其他免费部署方案对比

| 平台 | 优点 | 缺点 |
|------|------|------|
| **Render** ✅ | 简单、稳定、免费 HTTPS | 会休眠，数据不持久 |
| **Railway** | $5 免费额度，数据持久 | 额度用完需付费 |
| **Fly.io** | 数据持久，全球 CDN | 配置复杂 |
| **Heroku** | 曾经最好的 | 已取消免费版 |
| **Vercel** | 适合前端 | 不支持后端长时间运行 |

---

## 🎯 推荐方案

### 演示/测试环境
使用 **Render 免费版**（接受休眠和数据丢失）

### 正式生产环境
1. **Render 付费版**（$7/月）
2. 或自己的 **VPS 服务器**（更灵活）
3. 或使用 **Railway**（按使用量付费）

---

## 📚 相关链接

- Render 文档: https://render.com/docs
- Go 部署指南: https://render.com/docs/deploy-go
- PostgreSQL 设置: https://render.com/docs/databases

---

## 🆘 常见问题

### Q: 为什么应用启动很慢？
A: 免费版从休眠唤醒需要 30-60 秒，这是正常的。

### Q: 如何保持应用不休眠？
A: 升级到付费版，或使用外部服务定期访问（如 UptimeRobot）。

### Q: 数据库文件去哪了？
A: 免费版磁盘不持久化，建议使用 Render PostgreSQL。

### Q: 如何查看错误日志？
A: Dashboard -> 你的服务 -> Logs 标签页。

---

**提示：** 如果项目用于生产环境，强烈建议使用付费版或自己的 VPS！
