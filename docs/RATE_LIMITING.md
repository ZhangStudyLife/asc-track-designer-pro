# 速率限制（Rate Limiting）文档

## 概述

ASC Track Designer 实现了生产级的速率限制系统，使用令牌桶算法保护 API 免受滥用和 DDoS 攻击。速率限制基于客户端 IP 地址，支持反向代理场景。

## 技术实现

### 核心技术

- **算法**：令牌桶（Token Bucket）算法
- **库**：`golang.org/x/time/rate`
- **存储**：`sync.Map`（线程安全的内存存储）
- **清理机制**：定期自动清理过期的限流器，防止内存泄漏

### 架构特点

1. **线程安全**：使用 `sync.Map` 和 `sync.Mutex` 确保并发安全
2. **IP 识别**：智能提取真实客户端 IP（支持 `X-Forwarded-For`、`X-Real-IP`、`Forwarded`）
3. **自动清理**：定期清理长时间未使用的限流器
4. **灵活配置**：不同接口可配置不同的速率限制策略

## 限流策略

### 当前配置

| 接口类型 | 速率限制 | Burst | 说明 |
|---------|---------|-------|------|
| 上传 (`POST /api/tracks`) | 5 次/10 分钟 | 5 | 防止大量上传 |
| 下载 (`GET /api/tracks/{id}/download`) | 20 次/分钟 | 20 | 保护带宽 |
| 列表查询 (`GET /api/tracks`) | 30 次/分钟 | 30 | 防止爬虫 |
| 认证 (`POST /api/auth/*`) | 10 次/分钟 | 10 | 防止暴力破解 |

### 参数说明

- **速率限制**：每秒允许的平均请求数（可以是小数）
- **Burst**：允许的最大突发请求数（令牌桶容量）
- **清理间隔**：多久执行一次过期限流器清理
- **TTL**：限流器多久未使用后被清理

## 代码示例

### 1. 基本使用

```go
import (
    mw "github.com/asc-lab/track-designer/internal/middleware"
)

// 创建速率限制器组
rateLimiters := mw.NewRateLimiterGroup()

// 添加不同的限流策略
rateLimiters.Add("upload", mw.UploadLimit)
rateLimiters.Add("download", mw.DownloadLimit)
rateLimiters.Add("list", mw.ListLimit)
rateLimiters.Add("auth", mw.AuthLimit)

// 确保程序退出时清理资源
defer rateLimiters.StopAll()

// 将中间件添加到路由器
r.Use(rateLimiters.Middleware)
```

### 2. 自定义限流策略

```go
// 创建自定义限流配置
customLimit := mw.RateLimitConfig{
    RequestsPerSecond: 100.0 / 60.0, // 100 requests per minute
    Burst:             100,
    CleanupInterval:   5 * time.Minute,
    TTL:               30 * time.Minute,
}

// 添加到限流器组
rateLimiters.Add("custom", customLimit)
```

### 3. 单独使用速率限制器

```go
// 创建单个速率限制器
rl := mw.NewRateLimiter(mw.UploadLimit)
defer rl.Stop()

// 作为中间件使用
handler := rl.Middleware(yourHandler)
```

## IP 提取逻辑

速率限制器使用以下优先级提取真实客户端 IP：

1. **X-Forwarded-For**：最常见的反向代理头，取第一个 IP
2. **X-Real-IP**：nginx 等代理使用
3. **Forwarded**：RFC 7239 标准头
4. **RemoteAddr**：直连场景

### 反向代理配置示例

**Nginx：**
```nginx
location /api/ {
    proxy_pass http://localhost:8080;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
}
```

**Caddy：**
```caddy
reverse_proxy localhost:8080 {
    header_up X-Forwarded-For {remote_host}
    header_up X-Real-IP {remote_host}
}
```

## 错误响应

当请求超过速率限制时，服务器返回：

**HTTP 状态码**：`429 Too Many Requests`

**响应体**：
```json
{
    "success": false,
    "error": "Rate limit exceeded. Please try again later."
}
```

**响应头**：
```
Retry-After: 60
Content-Type: application/json
```

## 监控与日志

### 日志示例

触发速率限制时，服务器会记录警告日志：

```
WARN Rate limit exceeded ip=203.0.113.195 path=/api/tracks method=POST
```

正常清理时，记录信息日志：

```
INFO Rate limiter cleanup removed=5
```

### 监控建议

1. **监控 429 响应数量**：异常增加可能表示攻击或配置过严
2. **监控不同 IP 的请求分布**：识别潜在的滥用行为
3. **监控内存使用**：确保清理机制正常工作

## 测试

### 运行测试

```bash
cd internal/middleware
go test -v
```

### 测试覆盖

- ✅ 基本速率限制功能
- ✅ 不同 IP 隔离
- ✅ IP 提取逻辑（X-Forwarded-For、X-Real-IP、RemoteAddr）
- ✅ 限流器组功能
- ✅ 自动清理机制

## 性能考虑

### 内存使用

- 每个唯一 IP 创建一个 `rate.Limiter`（约 128 字节）
- 每个 `limiterEntry` 额外存储 `lastAccess` 时间戳（8 字节）
- 清理机制确保长期未使用的限流器被释放

### 并发性能

- `sync.Map` 针对读多写少场景优化
- 令牌桶算法时间复杂度 O(1)
- 无全局锁，每个 IP 独立限流

### 扩展性

**单机场景**：
- 当前实现完美适用
- 支持数万并发 IP

**分布式场景**：
- 需要替换为 Redis 等集中式存储
- 可使用 Redis 的 `INCR` + `EXPIRE` 实现

## 生产环境最佳实践

### 1. 根据业务调整限制

```go
// 示例：宽松的开发环境配置
DevUploadLimit := mw.RateLimitConfig{
    RequestsPerSecond: 10.0 / 60.0, // 10 req/min instead of 5/10min
    Burst:             10,
    CleanupInterval:   5 * time.Minute,
    TTL:               30 * time.Minute,
}
```

### 2. 监控与告警

- 设置 429 响应的告警阈值
- 记录被限流的 IP 和路径
- 定期审查日志以优化策略

### 3. 用户体验优化

- 在前端显示剩余配额
- 提供清晰的错误消息
- 考虑添加 `X-RateLimit-*` 响应头

```go
// 未来增强：添加速率限制信息头
w.Header().Set("X-RateLimit-Limit", "5")
w.Header().Set("X-RateLimit-Remaining", "3")
w.Header().Set("X-RateLimit-Reset", "1698765432")
```

### 4. 白名单机制

```go
// 未来增强：添加白名单支持
trustedIPs := []string{"192.168.1.100", "10.0.0.0/8"}

func isWhitelisted(ip string) bool {
    // 检查 IP 是否在白名单中
    // ...
}
```

## 故障排除

### 问题：合法用户被限流

**原因**：
- 限制配置过严
- 用户行为异常（如自动化脚本）

**解决方案**：
- 查看日志确认请求模式
- 调整 Burst 值允许正常突发
- 考虑为特定用户添加白名单

### 问题：反向代理后所有请求显示相同 IP

**原因**：
- 反向代理未设置 `X-Forwarded-For` 头
- 安全组或防火墙剥离了头部

**解决方案**：
- 检查反向代理配置
- 验证 `extractIP()` 函数是否正确提取 IP

### 问题：内存泄漏

**原因**：
- 清理机制未启动
- TTL 设置过长

**解决方案**：
- 确保调用 `defer rateLimiters.StopAll()`
- 减少 TTL 时间
- 监控内存使用趋势

## 未来增强

### 计划功能

- [ ] Redis 后端支持（分布式场景）
- [ ] 响应头显示剩余配额
- [ ] IP 白名单/黑名单
- [ ] 基于用户账号的速率限制
- [ ] 动态调整限流策略
- [ ] Prometheus 指标导出

### 扩展示例

**基于用户的速率限制：**
```go
type UserRateLimiter struct {
    *RateLimiter
}

func (url *UserRateLimiter) Middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        userID := extractUserID(r) // 从 JWT 或 session 提取
        if userID != "" {
            // 使用用户 ID 而非 IP
            limiter := url.getLimiter(userID)
            if !limiter.Allow() {
                // 返回 429
                return
            }
        }
        next.ServeHTTP(w, r)
    })
}
```

## 参考资源

- [golang.org/x/time/rate 文档](https://pkg.go.dev/golang.org/x/time/rate)
- [RFC 7239: Forwarded HTTP Extension](https://datatracker.ietf.org/doc/html/rfc7239)
- [OWASP Rate Limiting Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)

---

**文档版本**：v1.0
**最后更新**：2025年10月22日
