# 🚀 快速部署指南

## 服务器 Docker 部署（推荐）

### 1️⃣ 准备工作

```bash
# 确保安装了 Docker 和 Docker Compose
docker --version
docker-compose --version

# 如果未安装，使用以下命令安装（Ubuntu/Debian）
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt install -y docker-compose
```

### 2️⃣ 克隆仓库

```bash
git clone https://github.com/yourusername/asc-track-designer.git
cd asc-track-designer
```

### 3️⃣ 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置（重要！）
nano .env
```

**必须修改的配置：**

```env
# JWT 密钥（务必修改为随机字符串）
JWT_SECRET=$(openssl rand -base64 32)

# GitHub OAuth（可选，如需登录功能）
GITHUB_CLIENT_ID=你的_GitHub_Client_ID
GITHUB_CLIENT_SECRET=你的_GitHub_Secret
GITHUB_REDIRECT_URL=https://your-domain.com/api/auth/github/callback
```

### 4️⃣ 启动服务

```bash
# 构建并启动（首次运行需要几分钟）
docker-compose up -d

# 查看日志
docker-compose logs -f

# 等待启动完成，看到 "Server started on :8080" 即可
```

### 5️⃣ 验证部署

```bash
# 测试健康检查
curl http://localhost:8080/api/health

# 预期响应：
# {"status":"ok","version":"1.0"}
```

### 6️⃣ 访问应用

- 本地访问：http://localhost:8080
- 服务器访问：http://your-server-ip:8080

---

## 🌐 使用 Nginx 反向代理（推荐生产环境）

### 1️⃣ 安装 Nginx

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2️⃣ 配置 Nginx

创建配置文件 `/etc/nginx/sites-available/trackd`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/trackd /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3️⃣ 配置 SSL 证书（推荐）

```bash
# 使用 Let's Encrypt 免费证书
sudo certbot --nginx -d your-domain.com

# 证书会自动续期，测试续期
sudo certbot renew --dry-run
```

---

## 🔒 安全配置（生产环境必须）

### 1. 配置防火墙

```bash
# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 如果使用 SSH，确保允许
sudo ufw allow 22/tcp

# 启用防火墙
sudo ufw enable
```

### 2. 限制 Docker 端口访问

修改 `docker-compose.yml`：

```yaml
services:
  trackd:
    ports:
      - "127.0.0.1:8080:8080"  # 只允许本地访问
```

### 3. 启用限流保护

在 `.env` 中：

```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100    # 每分钟 100 次请求
RATE_LIMIT_WINDOW=60       # 窗口 60 秒
```

---

## 📊 常用运维命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志（实时）
docker-compose logs -f trackd

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新应用
git pull
docker-compose build
docker-compose up -d

# 备份数据
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# 清理 Docker 缓存（空间不足时）
docker system prune -a
```

---

## 🐛 常见问题

### 问题 1：端口被占用

```bash
# 检查端口占用
sudo lsof -i :8080
sudo netstat -tulpn | grep 8080

# 修改端口（在 .env 中）
PORT=8090
```

### 问题 2：OAuth 登录失败

1. 检查 GitHub OAuth 应用配置
2. 确认回调 URL：`https://your-domain.com/api/auth/github/callback`
3. 验证 `.env` 中的 Client ID 和 Secret
4. 查看日志：`docker-compose logs -f`

### 问题 3：数据库错误

```bash
# 停止服务
docker-compose down

# 删除数据库（注意：会丢失数据）
sudo rm -rf data/*.db

# 重新启动
docker-compose up -d
```

### 问题 4：前端无法加载

```bash
# 重新构建
docker-compose build --no-cache
docker-compose up -d

# 检查构建日志
docker-compose logs --tail=100 trackd
```

---

## 📚 进阶配置

### 使用外部数据库（可选）

如需使用 PostgreSQL/MySQL，修改 `internal/config/config.go`。

### 配置 CDN（可选）

使用 Cloudflare、阿里云 CDN 加速静态资源。

### 监控告警（可选）

集成 Prometheus + Grafana 监控系统状态。

详见：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## 💡 快速测试（开发环境）

```bash
# 不使用 Docker，直接运行
cd web && npm install && npm run build && cd ..
go run cmd/trackd/main.go

# 访问 http://localhost:8080
```

---

## 📞 获取帮助

- 📖 完整文档：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- 🐛 报告问题：[GitHub Issues](https://github.com/yourusername/asc-track-designer/issues)
- 💬 讨论交流：[Discussions](https://github.com/yourusername/asc-track-designer/discussions)

---

**🎉 部署成功后，记得给项目点个 Star！**
