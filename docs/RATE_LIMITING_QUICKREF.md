# 速率限制快速参考

## 快速开始

```go
import mw "github.com/asc-lab/track-designer/internal/middleware"

// 1. 创建速率限制器组
rateLimiters := mw.NewRateLimiterGroup()

// 2. 添加预设策略
rateLimiters.Add("upload", mw.UploadLimit)      // 5 req/10min
rateLimiters.Add("download", mw.DownloadLimit)  // 20 req/min
rateLimiters.Add("list", mw.ListLimit)          // 30 req/min
rateLimiters.Add("auth", mw.AuthLimit)          // 10 req/min

// 3. 确保优雅关闭
defer rateLimiters.StopAll()

// 4. 添加到中间件链
r.Use(rateLimiters.Middleware)
```

## 预设限流策略

| 名称 | 速率限制 | Burst | 用途 |
|-----|---------|-------|------|
| `UploadLimit` | 5 req/10min | 5 | 上传接口 |
| `DownloadLimit` | 20 req/min | 20 | 下载接口 |
| `ListLimit` | 30 req/min | 30 | 列表查询 |
| `AuthLimit` | 10 req/min | 10 | 认证接口 |

## 自定义策略

```go
customLimit := mw.RateLimitConfig{
    RequestsPerSecond: 100.0 / 60.0, // 100 requests per minute
    Burst:             100,           // Max burst size
    CleanupInterval:   5 * time.Minute,  // Cleanup frequency
    TTL:               30 * time.Minute, // Limiter expiry
}

rateLimiters.Add("custom", customLimit)
```

## 错误响应

**HTTP 429 Too Many Requests:**
```json
{
    "success": false,
    "error": "Rate limit exceeded. Please try again later."
}
```

**响应头:**
```
Retry-After: 60
Content-Type: application/json
```

## IP 提取优先级

1. `X-Forwarded-For` (最常见，取第一个 IP)
2. `X-Real-IP` (nginx 等代理)
3. `Forwarded` (RFC 7239 标准)
4. `RemoteAddr` (直连场景)

## Nginx 配置要点

```nginx
location /api/ {
    proxy_pass http://localhost:8080;

    # 重要！传递真实 IP
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Host $host;
}
```

## Caddy 配置要点

```caddy
reverse_proxy localhost:8080 {
    header_up X-Forwarded-For {remote_host}
    header_up X-Real-IP {remote_host}
}
```

## 监控日志

**触发限流时:**
```
WARN Rate limit exceeded ip=203.0.113.195 path=/api/tracks method=POST
```

**清理时:**
```
INFO Rate limiter cleanup removed=5
```

## 测试命令

```bash
# 单元测试
go test -v ./internal/middleware/

# 集成测试
go test -v ./internal/integration/ -run TestRateLimiting

# 基准测试
go test -bench=. ./internal/middleware/
```

## 性能指标

- **内存**: 每个唯一 IP 约 136 字节
- **并发**: 支持数万并发 IP
- **时间复杂度**: O(1) 每次请求

## 常见问题

### Q: 所有请求显示同一个 IP？
**A**: 检查反向代理是否设置了 `X-Forwarded-For` 头

### Q: 合法用户被限流？
**A**: 调整 Burst 值或 RequestsPerSecond

### Q: 内存持续增长？
**A**: 检查清理机制是否启动，确保调用了 `defer rateLimiters.StopAll()`

## 文件位置

- **核心代码**: `internal/middleware/ratelimit.go`
- **单元测试**: `internal/middleware/ratelimit_test.go`
- **集成测试**: `internal/integration/ratelimit_integration_test.go`
- **完整文档**: `docs/RATE_LIMITING.md`
- **Nginx 配置**: `scripts/nginx.conf`
- **Caddy 配置**: `scripts/Caddyfile`

## 相关链接

- [完整文档](./RATE_LIMITING.md)
- [实现总结](./RATE_LIMITING_IMPLEMENTATION_SUMMARY.md)
- [golang.org/x/time/rate 文档](https://pkg.go.dev/golang.org/x/time/rate)

---
**版本**: v1.0
**状态**: ✅ 生产就绪
