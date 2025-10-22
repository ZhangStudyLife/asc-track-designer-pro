# ASC 赛道设计器

> 全国大学生智能汽车竞赛（ASC）赛道设计与分享平台

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Go Version](https://img.shields.io/badge/go-1.22%2B-blue.svg)](https://go.dev/)
[![Node Version](https://img.shields.io/badge/node-18%2B-green.svg)](https://nodejs.org/)

## ✨ 功能特性

### 核心功能
- 🎨 **可视化编辑器**：基于 SVG 的精确赛道绘制
- 📐 **标准元件库**：直道（L系列）、弯道（R系列）标准库
- 🔗 **智能吸附**：起点/终点双向吸附，快速拼接
- 📊 **BOM 统计**：自动生成物料清单和总长度计算
- 💾 **数据持久化**：本地自动保存 + 云端分享

### 交互体验
- 🖱️ **Ctrl+滚轮**：缩放视图（0.1x~5x）
- 🖱️ **中键拖动**：平移画布
- ⌨️ **快捷输入**：`L50`、`R100-90` 快速添加
- 🎯 **多选操作**：Ctrl+点击多选，批量编辑
- ↩️ **撤销重做**：Ctrl+Z / Ctrl+Y

### 云端分享
- ☁️ **赛道上传**：分享你的设计
- 🔍 **在线浏览**：搜索和下载他人赛道
- 🏷️ **标签分类**：按赛项/难度筛选
- 🔐 **GitHub 登录**：OAuth 授权，保护隐私

## 🚀 快速开始

### 🆓 免费在线部署（推荐新手）

无需服务器，一键部署到云端：

| 平台 | 特点 | 部署难度 | 文档 |
|------|------|----------|------|
| **Railway** ⭐ | 数据持久化、不休眠、$5 免费额度 | ⭐⭐ | [部署指南](docs/FREE_DEPLOYMENT_COMPARISON.md#推荐方案一railwayapp最佳) |
| **Render** | 最简单、会休眠、数据不持久 | ⭐ | [部署指南](docs/RENDER_DEPLOYMENT.md) |
| **Fly.io** | 全球 CDN、性能优秀 | ⭐⭐⭐ | [部署指南](docs/FREE_DEPLOYMENT_COMPARISON.md#推荐方案二flyio) |

**完整对比**：[免费部署方案对比](docs/FREE_DEPLOYMENT_COMPARISON.md)

### Docker 部署（推荐生产环境）

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/asc-track-designer.git
cd asc-track-designer

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写必要配置

# 3. 启动服务
docker-compose up -d

# 4. 访问应用
# http://localhost:8080
```

### 本地开发

**前置要求：**
- Go 1.22+
- Node.js 18+
- npm 或 pnpm

```bash
# 1. 安装依赖
cd web && npm install && cd ..
go mod download

# 2. 构建前端
cd web && npm run build && cd ..

# 3. 启动后端
go run cmd/trackd/main.go

# 或使用开发模式（前端热重载）
cd web && npm run dev  # 终端1
go run cmd/trackd/main.go  # 终端2
```

### Windows 一键启动

```bash
# 双击启动
启动赛道设计器.bat
```

## 📖 使用指南

### 基本操作

**添加赛道：**
1. 点击工具栏的直道/弯道按钮
2. 或快捷输入：`L50` ↵ 或 `R50-90` ↵

**选择与编辑：**
- 单击：选中单个赛道
- `Ctrl+点击`：多选/取消选中
- 拖动：移动赛道
- `Tab`：旋转 15°
- `Delete`：删除

**视图控制：**
- `Ctrl+滚轮`：缩放（以鼠标位置为中心）
- 中键拖动：平移视图

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+点击` | 多选/取消选中 |
| `Tab` | 旋转 15° |
| `Delete` | 删除选中 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Y` | 重做 |
| `Ctrl+C` / `Ctrl+V` | 复制/粘贴 |
| `Escape` | 取消选中 |

### 标准赛道规格

**直道元件：**
- 格式：`L{长度}`（单位：cm）
- 示例：L25、L50、L100、L67.5

**弯道元件：**
- 格式：`R{半径}-{角度}`
- 示例：R50-90、R100-180
- 半径：赛道中心线到圆心距离（cm）
- 角度：扇环圆心角（度）

## 🏗️ 技术架构

### 后端
- **语言**：Go 1.22+
- **框架**：chi/v5（HTTP 路由）
- **数据库**：SQLite（纯 Go 驱动）
- **特性**：单文件部署、嵌入式前端

### 前端
- **框架**：React 18 + TypeScript
- **构建**：Vite
- **渲染**：原生 SVG（精确坐标系）
- **状态**：Zustand + localStorage

### 部署
- **Docker**：多阶段构建
- **反向代理**：Nginx/Caddy
- **系统服务**：systemd

## 📁 项目结构

```
asc-track-designer/
├─ cmd/trackd/              # Go 主程序
│  └─ main.go
├─ internal/                # 后端代码
│  ├─ api/                 # HTTP 处理器
│  ├─ auth/                # OAuth 认证
│  ├─ core/                # 领域模型
│  ├─ store/               # 数据存储
│  └─ middleware/          # 中间件
├─ web/                     # React 前端
│  ├─ src/
│  │  ├─ components/       # UI 组件
│  │  ├─ contexts/         # Context
│  │  ├─ store.ts          # Zustand 状态
│  │  └─ types.ts          # TypeScript 类型
│  └─ package.json
├─ docs/                    # 文档
│  ├─ DEPLOYMENT.md        # 部署指南
│  ├─ OAUTH_GUIDE.md       # OAuth 配置
│  └─ RATE_LIMITING.md     # 限流配置
├─ scripts/                 # 部署脚本
│  ├─ docker-compose.yml   # Docker Compose
│  └─ nginx.conf           # Nginx 配置
├─ Dockerfile              # Docker 构建
├─ .env.example            # 环境变量示例
└─ README.md               # 本文件
```

## 🔧 配置说明

### 环境变量

```bash
# 服务器配置
PORT=8080
HOST=0.0.0.0

# 数据目录
DATA_DIR=./data

# GitHub OAuth（可选）
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URL=http://localhost:8080/api/auth/github/callback

# JWT 密钥
JWT_SECRET=your-random-secret-key

# 限流配置
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

### GitHub OAuth 配置

1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. 创建新的 OAuth App
3. 填写回调 URL：`http://your-domain.com/api/auth/github/callback`
4. 复制 Client ID 和 Secret 到 `.env`

详细配置见 [docs/OAUTH_GUIDE.md](docs/OAUTH_GUIDE.md)

## 🚢 生产部署

### Docker Compose（推荐）

```yaml
version: '3.8'

services:
  trackd:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./data:/root/data
    env_file:
      - .env
    restart: unless-stopped
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

详细部署指南见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## 🤝 贡献指南

欢迎贡献代码！请遵循以下规范：

1. **Fork 仓库** 并创建新分支
2. **编写代码** 并添加测试
3. **提交 PR** 并描述变更
4. **代码审查** 通过后合并

### 提交规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

## 📝 开发路线图

### v1.0 ✅
- [x] 可视化编辑器
- [x] 标准元件库
- [x] BOM 统计
- [x] 本地持久化

### v1.1 ✅
- [x] 云端分享
- [x] GitHub OAuth
- [x] 限流保护
- [x] Docker 部署

### v2.0 🚧
- [ ] 多人协作
- [ ] 赛道模板
- [ ] CAD 导出
- [ ] 移动端适配

## 📄 许可证

[MIT License](LICENSE)

## 🙏 致谢

- 全国大学生智能汽车竞赛组委会
- 所有贡献者

## 📮 联系方式

- **问题反馈**：[GitHub Issues](https://github.com/yourusername/asc-track-designer/issues)
- **功能建议**：[Discussions](https://github.com/yourusername/asc-track-designer/discussions)

---

**Made with ❤️ for ASC Community**
