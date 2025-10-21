#!/bin/bash

# ASC 赛道设计器 - Linux 部署脚本
# 用于 Ubuntu/Debian 系统

set -e

echo "=========================================="
echo "  ASC 赛道设计器 - Linux 部署脚本"
echo "=========================================="
echo ""

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
  echo "❌ 请使用 root 权限运行此脚本"
  echo "   使用命令: sudo bash install-linux.sh"
  exit 1
fi

# 安装目录
INSTALL_DIR="/opt/asc-track-designer"
SERVICE_FILE="/etc/systemd/system/asc-track-designer.service"

echo "📁 创建安装目录: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/data"

echo "📦 复制文件..."
cp trackd "$INSTALL_DIR/"
cp scripts/asc-track-designer.service "$SERVICE_FILE"
chmod +x "$INSTALL_DIR/trackd"

echo "👤 设置文件权限..."
chown -R www-data:www-data "$INSTALL_DIR"

echo "🔧 安装 systemd 服务..."
systemctl daemon-reload
systemctl enable asc-track-designer.service

echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 常用命令:"
echo "   启动服务:   sudo systemctl start asc-track-designer"
echo "   停止服务:   sudo systemctl stop asc-track-designer"
echo "   重启服务:   sudo systemctl restart asc-track-designer"
echo "   查看状态:   sudo systemctl status asc-track-designer"
echo "   查看日志:   sudo journalctl -u asc-track-designer -f"
echo ""
echo "🌐 服务将运行在 http://localhost:8080"
echo "   如需对外开放，请配置 Nginx/Caddy 反向代理"
echo ""
echo "🚀 现在可以启动服务了:"
echo "   sudo systemctl start asc-track-designer"
echo ""
