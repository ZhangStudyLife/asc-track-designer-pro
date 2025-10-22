# ==========================================
# ASC Track Designer - Multi-stage Dockerfile
# ==========================================

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder
LABEL stage=builder

WORKDIR /app/web

# 优化缓存：先复制依赖文件
COPY web/package*.json ./
RUN npm ci --only=production --ignore-scripts

# 复制源代码并构建
COPY web/ ./
RUN npm run build

# 清理不必要的文件
RUN rm -rf node_modules

# Stage 2: Build backend
FROM golang:1.22-alpine AS backend-builder
LABEL stage=builder

# 安装构建依赖
RUN apk add --no-cache git

WORKDIR /app

# 优化缓存：先下载依赖
COPY go.mod go.sum ./
RUN go mod download

# 复制源代码
COPY . .

# 复制前端构建产物
COPY --from=frontend-builder /app/web/dist ./cmd/trackd/dist

# 构建 Go 二进制（优化编译参数）
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -X main.Version=1.0 -X main.BuildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -a -installsuffix cgo \
    -o trackd \
    cmd/trackd/main.go

# 验证二进制
RUN chmod +x trackd

# Stage 3: Runtime (最小化镜像)
FROM alpine:latest
LABEL maintainer="ASC Track Designer Team"
LABEL description="ASC Track Designer - Professional track design tool"

# 安装运行时依赖
RUN apk --no-cache add \
    ca-certificates \
    tzdata \
    wget \
    && rm -rf /var/cache/apk/*

# 设置时区
ENV TZ=Asia/Shanghai

# 创建非 root 用户（安全最佳实践）
RUN addgroup -g 1000 trackd && \
    adduser -D -u 1000 -G trackd trackd

WORKDIR /app

# 从构建阶段复制二进制
COPY --from=backend-builder /app/trackd .

# 创建数据目录并设置权限
RUN mkdir -p data/tracks data/exports && \
    chown -R trackd:trackd /app && \
    chmod +x trackd

# 切换到非 root 用户
USER trackd

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/api/health || exit 1

# 暴露端口
EXPOSE 8080

# 环境变量
ENV PORT=8080 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/data \
    GIN_MODE=release

# 启动服务
CMD ["./trackd"]
