# 部署指南

本文档提供 ASC 赛道设计器的完整部署指南，包括 Docker、Linux 服务器和 Windows 服务器部署。

## 📋 部署前准备

### 系统要求

**最低配置：**
- CPU: 1 核
- 内存: 512MB
- 磁盘: 2GB
- 系统: Linux/Windows

**推荐配置：**
- CPU: 2 核
- 内存: 2GB
- 磁盘: 10GB
- 系统: Ubuntu 22.04 / Debian 12

### 必需软件

**Docker 部署：**
- Docker 20.10+
- Docker Compose 2.0+

**手动部署：**
- Go 1.22+（编译需要）
- 或直接使用预编译二进制

## 🐳 Docker 部署（推荐）

### 方法一：使用 Docker Compose

1. **克隆仓库**

```bash
git clone https://github.com/yourusername/asc-track-designer.git
cd asc-track-designer
```

2. **配置环境变量**

```bash
cp .env.example .env
nano .env  # 或使用 vim/vi
```

编辑以下关键配置：

```env
# 服务器配置
PORT=8080
HOST=0.0.0.0

# GitHub OAuth（可选）
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URL=https://your-domain.com/api/auth/github/callback

# JWT 密钥（必须修改）
JWT_SECRET=$(openssl rand -base64 32)

# 限流配置
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

3. **创建 Docker Compose 文件**

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  trackd:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: asc-track-designer
    ports:
      - "8080:8080"
    volumes:
      - ./data:/root/data
    env_file:
      - .env
    environment:
      - TZ=Asia/Shanghai
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

4. **启动服务**

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f trackd

# 停止服务
docker-compose down

# 重启服务
docker-compose restart
```

5. **验证部署**

```bash
# 检查容器状态
docker-compose ps

# 测试健康检查
curl http://localhost:8080/api/health

# 预期响应
{"status":"ok","version":"1.0"}
```

### 方法二：直接使用 Docker

```bash
# 构建镜像
docker build -t asc-track-designer .

# 运行容器
docker run -d \
  --name trackd \
  -p 8080:8080 \
  -v $(pwd)/data:/root/data \
  --env-file .env \
  --restart unless-stopped \
  asc-track-designer

# 查看日志
docker logs -f trackd
```

## 🖥️ Linux 服务器部署

### Ubuntu/Debian

1. **安装依赖**

```bash
sudo apt update
sudo apt install -y git wget
```

2. **下载二进制**

```bash
# 下载预编译版本
wget https://github.com/yourusername/asc-track-designer/releases/download/v1.0/trackd-linux-amd64
chmod +x trackd-linux-amd64
sudo mv trackd-linux-amd64 /usr/local/bin/trackd
```

3. **创建配置目录**

```bash
sudo mkdir -p /opt/trackd/data
sudo mkdir -p /etc/trackd
```

4. **配置环境变量**

创建 `/etc/trackd/config.env`：

```bash
PORT=8080
DATA_DIR=/opt/trackd/data
JWT_SECRET=your-random-secret
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

5. **创建 systemd 服务**

创建 `/etc/systemd/system/trackd.service`：

```ini
[Unit]
Description=ASC Track Designer Service
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/trackd
EnvironmentFile=/etc/trackd/config.env
ExecStart=/usr/local/bin/trackd
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=trackd

# 安全配置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/trackd/data

[Install]
WantedBy=multi-user.target
```

6. **启动服务**

```bash
# 重载 systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start trackd

# 开机自启
sudo systemctl enable trackd

# 查看状态
sudo systemctl status trackd

# 查看日志
sudo journalctl -u trackd -f
```

## 🌐 Nginx 反向代理

### 安装 Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 配置反向代理

创建 `/etc/nginx/sites-available/trackd`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书（使用 Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 日志
    access_log /var/log/nginx/trackd_access.log;
    error_log /var/log/nginx/trackd_error.log;

    # 上传限制
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持（未来可能需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        proxy_pass http://localhost:8080;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/trackd /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Let's Encrypt SSL 证书

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

## 🪟 Windows 服务器部署

### 方法一：使用批处理脚本

1. 将 `trackd.exe` 放到 `C:\trackd\` 目录
2. 创建 `启动赛道设计器.bat`：

```batch
@echo off
chcp 65001 >nul 2>&1
cd /d C:\trackd
start "ASC Track Designer" trackd.exe --port 8080 --data .\data
timeout /t 2 /nobreak >nul
start "" http://localhost:8080
```

### 方法二：注册为 Windows 服务

使用 [NSSM](https://nssm.cc/) 工具：

```batch
# 下载 NSSM
# https://nssm.cc/download

# 安装服务
nssm install TrackDesigner "C:\trackd\trackd.exe"
nssm set TrackDesigner AppDirectory "C:\trackd"
nssm set TrackDesigner AppParameters "--port 8080 --data C:\trackd\data"

# 启动服务
nssm start TrackDesigner

# 设置开机自启
sc config TrackDesigner start= auto
```

## 🔐 安全加固

### 防火墙配置

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 限流保护

在 `.env` 中启用限流：

```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

详见 [RATE_LIMITING.md](RATE_LIMITING.md)

### 数据备份

```bash
# 创建备份脚本
cat > /opt/trackd/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/trackd/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/data_$DATE.tar.gz /opt/trackd/data
find $BACKUP_DIR -mtime +7 -delete  # 保留7天
EOF

chmod +x /opt/trackd/backup.sh

# 添加到 cron（每天凌晨2点）
echo "0 2 * * * /opt/trackd/backup.sh" | crontab -
```

## 📊 监控和日志

### 日志查看

**Docker：**
```bash
docker-compose logs -f --tail=100 trackd
```

**systemd：**
```bash
sudo journalctl -u trackd -f -n 100
```

### 健康检查

```bash
# 使用 curl
curl http://localhost:8080/api/health

# 使用 systemd 监控（已在 service 文件中配置）
sudo systemctl status trackd
```

### Prometheus 监控（可选）

添加 `/metrics` 端点（需要后端支持）：

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'trackd'
    static_configs:
      - targets: ['localhost:8080']
```

## 🐛 故障排查

### 服务无法启动

```bash
# 检查端口占用
sudo lsof -i :8080
sudo netstat -tulpn | grep 8080

# 检查日志
sudo journalctl -u trackd -n 50

# 检查配置文件
cat /etc/trackd/config.env
```

### 数据库问题

```bash
# 检查数据目录权限
ls -la /opt/trackd/data

# 重建数据库（谨慎！）
sudo systemctl stop trackd
sudo rm /opt/trackd/data/tracks.db
sudo systemctl start trackd
```

### OAuth 登录失败

1. 检查 GitHub OAuth 配置
2. 验证回调 URL 是否正确
3. 查看 JWT_SECRET 是否设置
4. 检查网络连接

详见 [OAUTH_GUIDE.md](OAUTH_GUIDE.md)

## 🔄 更新和升级

### Docker 更新

```bash
# 拉取最新代码
git pull origin main

# 重新构建
docker-compose build

# 重启服务
docker-compose up -d
```

### 手动更新

```bash
# 停止服务
sudo systemctl stop trackd

# 下载新版本
wget https://github.com/yourusername/asc-track-designer/releases/download/v1.1/trackd-linux-amd64
chmod +x trackd-linux-amd64
sudo mv trackd-linux-amd64 /usr/local/bin/trackd

# 备份数据
sudo cp -r /opt/trackd/data /opt/trackd/data.backup

# 启动服务
sudo systemctl start trackd
```

## 📚 相关文档

- [OAuth 配置指南](OAUTH_GUIDE.md)
- [限流配置](RATE_LIMITING.md)
- [API 文档](API.md)

## 💬 技术支持

- GitHub Issues: https://github.com/yourusername/asc-track-designer/issues
- 邮件: support@example.com

---

**部署成功后，记得在 GitHub OAuth 应用中更新回调 URL！**
