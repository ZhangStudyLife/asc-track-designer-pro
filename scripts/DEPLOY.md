# ASC Track Designer Deployment Guide

## Linux 部署 (Ubuntu/Debian)

### 1. 安装依赖

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js (如需本地构建)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 Go (如需本地构建)
wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin
```

### 2. 构建程序

```bash
# 克隆或上传代码
cd /opt
git clone <repository-url> trackd
cd trackd

# 构建
chmod +x scripts/build.sh
./scripts/build.sh
```

### 3. 配置 systemd 服务

```bash
# 复制 systemd 配置
sudo cp scripts/trackd.service /etc/systemd/system/

# 重载配置
sudo systemctl daemon-reload

# 启用并启动服务
sudo systemctl enable trackd
sudo systemctl start trackd

# 查看状态
sudo systemctl status trackd
```

### 4. 配置 Nginx 反向代理 (可选)

```bash
# 安装 Nginx
sudo apt install -y nginx

# 创建配置文件
sudo nano /etc/nginx/sites-available/trackd
```

配置内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
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
sudo systemctl restart nginx
```

### 5. 配置 HTTPS (使用 Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Docker 部署

### 1. 创建 Dockerfile

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN cd web && npm install && npm run build
RUN go build -ldflags="-s -w" -o trackd cmd/trackd/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/trackd .
COPY --from=builder /app/data ./data
EXPOSE 8080
CMD ["./trackd", "--port", "8080"]
```

### 2. 构建和运行

```bash
# 构建镜像
docker build -t asc-track-designer .

# 运行容器
docker run -d \
  -p 8080:8080 \
  -v $(pwd)/data:/root/data \
  --name trackd \
  --restart unless-stopped \
  asc-track-designer
```

### 3. 使用 Docker Compose

创建 `docker-compose.yml`：

```yaml
version: '3'
services:
  trackd:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./data:/root/data
    restart: unless-stopped
```

运行：

```bash
docker-compose up -d
```

## Windows 部署

### 方式一：直接运行

1. 双击 `scripts\启动赛道设计器.bat`
2. 或运行 `trackd.exe --port 8080`

### 方式二：作为 Windows 服务

使用 NSSM (Non-Sucking Service Manager)：

```cmd
# 下载 NSSM: https://nssm.cc/download

# 安装服务
nssm install TrackDesigner "C:\path\to\trackd.exe" "--port 8080"
nssm start TrackDesigner
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | HTTP 端口 | 8080 |
| DATA_DIR | 数据目录 | ./data |

## 防火墙配置

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 8080/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 故障排查

```bash
# 查看日志
sudo journalctl -u trackd -f

# 查看端口占用
sudo netstat -tlnp | grep 8080

# 重启服务
sudo systemctl restart trackd
```
