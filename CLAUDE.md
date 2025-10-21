# ASC 赛道绘图器（新版本）架构文档

文档版本：v1.0（已实现版本）

本文件记录新一代 ASC 赛道绘图器的实际实现架构、技术选型、数据与 API 设计、部署与打包方案，以及对旧版 JSON 的兼容策略。目标已实现：新手可"无脑双击运行服务"，也能方便在 Ubuntu/Debian 服务器上部署并对公网开放；已实现分享库（上传/浏览/下载赛道）、改进绘图手感、修复长度计算与提供多边形边界的自定义能力。

---

## 1. 核心目标与原则

- 新手友好：
  - Windows 一键双击运行（单文件 EXE，自带前端，打开浏览器即可使用）。
  - 服务器部署简单（Linux 单文件 + systemd 或 Docker，支持公网访问）。
- 兼容可持续：
  - 兼容旧版多种 JSON 导出格式；新数据模型向前/向后可演进。
- 体验优先：
  - 更直觉的绘图交互（指针对齐、稳定拖拽、明确吸附反馈、减少“快捷键门槛”）。
- 云端分享：
  - 上传/浏览/下载“赛道分享库”，无强制账号（先匿名/昵称，后续可扩展登录）。
- 工程可扩展：
  - 清晰分层：UI（前端）/ API（后端）/ 存储（SQLite/FS）。
  - 统一类型与校验（前端 Zod + 后端 JSON Schema/Zod-like 校验）。

---

## 2. 技术选型（已实现）

### 2.1 后端：Go 1.22+
- ✅ 单文件二进制（Windows/Linux/Mac 交叉编译）
- ✅ 直接嵌入前端静态资源（go:embed），真正做到"一个文件跑前后端"
- ✅ 依赖：
  - HTTP 路由：`github.com/go-chi/chi/v5`
  - SQLite 驱动：`modernc.org/sqlite`（纯 Go，无系统依赖）
  - 结构化日志：内置 `log/slog`
  
### 2.2 前端：React 18 + Vite + TypeScript
- ✅ 绘图：**原生 SVG**（精确渲染白色赛道皮，支持Y轴翻转的数学坐标系）
- ✅ 状态：Zustand（轻量）+ localStorage 持久化
- ✅ 数据校验：TypeScript 类型系统
- ✅ 交互优化：
  - Ctrl+滚轮缩放（0.1x~5x，以鼠标位置为中心）
  - 鼠标中键拖动平移视图
  - 智能吸附（起点和终点都可吸附）
  - 拖拽排序（边界点）
  - 多选与批量操作

### 2.3 打包与部署
- ✅ Windows：单 EXE（内嵌前端），双击 `trackd.exe` 即可
- ✅ Linux：单二进制 + `systemd` 示例
- ✅ Docker：提供 Dockerfile
- ✅ 反向代理：Nginx/Caddy 配置示例

---

## 3. 总体架构

```
┌───────────────────────────────────────────┐
│            单文件服务（Go）               │
│  - / (静态)  → 嵌入的前端 SPA             │
│  - /api/...  → JSON REST API              │
│  - /static/* → 赛道文件/缩略图/导出        │
│  - SQLite    → 元数据（分享库/索引等）      │
│  - FS        → 赛道 JSON 原文件存储        │
└───────────────────────────────────────────┘
                 ↑  HTTP
                 │
         浏览器（PC/移动端）
```

- 前端：SPA（React+Konva）负责绘制、交互、导入导出、调用 API。
- 后端：提供上传/浏览/下载/导出、BOM 统计、长度校验等接口，并持久化。
- 存储：SQLite 保存赛道元信息与索引；赛道 JSON 原文件与导出图像存本地 `data/` 目录。

---

## 4. 目录结构（建议）

```
asc-track-nextgen/
├─ cmd/trackd/               # Go 主程序入口
│  └─ main.go
├─ internal/
│  ├─ api/                   # HTTP 处理器（REST）
│  ├─ core/                  # 领域模型、算法（长度计算/BOM/导入兼容）
│  ├─ store/                 # SQLite 与文件存储
│  ├─ embed/                 # go:embed 静态资源绑定
│  └─ util/                  # 公共工具：日志/配置/限流
├─ web/                      # 前端（Vite）源码
│  ├─ src/
│  │  ├─ app/                # 路由/页面：编辑器、分享库、导入、设置
│  │  ├─ components/         # UI 组件（Canvas、工具条、面板、缩略图）
│  │  ├─ state/              # Zustand/Query
│  │  ├─ lib/                # 几何/坐标/吸附/映射
│  │  ├─ types/              # Zod Schema 与 TS 类型
│  │  └─ styles/
│  └─ index.html
├─ data/                     # 运行时数据（db.sqlite、uploads/、exports/）
├─ scripts/                  # 启动/部署脚本（Windows/Linux）
├─ docs/
│  ├─ CLAUDE.md              # 本文件
│  └─ README.md              # 使用说明
└─ Makefile / Taskfile.yml   # 开发与构建任务（可选）
```

---

## 5. ASC 智能车赛道真实规格（已实现）

### 5.1 物理规格

**标准赛道元件规格：**

全国大学生智能汽车竞赛(ASC)使用的赛道具有严格的物理规格：

1. **赛道宽度**：固定45cm（所有赛道元件统一宽度）
2. **赛道颜色**：纯白色（#FFFFFF）✅ 已实现
3. **场地背景**：蓝色布料（#1E3A8A 海军蓝）✅ 已实现
4. **标注颜色**：橙黄色文字（#FFB732）✅ 已实现

**直道元件（Straight Track）：**
- 命名规则：`L{长度}` (如 L25、L50、L100)
- 长度：指赛道皮的长度（单位：cm）
- 宽度：固定45cm
- 常见尺寸：L25、L37.5、L50、L75、L100、L150、L200
- ✅ 支持小数长度输入（如 L67.5）

**弯道元件（Curve Track）：**
- 命名规则：`R{半径}-{角度}` (如 R50-90、R100-180)
- 半径：从赛道**中心线**到圆心的距离（单位：cm）
- 角度：扇环对应的圆心角（单位：度）
- 接壤宽度：与其他赛道连接处宽度固定45cm
- 常见尺寸：
  - R50-30、R50-45、R50-60、R50-90
  - R100-30、R100-45、R100-90、R100-180
- ✅ 支持小数半径和角度输入

### 5.2 几何计算与坐标系统（已实现）

**坐标系统（第一象限数学坐标系）：**
- ✅ 原点：左下角（0, 0），有黄色圆圈标记
- ✅ X轴：红色箭头，向右为正
- ✅ Y轴：绿色箭头，向上为正
- ✅ 设计区域：1170cm × 827cm（2340px × 1654px）
- ✅ 像素转换比例：1cm = 2px
- ✅ 初始视图：可见原点和坐标轴，缩放范围 0.1x~5x

**连接点（吸附点）系统：**

每个赛道元件有两个连接点，用于吸附拼接：
- **绿色点**：起始连接点
- **红色点**：终止连接点
- ✅ 吸附距离：30px（可调整）
- ✅ 智能吸附：起点和终点都可以吸附到其他赛道的任意连接点
- ✅ 吸附反馈：绿色圆圈 + 十字准星动画

直道连接点：
```
起点: (piece.x, piece.y)
终点: (piece.x + length*2*cos(rotation°), piece.y + length*2*sin(rotation°))
```

弯道连接点（圆心在原点，rotation为旋转角度）：
```
起点: (piece.x + radius*2*cos(rotation°), piece.y + radius*2*sin(rotation°))
终点: (piece.x + radius*2*cos(rotation° + angle°), piece.y + radius*2*sin(rotation° + angle°))
```

### 5.3 渲染规范（已实现）

**SVG渲染架构：**
- ✅ Y轴翻转：使用 `<g transform="scale(1, -1)">` 实现数学坐标系
- ✅ 背景：超大蓝色矩形覆盖所有缩放级别
- ✅ 文字正向：所有文字标注使用 `transform="scale(1, -1)"` 反转回正

**赛道元件渲染：**

1. **直道（Straight）：**
   - ✅ 纯白色填充（#FFFFFF）
   - ✅ 橙黄色标注（#FFB732）
   - ✅ 黄色选中高亮（侧边框，不遮盖白色）
   - ✅ 长度标注居中显示

2. **弯道（Curve）：**
   - ✅ 纯白色扇环填充（#FFFFFF）
   - ✅ 精确弧线计算（SVG path）
   - ✅ 橙黄色标注在弧线中点
   - ✅ 黄色选中高亮（外圈描边）

3. **背景：**
   - ✅ 场地背景：海军蓝（#1E3A8A）
   - ✅ 坐标轴指示：X轴红色，Y轴绿色
   - ✅ 原点标记：黄色圆圈 + (0,0) 标注

---

## 6. 数据模型

### 6.1 赛道项目（统一模型）

```ts
// 前端/后端对齐的抽象（Zod + Go struct）
TrackProject {
  id: string               // 服务端生成（uuid）
  name: string
  version: string          // 模型版本（与旧导出兼容用）
  createdAt: string
  updatedAt: string

  // 新模型：多边形边界（支持自动画图与自定义尺寸）
  boundary?: {
    // 点序：0 为原点、1..n 为顶点（二维坐标，单位 cm 或 px，统一规范）
    unit: 'cm' | 'px'
    points: Array<{ idx: number; x: number; y: number }>
    closed: boolean        // 多边形闭合
  }

  // 赛道皮肤/涂层（宽度、纹理等，可选，便于后续渲染与导出）
  skin?: {
    trackWidthCm: number   // 固定45cm（ASC标准）
    trackColor: string     // 纯白色 #FFFFFF
    labelColor: string     // 橙黄色 #FFB732
  }

  // 旧模型兼容：离散“元件”（直道/弯道）集合
  pieces?: Array<
    | { type: 'straight'; id: number|string; params: { length: number /*cm*/ }; x: number; y: number; rotation: number }
    | { type: 'curve';    id: number|string; params: { radius: number /*cm*/, angle: number /*deg*/ }; x: number; y: number; rotation: number }
  >
}
```

约束与说明：
- 新模型以 `boundary` 为主，`pieces` 为兼容层。
- 前端优先用 `boundary` + 自动生成“可编辑的导轨/控制点”交互；
  需要时可“投影”为旧式 `pieces`（直道/弯道）用于导出兼容。
- 单位统一：推荐以 `cm` 为主，前端渲染时按比例换算为像素（1cm=2px 可配置）。

### 6.2 BOM 与长度计算（精确公式）

```ts
BOMSummary {
  totalPieces: number
  totalLengthM: string   // 两位小数，字符串存储避免二进制浮点误差
  bom: Record<string, number> // 例如 { "L50": 5, "R100-90": 2 }
  details: Array<{
    type: string        // "L50", "R100-90"
    count: number       // 数量
    lengthCm: number    // 单件长度(cm)
  }>
}
```

**长度计算公式（重要）：**

1. **直道长度**：
   ```
   length_cm = piece.params.length  // 直接使用参数中的长度(cm)
   ```

2. **弯道弧长**：
   ```
   // 注意：radius 是到赛道中心线的距离
   arc_len_cm = radius_cm × (angle_deg × π / 180)

   // 示例：R50-90 = 50 × (90 × π / 180) = 50 × π/2 ≈ 78.54cm
   ```

3. **总长度**：
   ```
   total_length_m = (所有元件长度之和_cm) / 100
   保留两位小数: toFixed(2)
   ```

**BOM命名规则：**
- 直道：`L{长度}` - 如 "L50"、"L100"、"L37.5"
- 弯道：`R{半径}-{角度}` - 如 "R50-90"、"R100-180"

---

## 7. 旧 JSON 导入兼容策略

兼容文档中列出的四类格式（含 `totalPieces/details`、标准 `pieces`、`details`、数组直接体）

流程：
1. 解析 JSON → 判定类型 → 映射到内部 `TrackProject`：
   - 保留原样 `pieces`；
   - 若存在 `bounds`，映射为渲染边界或 `boundary` 草图；
   - `totalPieces/bom/totalLength` 作为计算参考，最终以后端算法重算为准。
2. 规范化：
   - 角度范围统一（0..360），坐标单位统一（以 cm 为主）。
   - 修复异常数据（如负角度/非法长度），记录校正日志。
3. 校验：Zod/Schema 严格校验；错误提供可读提示。

导入映射将以“Adapter”模式实现（`core/importer`），为后续支持第三方格式留下扩展点。

---

## 8. API 设计（v1）

基础：所有响应为 JSON；上传使用 `multipart/form-data` 或 `application/json`。

- 健康检查
  - `GET /api/health` → `{ ok: true, version }`

- 分享库
  - `POST /api/tracks`（上传）
    - body：`file`（JSON）或 `TrackProject` JSON 体
    - 返回：`{ id, name, createdAt }`
  - `GET /api/tracks`（分页列表）
    - query：`q`（搜索名/标签）、`page`、`size`
    - 返回：`{ items: [...], total, page, size }`
  - `GET /api/tracks/{id}`（详情）
    - 返回：`TrackProject` + 派生统计（BOM/长度）
  - `GET /api/tracks/{id}/download`（下载原始JSON）
  - `DELETE /api/tracks/{id}`（可选；MVP 可不开放）

- 边界分享（可选独立资源，便于单独共享多边形边界）
  - `POST /api/boundaries`
  - `GET /api/boundaries`

- 导出
  - `POST /api/export/png`（前端提交快照或由后端重绘，返回 PNG 下载地址）

- 统计/校验
  - `POST /api/validate` → 返回校验结果与修复建议（可合并入上传流程）。

安全与限制：
- CORS 白名单（结合部署域名）。
- 上传大小限制（默认 5MB，可配置）。
- 基础速率限制（IP 级、可配置）。

---

## 9. 前端交互与手感（已实现）

### 9.1 坐标系统
- ✅ **第一象限数学坐标系**：原点在左下角，X向右，Y向上
- ✅ 以 cm 为主，渲染时映射到像素（1cm = 2px）
- ✅ 坐标轴可视化：红色X轴，绿色Y轴，黄色原点标记

### 9.2 视图控制
- ✅ **Ctrl + 滚轮**：缩放视图（0.1x~5x，以鼠标位置为中心）
- ✅ **鼠标中键拖动**：平移视图（不改变缩放级别）
- ✅ **屏蔽浏览器快捷键**：防止 Ctrl+滚轮触发浏览器缩放
- ✅ **初始视角**：可见原点和坐标轴

### 9.3 选择与拖动
- ✅ **Ctrl + 左键点击**：多选/取消选中（不触发拖动）
- ✅ **普通左键点击**：单选（清空其他选中）
- ✅ **长按拖动**：移动距离 >5px 才触发拖动
- ✅ **多选拖动**：所有选中的赛道一起移动
- ✅ **拖动极性修正**：Y轴翻转后的坐标转换正确

### 9.4 旋转与对齐
- ✅ **Tab 键**：选中元素旋转 15°
- ✅ **智能吸附**：起点和终点都可吸附，30px距离
- ✅ **吸附反馈**：绿色圆圈 + 十字准星动画

### 9.5 快捷键
- ✅ **Delete**：删除选中元素
- ✅ **Ctrl+Z / Ctrl+Y**：撤销/重做
- ✅ **Ctrl+C / Ctrl+V**：复制/粘贴
- ✅ **Escape**：取消选中

### 9.6 快捷输入
- ✅ **L{长度}**：快速添加直道（支持小数，如 L67.5）
- ✅ **R{半径}-{角度}**：快速添加弯道（如 R50-90）

### 9.7 BOM表与边界
- ✅ **BOM弹窗**：显示物料清单和总长度
- ✅ **边界编辑器**：
  - 点坐标输入（X,Y 格式）
  - ⋮⋮ 拖拽手柄排序
  - 拖拽排序视觉反馈
  - 上下移动按钮（已替换为拖拽）

### 9.8 数据持久化
- ✅ **localStorage 自动保存**：每次修改自动保存
- ✅ **导入/导出**：兼容旧版 JSON 格式

---

## 10. 长度计算与 BOM（修正与验证）

- 统一在后端 `core/geom` 实现：
  - 直道/弯道长度；
  - 多边形折线长度；
  - 单位统一与浮点误差控制（小数两位输出，内部使用 decimal 或整型 cm 计算）。
- 提供用例测试：
  - 直线 50cm → 0.50m；
  - 弧半径 100cm、角度 90° → 1.57m；
  - 混合拼接样例（对照旧版结果）。
- BOM 统一格式：
  - key 命名：`L{cm}`、`R{radius}-{angle}`；
  - 前端/后端一致化计算，前端仅做展示，后端为权威。

---

## 11. 本地与云端持久化

- 本地：
  - LocalStorage：当前编辑项目快照、用户偏好（单位、吸附开关）。
  - Cookie：匿名用户标识（用于云端“最近上传”归类）。
- 云端：
  - SQLite：赛道元数据（id、name、tags、uploaderId、createdAt、stats）。
  - 文件系统：原始 JSON；可选生成缩略图 PNG（后端绘制或前端上传快照）。
  - 清理策略：LRU + 最大占用配额；支持导出/备份。

---

## 12. 部署与打包

### 11.1 Windows（新手双击）
- 交付物：`trackd.exe`（内嵌前端） + `启动赛道绘图器.bat`
- 双击 `.bat`：启动服务 → 自动打开浏览器 `http://localhost:8080`
- 可选 `config.yaml`：端口、数据目录、上传限额

示例（文档演示，实际脚本随仓库提供）：
```bat
@echo off
chcp 65001 >nul 2>&1
start "ASC 赛道绘图器" trackd.exe --port 8080 --data .\data
start "" http://localhost:8080
```

### 11.2 Ubuntu/Debian（systemd）
- 上传二进制与 `config.yaml` 到 `/opt/trackd/`
- 创建 `trackd.service`：
```ini
[Unit]
Description=ASC Track Designer Service
After=network.target

[Service]
ExecStart=/opt/trackd/trackd --port 8080 --data /opt/trackd/data
WorkingDirectory=/opt/trackd
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```
- 启用：`systemctl enable --now trackd`
- 反代（Nginx/Caddy）转发 80/443 到 8080（附自动证书）

### 11.3 Docker（可选）
- 多阶段构建 → 极小镜像；
- 运行：映射卷 `-v ./data:/data`，映射端口 `-p 8080:8080`。

---

## 13. 性能、安全与可运维性

- 性能：
  - 前端虚拟化列表（分享库）；Konva 层级拆分；
  - 后端分页/索引；静态资源缓存头。
- 安全：
  - CORS 域名白名单；上传大小与类型限制；
  - 基础速率限制与失败日志；
  - XSS/CSRF：前端转义、后端同源策略（分享库初期无鉴权）。
- 监控：
  - `/api/health`；结构化日志；按需 Prometheus 指标（后续）。

---

## 14. 实现状态总结

### ✅ 已完成功能（Milestone 1-2）

#### 核心编辑功能
- ✅ SVG 精确渲染（白色赛道 + 蓝色场地）
- ✅ 数学坐标系（第一象限，Y轴向上）
- ✅ 直道/弯道添加（标准库 + 快捷输入）
- ✅ 智能吸附（起点/终点双向吸附）
- ✅ 多选与批量操作
- ✅ 拖拽排序（边界点）
- ✅ 旋转/复制/粘贴/删除
- ✅ 撤销/重做

#### 视图控制
- ✅ Ctrl+滚轮缩放（0.1x~5x）
- ✅ 鼠标中键平移
- ✅ 屏蔽浏览器快捷键冲突
- ✅ 坐标轴可视化

#### 数据管理
- ✅ localStorage 自动保存
- ✅ 导入旧版 JSON（兼容多种格式）
- ✅ 导出 JSON
- ✅ BOM 物料清单
- ✅ 长度精确计算

#### 部署
- ✅ Go 单文件服务器（内嵌前端）
- ✅ Windows 双击运行
- ✅ Linux systemd 配置
- ✅ Docker 支持

### 🚧 待实现功能（Milestone 3）

#### 云端分享
- ⏳ 上传赛道到服务器
- ⏳ 浏览/搜索赛道库
- ⏳ 下载他人赛道
- ⏳ 标签/分类系统

#### 导出增强
- ⏳ 高分辨率 PNG 导出
- ⏳ 缩略图自动生成
- ⏳ PDF 导出

#### 运维增强
- ⏳ 管理面板
- ⏳ 存储清理策略
- ⏳ CDN 支持

---

## 17. 已知问题与改进方向

### 已修复问题
- ✅ Y轴拖动极性错误（坐标系翻转导致）
- ✅ 多选拖动只移动一个（状态更新竞态）
- ✅ 选中高亮不可见（渲染层级问题）
- ✅ 直道高亮覆盖白色（改为侧边框）
- ✅ 弯道高亮不一致（统一为黄色描边）
- ✅ 缩放时背景露白（超大背景矩形）
- ✅ Ctrl+滚轮触发浏览器缩放（事件拦截）
- ✅ 边界点排序困难（拖拽排序替代按钮）

### 未来改进方向
- 🔄 网格对齐辅助线
- 🔄 角度步进吸附（45°、90°）
- 🔄 测量工具（距离/角度显示）
- 🔄 图层管理
- 🔄 赛道模板库
- 🔄 自动填充直道功能
- 🔄 导出 CAD 格式

---

## 18. 使用指南

### 18.1 快速开始

**Windows：**
```bash
# 双击运行
trackd.exe

# 或命令行启动
trackd.exe --port 8080 --data ./data
```

**Linux：**
```bash
# 直接运行
./trackd --port 8080 --data ./data

# 使用 systemd（见 scripts/trackd.service）
sudo systemctl enable --now trackd
```

**Docker：**
```bash
docker build -t asc-track-designer .
docker run -d -p 8080:8080 -v ./data:/data asc-track-designer
```

### 18.2 交互说明

**添加赛道：**
1. 点击左侧工具栏的直道/弯道按钮
2. 或使用快捷输入：输入 `L50` 或 `R50-90` 后按回车

**选择与编辑：**
- 单击：选中单个赛道
- Ctrl+点击：多选/取消选中
- 拖动：移动赛道（多选时一起移动）
- Tab：旋转 15°
- Delete：删除

**视图控制：**
- Ctrl+滚轮：缩放（以鼠标位置为中心）
- 鼠标中键拖动：平移视图
- 初始视角：左下角可见原点(0,0)和坐标轴

**边界编辑：**
1. 点击"边界"按钮打开编辑器
2. 输入坐标点（格式：`100,200`）
3. 使用 ⋮⋮ 拖拽手柄调整顺序
4. 保存后可在画布上看到边界多边形

**数据管理：**
- 自动保存：每次修改自动保存到 localStorage
- 导出：点击"导出 JSON"下载文件
- 导入：点击"导入"上传旧版 JSON

### 18.3 快捷键列表

| 快捷键 | 功能 |
|--------|------|
| Ctrl+点击 | 多选/取消选中 |
| Tab | 旋转 15° |
| Delete | 删除选中 |
| Ctrl+Z | 撤销 |
| Ctrl+Y / Ctrl+Shift+Z | 重做 |
| Ctrl+C | 复制 |
| Ctrl+V | 粘贴 |
| Escape | 取消选中 |
| Ctrl+滚轮 | 缩放视图 |
| 中键拖动 | 平移视图 |

---

## 19. 开发指南

### 19.1 项目结构
```
asc-track-designer-new/
├─ cmd/trackd/           # Go 主程序
├─ internal/             # Go 后端代码
│  ├─ api/              # HTTP 处理器
│  ├─ storage/          # SQLite 存储
│  ├─ geometry/         # 几何计算
│  └─ importer/         # JSON 导入适配器
├─ web/                 # React 前端
│  ├─ src/
│  │  ├─ components/   # UI 组件
│  │  ├─ store.ts      # Zustand 状态
│  │  ├─ types.ts      # TypeScript 类型
│  │  └─ trackPieces.ts # 赛道定义
└─ data/                # 运行时数据
```

### 19.2 构建命令

**前端：**
```bash
cd web
npm install
npm run dev      # 开发模式
npm run build    # 生产构建
```

**后端：**
```bash
go build -o trackd.exe ./cmd/trackd     # Windows
go build -o trackd ./cmd/trackd         # Linux
```

**交叉编译：**
```bash
# Linux → Windows
GOOS=windows GOARCH=amd64 go build -o trackd.exe ./cmd/trackd

# Windows → Linux
$env:GOOS="linux"; $env:GOARCH="amd64"; go build -o trackd ./cmd/trackd
```

### 19.3 开发注意事项

1. **坐标系统**：
   - 所有几何计算使用第一象限数学坐标系
   - SVG 使用 `scale(1, -1)` 翻转 Y 轴
   - 鼠标坐标转换时注意 Y 轴取反

2. **状态管理**：
   - 使用 Zustand 单一状态树
   - 批量更新使用 `updatePieces(Map)` 而不是多次 `updatePiece()`
   - 每次修改自动调用 `saveToLocalStorage()`

3. **渲染性能**：
   - 文字使用 `transform="scale(1, -1)"` 反转
   - 背景使用超大矩形避免露白
   - 选中高亮放在最上层（渲染顺序）

4. **交互设计**：
   - 拖动阈值 5px 区分点击和拖动
   - 吸附距离 30px
   - 缩放范围 0.1x~5x

---

## 20. 贡献指南

欢迎贡献代码！请遵循以下规范：

1. **代码风格**：
   - Go：使用 `gofmt` 格式化
   - TypeScript：使用 ESLint + Prettier

2. **提交规范**：
   - feat: 新功能
   - fix: 修复 bug
   - docs: 文档更新
   - style: 代码格式
   - refactor: 重构
   - test: 测试
   - chore: 构建/工具

3. **测试**：
   - 新功能需添加测试用例
   - 确保现有测试通过

4. **文档**：
   - 更新 CLAUDE.md 和 README.md
   - 添加代码注释

---

## 附录：标准赛道库

### 直道元件
- L25, L37.5, L50, L75, L100, L150, L200

### 弯道元件
- R50-30, R50-45, R50-60, R50-90
- R100-30, R100-45, R100-90, R100-180
- R150-30, R150-45, R150-60, R150-90

### 自定义尺寸
- 支持任意小数长度/半径
- 支持任意角度（0-360°）

---

**文档更新日期**：2025年10月22日  
**当前版本**：v1.0 (Milestone 1-2 已完成)
