#!/bin/bash
# Render.com 构建脚本

echo "🔨 开始构建 ASC Track Designer..."

# 1. 构建前端
echo "📦 构建前端..."
cd web
npm install
npm run build
cd ..

# 2. 构建 Go 后端
echo "🔧 构建后端..."
go build -o trackd cmd/trackd/main.go

echo "✅ 构建完成！"
