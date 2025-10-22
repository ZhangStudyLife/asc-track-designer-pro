# 🆓 免费部署方案对比

本文档对比各个免费部署平台，帮助你选择最适合的方案。

---

## 📊 平台对比总览

| 平台 | 适用场景 | 免费配额 | 数据持久化 | 休眠问题 | 推荐指数 |
|------|----------|----------|------------|----------|----------|
| **Render.com** | 演示/小项目 | 512MB RAM | ❌ | ✅ 会休眠 | ⭐⭐⭐⭐ |
| **Railway.app** | 轻量生产 | $5/月额度 | ✅ | ❌ | ⭐⭐⭐⭐⭐ |
| **Fly.io** | 全球部署 | 3 个应用 | ✅ | ❌ | ⭐⭐⭐⭐ |
| **Vercel** | 纯前端 | 无限 | N/A | ❌ | ⭐⭐ (不适合) |
| **Netlify** | 纯前端 | 无限 | N/A | ❌ | ⭐⭐ (不适合) |
| **GitHub Codespaces** | 开发/演示 | 60 小时/月 | ❌ | N/A | ⭐⭐⭐ |

---

## 🥇 推荐方案一：Railway.app（最佳）

### 为什么推荐？
- ✅ **数据持久化**：SQLite 文件不会丢失
- ✅ **不休眠**：应用持续运行
- ✅ **$5 免费额度**：足够小项目使用
- ✅ **自动部署**：GitHub 集成
- ✅ **免费 HTTPS**：自动证书

### 免费额度说明
- 每月 $5 免费额度（约 500 小时运行）
- 超出后按使用量计费（约 $0.000231/GB-hour）
- 小项目每月费用：**$0-5**

### 部署步骤

#### 1. 创建账号
访问 https://railway.app 并使用 GitHub 登录。

#### 2. 创建新项目
```bash
# 方法 A：通过 CLI（推荐）
npm install -g @railway/cli
railway login
railway init
railway up
```

```bash
# 方法 B：通过 Web UI
# 1. Dashboard -> New Project
# 2. Deploy from GitHub repo
# 3. 选择你的仓库
```

#### 3. 配置环境变量

在 Railway Dashboard 中添加：

```env
PORT=8080
DATA_DIR=/app/data
JWT_SECRET=your-random-secret-key

# GitHub OAuth
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GITHUB_REDIRECT_URL=https://your-app.up.railway.app/api/auth/github/callback

# 限流
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

#### 4. 配置构建

Railway 会自动检测 Go 项目，但你可以自定义：

创建 `railway.json`：

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd web && npm install && npm run build && cd .. && go build -o trackd cmd/trackd/main.go"
  },
  "deploy": {
    "startCommand": "./trackd",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### 5. 挂载持久化卷（重要！）

为了保存 SQLite 数据库：

1. Railway Dashboard -> 你的服务 -> Settings
2. 找到 "Volumes" 部分
3. 添加卷：
   - Mount Path: `/app/data`
   - Size: 1GB (免费)

#### 6. 部署

推送到 GitHub 即可自动部署：

```bash
git push origin main
```

#### 7. 获取域名

Railway 会自动分配域名：
```
https://asc-track-designer-production.up.railway.app
```

你也可以绑定自定义域名（免费）。

### 费用估算

假设你的应用使用：
- 512MB RAM
- 0.5 vCPU
- 24/7 运行

**每月费用：** 约 $3-5（在免费额度内）

---

## 🥈 推荐方案二：Fly.io

### 为什么推荐？
- ✅ **全球 CDN**：自动边缘部署
- ✅ **数据持久化**：支持卷
- ✅ **3 个免费应用**
- ✅ **性能优秀**：接近裸机性能

### 免费额度
- 3 个共享 CPU 应用（1GB RAM）
- 160GB 出站流量/月
- 3GB 持久化存储

### 部署步骤

#### 1. 安装 Fly CLI

```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

#### 2. 登录

```bash
fly auth login
```

#### 3. 初始化项目

```bash
cd asc-track-designer
fly launch
```

按提示操作：
```
? Choose an app name: asc-track-designer
? Choose a region: Hong Kong (hkg)
? Would you like to set up a PostgreSQL database? No
? Would you like to set up a Redis database? No
```

#### 4. 配置 Dockerfile

Fly 会使用你的 Dockerfile，确保它正确。

#### 5. 创建持久化卷

```bash
fly volumes create data --size 1 --region hkg
```

#### 6. 配置 fly.toml

编辑生成的 `fly.toml`：

```toml
app = "asc-track-designer"
primary_region = "hkg"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"
  DATA_DIR = "/data"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[mounts]
  source = "data"
  destination = "/data"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

#### 7. 部署

```bash
fly deploy
```

#### 8. 设置密钥

```bash
fly secrets set JWT_SECRET=$(openssl rand -base64 32)
fly secrets set GITHUB_CLIENT_ID=xxx
fly secrets set GITHUB_CLIENT_SECRET=xxx
```

#### 9. 访问应用

```bash
fly open
# 或访问：https://asc-track-designer.fly.dev
```

### 优点
- ✅ 全球 CDN，访问速度快
- ✅ 数据持久化可靠
- ✅ 免费额度慷慨

### 缺点
- ⚠️ 配置相对复杂
- ⚠️ 需要信用卡验证（不扣费）

---

## 🥉 推荐方案三：Render.com

详见 [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)

**优点：** 最简单，无需配置
**缺点：** 会休眠，数据不持久

---

## ❌ 不推荐的方案

### Vercel / Netlify
**原因：** 只支持 Serverless Functions，不支持长时间运行的 Go 服务器。

**替代方案：** 可以部署前端到 Vercel，后端部署到 Railway。

### Heroku
**原因：** 已取消免费版（2022 年 11 月）。

---

## 🎯 如何选择？

### 场景 1：功能演示、临时测试
**推荐：** Render.com（最简单）
- 无需信用卡
- 5 分钟完成部署
- 可以休眠（演示时手动唤醒）

### 场景 2：个人项目、小团队
**推荐：** Railway.app（最佳平衡）
- 数据不丢失
- 不休眠
- $5 免费额度足够用
- 超出后费用合理

### 场景 3：全球用户访问
**推荐：** Fly.io（性能最优）
- 全球 CDN
- 边缘部署
- 访问速度快

### 场景 4：生产环境、高可用
**推荐：** 自己的 VPS（最可控）
- DigitalOcean ($6/月)
- Vultr ($5/月)
- AWS Lightsail ($3.5/月)

---

## 📊 成本对比（每月）

| 方案 | 免费额度 | 小流量 | 中流量 | 大流量 |
|------|----------|--------|--------|--------|
| **Render** | 512MB (休眠) | $7 | $25 | $85 |
| **Railway** | $5 额度 | $5 | $15 | $50 |
| **Fly.io** | 3 个应用 | $0 | $10 | $40 |
| **VPS** | - | $5 | $10 | $20 |

---

## 🚀 我的推荐

### 阶段 1：开发/演示
使用 **Render 免费版**（5 分钟部署）

### 阶段 2：测试/小流量
升级到 **Railway**（数据持久化）

### 阶段 3：生产环境
- 流量小：继续 Railway
- 流量大：使用 VPS + Docker

---

## 📚 相关文档

- [Render 部署指南](RENDER_DEPLOYMENT.md)
- [完整部署文档](DEPLOYMENT.md)
- [Docker 部署](../QUICKSTART.md)

---

## 💡 省钱技巧

1. **使用学生优惠**
   - GitHub Student Pack：免费 $200 DigitalOcean 额度
   - Azure for Students：$100 免费额度

2. **组合使用免费服务**
   - 前端：Vercel（免费）
   - 后端：Railway（$5 额度）
   - 数据库：Supabase（免费 500MB）

3. **按需使用**
   - 开发环境关闭自动部署
   - 使用 Render 休眠功能
   - 定期清理不用的应用

---

**最终建议：** 对于你的项目，我推荐从 **Railway.app** 开始！
