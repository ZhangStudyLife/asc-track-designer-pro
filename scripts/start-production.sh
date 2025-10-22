#!/bin/bash

# ASC Track Designer - 生产环境启动脚本
# 使用环境变量配置速率限制和其他参数

# 服务器配置
export PORT=8080
export DATA_DIR=/var/lib/trackd/data

# GitHub OAuth（可选）
# export GITHUB_CLIENT_ID=your_github_client_id
# export GITHUB_CLIENT_SECRET=your_github_client_secret
# export GITHUB_CALLBACK_URL=https://yourdomain.com/api/auth/callback

# JWT 配置
export JWT_SECRET=$(openssl rand -base64 32)

# 上传限制
export MAX_UPLOAD_MB=5

# 启动服务
echo "🚀 Starting ASC Track Designer..."
echo "📡 Port: $PORT"
echo "📁 Data directory: $DATA_DIR"
echo ""
echo "🛡️  Rate Limiting Configuration:"
echo "   - Upload: 5 requests per 10 minutes (burst: 5)"
echo "   - Download: 20 requests per minute (burst: 20)"
echo "   - List: 30 requests per minute (burst: 30)"
echo "   - Auth: 10 requests per minute (burst: 10)"
echo ""

# 确保数据目录存在
mkdir -p "$DATA_DIR"

# 启动服务（前台运行，由 systemd 管理）
exec ./trackd \
    --port "$PORT" \
    --data "$DATA_DIR" \
    --max-upload "$MAX_UPLOAD_MB"
