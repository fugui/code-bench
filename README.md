# CodeBench 开发者综合工作台 (Portal) 🖥️

> **当前版本**：`v0.5.0`

CodeBench 是面向研发效能与安全管理的一站式综合工作台主应用容器（Host）。项目采用**微前端（Micro-frontends）模块联邦**架构进行设计，聚合了包括代码质量管理（Code Shield）、流水线与检查（Code Pipeline）、接口文稿（Code Proto）以及产品数据管理（Code PDM）等子系统模块。

后端使用 Go 语言搭建，提供轻量的高并发微前端集成环境、统一认证中心（SSO / JWT）、全平台主数据管理及透明反向代理网关（Gateway）。

---

## 🧩 系统架构与微前端集成

CodeBench 采用**微前端宿主（Host）模式**，将多个异构子应用动态拼装为一个统一的高质感控制台：

*   **宿主主应用 (Host)**：`code-bench` 负责整体布局、全局路由导航、暗黑/明亮主题切换、系统账户、团队组织架构及代码仓全生命周期管理。
*   **子应用 (Remote)**：利用 **Vite Module Federation (模块联邦)** 在浏览器运行时动态拉取子应用组件（如 `shield/App`、`pipeline/App`、`proto/App`、`pdm/App`），并根据 `ModuleMenuConfig` 规范动态解析和渲染子系统的侧边栏二级菜单与 SVG 图标。
*   **统一网关 (Gateway)**：后端内置高性能反向代理机制，将前端发往主应用的子系统 API 请求（如 `/api/shield/*`、`/api/pipeline/*`、`/api/proto/*`、`/api/pdm/*`）透明分流转发给后台对应的独立微服务，并对客户端主动断开连接进行静默容错。

---

## 🔐 统一认证与 SSO 机制

主应用接管了全站的身份认证工作，保证了用户只需一次登录，即可无缝穿梭于所有子系统：

*   **OAuth2 / OIDC 单点登录**：支持企业级单点登录系统。授权通过后，自动获取用户信息及所属部门。
*   **统一数据模型与公共库下沉**：主应用与各子系统直连同一个 PostgreSQL 数据库，通过 `code-common` 统一管理 `users`、`departments` 和 `repositories` 核心表，实现主数据强一致性。
*   **管理员种子初始化优化**：系统启动时基于邮箱精确匹配初始化默认管理员账号，并赋予 `super_admin` 角色与 `IsAdmin` 标记。
*   **统一令牌验证**：主应用与各子系统之间共享同一个 `jwt_secret` 进行对称签名。主应用负责签发 JWT，子应用作为被动消费端，直接在中间件中对传入的 Bearer Token 进行快速验签鉴权。

---

## 🌟 核心功能模块

### 1. 改进建议与反馈中心 (Feedback Center)
- **富文本与贴图支持**：支持用户在线提交改进建议与缺陷反馈，支持 Markdown 编辑与剪贴板截图直接粘贴上传。
- **全生命周期状态流转**：支持反馈状态流转（待处理 → 处理中 → 已完成 / 已关闭），管理员面板默认智能筛选“待处理”事项，支持多维过滤与检索。

### 2. 代码仓与组织架构主数据管理
- **代码仓全局管理**：负责全平台代码仓的录入、状态维护、成员权限分配。创建仓库时提前校验 `name` 唯一性，返回友好 409 提示。
- **部门与用户管理**：提供部门树形结构维护、成员导入与权限配置，支持分配子系统专属管理角色。

### 3. 开发人员手册 (Developer Handbook)
- **GFM Markdown 渲染引擎**：前端内建自定义 Markdown 解析器，支持代码块（带行号与高亮）、表格、引用块及任务列表。
- **Mermaid 图表支持**：支持在 Markdown 代码块中嵌入 Mermaid 图表语法（`mermaid`），在线渲染流程图、时序图与类图。
- **自动链接与下载优化**：完善 `<URL>` 与 `<email>` 自动链接解析，支持原生流式文件下载与免密 Raw 文档接口（`/api/docs/raw`），自动为 Markdown 图片注入 Bearer Token。

---

## ⚙️ 系统配置指南 (config.yaml)

```yaml
server:
  port: ":8000"                      # 服务监听端口
  gin_log: false                     # 是否打印 GIN 框架路由日志
  external_url: "http://192.168.56.18:8000" # 服务的外部访问基准 URL

# ── 统一数据库配置 (PostgreSQL) ──
database:
  host: "127.0.0.1"
  port: 5432
  user: "postgres"
  password: "YOUR_POSTGRES_PASSWORD"
  dbname: "code_shield"
  sslmode: "disable"

# ── 认证配置 (接入 code-common) ──
auth:
  jwt_secret: "YOUR_JWT_SECRET_KEY_HERE" # 统一共享的 JWT 签名密钥
  password_login_enabled: true        # 是否启用本地用户名/密码登录
  
  # OAuth2 单点登录配置
  oauth2:
    enabled: false
    client_id: "code-bench"
    client_secret: "YOUR_CLIENT_SECRET"
    auth_url: "https://sso.com/auth"
    token_url: "https://sso.com/token"
    userinfo_url: "https://sso.com/userinfo"
    redirect_url: ""
    scopes: ["openid", "profile", "email"]
    admin_list:
      - "admin@yourcompany.com"

# ── 微服务反向代理网关 (Gateways) ──
gateways:
  shield: "http://127.0.0.1:8080"    # 代码质量微服务
  pipeline: "http://127.0.0.1:8082"  # 流水线微服务
  proto: "http://127.0.0.1:8083"     # 接口文稿微服务
  pdm: "http://127.0.0.1:8085"       # 产品数据管理微服务
```

---

## 🛠️ 快速开始

### 1. 一键全系统构建
```bash
# 安装前端依赖、打包静态资源，并编译 Go 后端二进制
make build
```

### 2. 运行服务
```bash
make run
```
默认监听 `:8000` 端口。管理员初始账号：`admin@code-shield.com` / `admin123`。

### 3. 前端独立调试
```bash
cd frontend
npm install
npm run dev  # Vite 调试服务器，默认端口 :5173
```

---

## 📁 目录结构

```text
code-bench/
├── config.yaml             # 系统配置文件
├── main.go                 # 程序入口与反向代理网关配置
├── models/                 # 数据模型（引用 code-common/backend）
│   ├── config.go           # 本地配置解析
│   └── models.go           # Feedback / Repo / Doc 等实体
├── handlers/               # API 控制层
│   ├── auth.go             # 认证与用户信息
│   ├── oauth2.go           # SSO 单点登录流程
│   ├── repo.go             # 代码仓全局管理
│   ├── user.go             # 用户账号与权限管理
│   ├── department.go       # 部门组织架构
│   ├── feedback.go         # 改进建议与反馈处理
│   └── docs.go             # 开发人员手册与 Raw 路由
├── database/               # 数据库初始化
├── templates/              # 成员/部门/代码仓批量导入 CSV 模板
├── frontend/               # React 前端工程 (接入 @code/common)
└── Makefile                # 构建与管理脚本
```

---

## 🏷️ 版本历史

### v0.5.0 (2026-08-14)
*   **全量接入 `code-common`**：
    - 后端下沉 `User`、`Department`、`DatabaseConfig` 模型至 `code-common/backend`，统一使用公共鉴权中间件与响应函数。
    - 前端全面接入 `@code/common`（`ErrorBoundary`、`createApiClient`、`useTheme` 等）。
*   **改进建议与反馈中心重构**：
    - 全新重构反馈中心，支持 Markdown 编辑与剪贴板贴图上传。
    - 管理员面板默认智能筛选“待处理”反馈，支持多维过滤。
*   **菜单体系与图标规范 (ModuleMenuConfig)**：
    - 实现基座 Portal 菜单配置解析规范，子菜单支持渲染 SVG 微图标，Header 标题动态映射。
*   **管理员种子初始化与安全加固**：
    - 优化 admin 账号种子初始化逻辑，精确匹配邮箱并赋予 `super_admin` 角色与 `IsAdmin` 标记。
    - 彻底清理 SQLite 遗留依赖，全面收敛至 PostgreSQL 共享架构。
    - 过滤反向代理中因客户端主动取消造成的 `context.Canceled` 与 `ErrAbortHandler` 错误日志。

### v0.4.0 (2026-07-27)
*   **开发人员手册增强**：内置 Markdown 解析器支持 Mermaid 图表渲染，修复 Autolink 正则误匹配 HTML 闭合标签问题，支持附件原生流式下载解析及免密 Raw 文档路由（`/api/docs/raw`）。
*   **图片鉴权处理**：自动注入 Bearer Token 保证 Markdown 相对路径图片加载鉴权。

### v0.3.0 (2026-07-05)
*   **会话拦截优化**：全局 fetch 401 拦截器，优化微前端宿主健壮性。
*   **代码仓元数据增强**：新增 `HTTPURL` 字段与异步同步补全。

### v0.2.0 (2026-06-08)
*   **统一登录与 SSO 鉴权机制**：集成 OAuth2 / OIDC 与本地登录，建立统一 JWT 会话拦截体系。
*   **公共数据与底层管理**：建立统一的用户、部门、代码仓管理服务。

### v0.1.0 (2026-05-10)
*   **微前端聚合宿主架构**：建立 CodeBench 统一宿主框架，基于 Vite Module Federation 实现微应用动态运行时拼装与网关代理。
