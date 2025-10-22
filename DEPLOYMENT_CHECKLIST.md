# 📋 生产环境部署检查清单

在将 ASC 赛道设计器部署到生产环境之前，请完成以下检查清单。

## ✅ 必须完成项

### 安全配置

- [ ] **修改 JWT_SECRET**
  - 生成随机密钥：`openssl rand -base64 32`
  - 更新 `.env` 文件
  - ⚠️ 不要使用默认值！

- [ ] **配置 HTTPS**
  - 安装 SSL 证书（Let's Encrypt 推荐）
  - 配置 Nginx/Caddy 反向代理
  - 强制 HTTPS 重定向

- [ ] **限制端口访问**
  - Docker 端口绑定到 `127.0.0.1:8080`
  - 仅通过 Nginx/Caddy 对外暴露 80/443

- [ ] **配置防火墙**
  ```bash
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw allow 22/tcp  # SSH
  sudo ufw enable
  ```

- [ ] **启用限流保护**
  ```env
  RATE_LIMIT_ENABLED=true
  RATE_LIMIT_REQUESTS=100
  RATE_LIMIT_WINDOW=60
  ```

### OAuth 配置（如需登录功能）

- [ ] **注册 GitHub OAuth 应用**
  - 访问：https://github.com/settings/developers
  - 填写回调 URL：`https://your-domain.com/api/auth/github/callback`
  - 获取 Client ID 和 Secret

- [ ] **更新环境变量**
  ```env
  GITHUB_CLIENT_ID=your_client_id
  GITHUB_CLIENT_SECRET=your_client_secret
  GITHUB_REDIRECT_URL=https://your-domain.com/api/auth/github/callback
  ```

- [ ] **验证 OAuth 流程**
  - 测试登录功能
  - 检查回调是否正常
  - 验证 token 刷新

### 数据备份

- [ ] **配置自动备份**
  ```bash
  # 创建备份脚本
  cat > /opt/trackd/backup.sh << 'EOF'
  #!/bin/bash
  BACKUP_DIR="/opt/trackd/backups"
  DATE=$(date +%Y%m%d_%H%M%S)
  mkdir -p $BACKUP_DIR
  tar -czf $BACKUP_DIR/data_$DATE.tar.gz /opt/trackd/data
  find $BACKUP_DIR -mtime +7 -delete
  EOF

  chmod +x /opt/trackd/backup.sh
  ```

- [ ] **设置 Cron 任务**
  ```bash
  # 每天凌晨 2 点备份
  echo "0 2 * * * /opt/trackd/backup.sh" | crontab -
  ```

- [ ] **测试恢复流程**
  - 执行备份
  - 删除数据
  - 从备份恢复
  - 验证数据完整性

### 监控和日志

- [ ] **配置日志轮转**
  ```bash
  # 创建 /etc/logrotate.d/trackd
  /var/log/trackd/*.log {
      daily
      rotate 7
      compress
      delaycompress
      missingok
      notifempty
  }
  ```

- [ ] **设置健康检查**
  - 验证 `/api/health` 端点
  - 配置监控告警（可选）

- [ ] **配置日志收集**
  ```bash
  # 查看 Docker 日志
  docker-compose logs -f --tail=100

  # 或使用 journalctl（systemd）
  sudo journalctl -u trackd -f
  ```

## 🔄 推荐完成项

### 性能优化

- [ ] **启用 Nginx 缓存**
  ```nginx
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
      expires 30d;
      add_header Cache-Control "public, immutable";
  }
  ```

- [ ] **配置 Gzip 压缩**
  ```nginx
  gzip on;
  gzip_types text/plain text/css application/json application/javascript;
  gzip_min_length 1000;
  ```

- [ ] **启用 HTTP/2**
  ```nginx
  listen 443 ssl http2;
  ```

### 可靠性

- [ ] **配置自动重启**
  ```yaml
  # docker-compose.yml
  services:
    trackd:
      restart: unless-stopped
  ```

- [ ] **设置资源限制**
  ```yaml
  services:
    trackd:
      deploy:
        resources:
          limits:
            cpus: '2'
            memory: 2G
  ```

### 监控（可选）

- [ ] **集成 Prometheus**
  - 添加 `/metrics` 端点
  - 配置 Prometheus 抓取

- [ ] **配置 Grafana 仪表板**
  - CPU/内存使用率
  - 请求速率
  - 错误率

### 文档

- [ ] **更新部署文档**
  - 记录实际配置
  - 更新域名和端口
  - 添加团队联系方式

- [ ] **编写运维手册**
  - 常见问题处理
  - 紧急联系流程
  - 备份恢复步骤

## 🧪 部署验证

完成部署后，执行以下测试：

### 基础功能测试

- [ ] **访问首页**
  ```bash
  curl -I https://your-domain.com
  # 预期：200 OK
  ```

- [ ] **健康检查**
  ```bash
  curl https://your-domain.com/api/health
  # 预期：{"status":"ok","version":"1.0"}
  ```

- [ ] **API 端点测试**
  ```bash
  # 获取赛道列表
  curl https://your-domain.com/api/tracks
  ```

### 安全性测试

- [ ] **HTTPS 强制**
  ```bash
  curl -I http://your-domain.com
  # 预期：301 重定向到 HTTPS
  ```

- [ ] **限流测试**
  ```bash
  # 快速发送多个请求
  for i in {1..110}; do curl https://your-domain.com/api/health; done
  # 预期：超过限制后返回 429 Too Many Requests
  ```

- [ ] **OAuth 登录流程**
  - 点击登录按钮
  - GitHub 授权
  - 成功回调
  - 用户信息显示

### 功能测试

- [ ] **赛道编辑**
  - 添加直道/弯道
  - 拖动移动
  - 旋转
  - 删除

- [ ] **数据持久化**
  - 刷新页面
  - 数据保留
  - LocalStorage 正常

- [ ] **导入导出**
  - 导出 JSON
  - 导入旧版 JSON
  - 数据完整性

- [ ] **社区功能**（如启用 OAuth）
  - 上传赛道
  - 浏览赛道库
  - 搜索和筛选
  - 下载他人赛道

### 性能测试

- [ ] **页面加载时间**
  ```bash
  curl -o /dev/null -s -w "Time: %{time_total}s\n" https://your-domain.com
  # 预期：< 2 秒
  ```

- [ ] **并发测试**（使用 Apache Bench）
  ```bash
  ab -n 1000 -c 10 https://your-domain.com/api/health
  # 查看响应时间和错误率
  ```

## 📝 部署记录

完成部署后，记录以下信息：

```
部署日期：____________________
服务器 IP：____________________
域名：____________________
Docker 版本：____________________
Go 版本：____________________
Node 版本：____________________
数据库路径：____________________
备份路径：____________________
负责人：____________________
联系方式：____________________
```

## 🆘 回滚计划

如果部署出现问题，执行以下步骤回滚：

1. **停止新版本**
   ```bash
   docker-compose down
   ```

2. **恢复数据备份**
   ```bash
   tar -xzf backups/data_YYYYMMDD_HHMMSS.tar.gz -C /
   ```

3. **切换到稳定版本**
   ```bash
   git checkout <stable-tag>
   docker-compose up -d
   ```

4. **验证功能**
   - 测试关键功能
   - 检查数据完整性

---

## ✅ 检查完成确认

- [ ] 所有必须完成项已完成
- [ ] 部署验证测试通过
- [ ] 回滚计划已准备
- [ ] 团队成员已知晓

**签名：________________**
**日期：________________**

---

**提示：** 将此清单打印或保存为 PDF，作为部署记录存档。
