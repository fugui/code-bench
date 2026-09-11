# CodeBench 开发者综合工作台 (Portal) 🖥️

> **当前版本**：`v0.6.0`

CodeBench 是面向研发效能与安全管理的一站式综合工作台主应用容器（Host）。项目采用**微前端（Micro-frontends）模块联邦**与**插件化运行时动态加载**架构进行设计，聚合了包括代码质量管理（Code Shield）、持续构建流水线（Code Pipeline）、接口文稿（Code Proto）、产品数据管理（Code PDM）以及企业级大模型 AI 网关（Code Gate）等子系统模块。

后端使用 Go 语言搭建，提供轻量的高并发微前端集成环境、统一认证中心（SSO / JWT）、全平台主数据管理、全局操作审计中心以及高性能透明反向代理网关（Gateway）。

---

## 🧩 系统架构与微前端集成

CodeBench 采用**微前端宿主（Host）与插件化架构**，将多个异构子应用在运行时动态拼装为一个统一的高质感控制台：

*   **宿主主应用 (Host)**：`code-bench` 负责整体布局、全局路由导航、暗黑/明亮主题切换、系统账户、团队组织架构、代码仓全生命周期管理与全局操作审计中心。
*   **插件化运行时动态加载 (Dynamic Remote Modules)**：告别静态写死模块联邦，采用插件化运行时动态加载机制。宿主通过 `/api/modules` 接口动态拉取配置，由前端 `moduleLoader` 按需加载并解析子应用容器（`remoteEntry.js`）。子系统实现**即插即用（Plug & Play）与零代码接入**，并支持 `superAdminOnly` 权限控制（如 AI 网关开发期仅超级管理员可见）以及子应用专项二级菜单的动态订阅。
*   **统一网关与透明代理 (Gateway & Reverse Proxy)**：后端内置高性能反向代理机制，将前端发往主应用的子系统 API 请求（如 `/shield/*`、`/pipeline/*`、`/proto/*`、`/pdm/*`、`/gate/*`）透明分流转发给后台对应的独立微服务，自动跳过网关层冗余审计，并对客户端主动断开连接进行静默容错。

---

## 🔐 统一认证与 SSO 机制

主应用接管了全站的身份认证工作，保证了用户只需一次登录，即可无缝穿梭于所有子系统：

*   **OAuth2 / OIDC 单点登录**：支持企业级单点登录系统。授权通过后，自动获取用户信息、部门并支持域名白名单及自定义字段映射。
*   **统一数据模型与公共库下沉**：主应用与各子系统直连同一个 PostgreSQL 数据库，全面接入 `code-common` 统一管理 `users`、`departments`、`audit_logs` 和 `repositories` 核心表，实现主数据强一致性。
*   **管理员种子初始化**：系统启动时基于邮箱精确匹配初始化默认管理员账号，并自动赋予 `super_admin` 角色与 `IsAdmin` 标记。
*   **统一令牌验证与审计留痕**：主应用与各子系统之间共享同一个 `jwt_secret` 对称签名密钥。主应用负责签发 JWT，子应用在中间件中快速验签鉴权；系统全面记录登录、注销、密码修改等关键会话审计。

---

## 🌟 核心功能模块

### 1. 插件化微前端与 AI 网关集成 (Micro-Frontends & AI Gate)
- **零代码即插即用接入**：支持在 `config.yaml` 的 `gateways` 节点中以简写 URL 或完整对象配置注册子系统，自定义菜单标题、Lucide 图标、工作台卡片描述及权限标记，无需修改任何前端代码即可上线新系统。
- **集成企业级大模型 AI 网关 (`code-gate`)**：支持协议感知直通路由、Prompt KV Cache 亲和加速与算力治理管控，支持配置开发期仅超级管理员可见。
- **专项二级菜单动态订阅**：支持运行时订阅子系统（如 Shield 专项分析报告）内部菜单变更，实现工作台侧边栏与微应用内部视图的深度联动。

### 2. 全局操作审计中心 (Global Operation Audit Center)
- **核心操作全程留痕**：基于 `code-common/backend/audit` 自动记录全平台身份认证、代码仓管理、部门调配、账号启停等操作的主体、行为、IP 及实体变更详情。
- **可视化审计控制台 (`/admin/audit`)**：提供审计统计卡片（今日操作数、敏感操作分布）、结构化审计日志列表与多维条件筛选。
- **变更对比与生命周期管理**：内置 `AuditDiffDrawer` 展开修改前后的 JSON 结构化 Diff 对比；提供基于保留天数（如 30 天）的历史日志批量安全清理功能（具备二次确认与防误关保护）；支持管理员维度的审计日志 CSV 报表导出。

### 3. 开发人员手册 (Developer Handbook)
- **GFM Markdown 引擎与 KaTeX 数学公式**：集成 KaTeX 公式渲染引擎，支持行内（`$...$`）与独立块级（`$$...$$`）复杂数学公式排版，支持代码高亮、表格、引用告警框与 Mermaid 图表渲染。
- **外部目录挂载与软链接环路保护**：支持在 `config.yaml` 中挂载团队外部文档仓库，支持符号链接（symlink）智能穿透，并内置 DAG 有向无环图深度检测，杜绝死循环递归。
- **交互与阅读体验优化**：支持长文件名智能悬浮气泡（Tooltip），侧边栏宽度支持鼠标自由拖拽调节；支持文档阅读量与多级评论互动。
- **免密 Raw 路由与 Token 自动注入**：提供 `/api/docs/raw` 免密原生文档与流式附件下载，自动为 Markdown 相对路径图片注入 Bearer Token 保证鉴权加载。
- **收录官方接入规范**：内置《子系统微前端插件化开发接入指南》与文档中心全景索引，指导团队规范接入新系统。

### 4. 改进建议与反馈中心 (Feedback Center)
- **富文本与剪贴板贴图**：支持 Markdown 编辑与屏幕截图直接粘贴上传图片，支持图片大图预览浮层。
- **状态流转与环境元数据溯源**：支持反馈全生命周期流转（待处理 → 处理中 → 已完成 / 已关闭），直观展示当前系统构建版本、构建时间与运行环境元数据。

### 5. 代码仓与组织架构主数据管理
- **代码仓全局防重与规范校验**：提供代码仓录入、状态维护与架构元素（Architecture Elements）推导。新增与 CSV 批量导入均内置多重防重检测（仓库名唯一性防 409、Git SSH/HTTPS 协议标准化 `ssh://git@host/`、分支合法性校验与非法默认回退）。
- **部门与用户精细化权限**：提供部门树形结构维护、成员批量导入导出及权限配置，支持分配子系统专属管理角色。

---

## ⚙️ 系统配置指南 (config.yaml)

```yaml
server:
  port: ":8000"                      # 服务监听端口
  gin_log: true                      # 是否打印 GIN 框架路由日志
  read_timeout: 120s                 # 读取 HTTP 请求超时时间
  write_timeout: 120s                # 写入响应超时时间
  idle_timeout: 180s                 # keep-alive 空闲连接超时时间
  external_url: "http://127.0.0.1:8000" # 服务的外部访问基准 URL（含协议，末尾无斜杠）

# ── 统一数据库配置 (PostgreSQL) ──
database:
  driver: "postgres"                 # 数据库驱动: postgres
  host: "127.0.0.1"                  # PostgreSQL 服务器 IP
  port: 5432                         # 端口
  user: "postgres"                   # 用户名
  password: "YOUR_POSTGRES_PASSWORD" # 密码
  dbname: "code_shield"              # 统一共享数据库名称
  sslmode: "disable"                 # SSL 模式: disable / require
  timezone: "Asia/Shanghai"
  max_open_conns: 50
  max_idle_conns: 10

# ── 认证配置 (接入 code-common) ──
auth:
  jwt_secret: "YOUR_JWT_SECRET_KEY_HERE" # 统一共享的 JWT 签名密钥（留空则随机生成临时密钥）
  password_login_enabled: true        # 是否启用本地用户名/密码登录
  
  # OAuth2 / OIDC 单点登录配置
  oauth2:
    enabled: false
    client_id: "code-bench"
    client_secret: "YOUR_CLIENT_SECRET"
    auth_url: "https://sso.yourcompany.com/realms/main/protocol/openid-connect/auth"
    token_url: "https://sso.yourcompany.com/realms/main/protocol/openid-connect/token"
    userinfo_url: "https://sso.yourcompany.com/realms/main/protocol/openid-connect/userinfo"
    redirect_url: ""                 # 回调地址（留空则推导为 <external_url>/api/oauth2/callback）
    scopes: ["openid", "profile", "email"]
    admin_list:
      - "admin@yourcompany.com"      # 管理员邮箱列表，匹配到的用户会自动同步为超管
    allowed_email_domains:           # 允许通过 SSO 登录的邮箱后缀白名单，留空表示不限制
      - "@yourcompany.com"
    field_mapping:                   # 用户信息字段映射
      username: "preferred_username"
      email: "email"
      name: "name"
      employee_id: "employee_id"
      unique_id: "unique_id"
      employee_type: "employee_type"
    dept_api_url: ""                 # 部门信息同步 API 地址（可选）

# ── 微前端子应用网关与动态加载配置 (Gateways / Micro-Frontends) ──
# code-bench 支持插件化运行时动态加载微前端应用，完全无需修改代码，即插即用。
gateways:
  # 方式一：简写格式（字符串 URL）
  # 对于内置已知模块（shield/pipeline/pdm/gate/proto），系统会自动填充默认中文标题、图标与描述
  shield: "http://127.0.0.1:8080"    # 代码质量微服务
  pipeline: "http://127.0.0.1:8082"  # 持续构建微服务
  pdm: "http://127.0.0.1:8085"       # 产品数据管理微服务
  gate: "http://127.0.0.1:8088"      # 企业 AI 大模型网关 (开发期仅超管可见)

  # 方式二：完整对象格式（支持自定义标题、图标与卡片描述，推荐第三方/新模块接入使用）
  # custom_module:
  #   url: "http://192.168.1.100:8080"       # 模块基准服务地址
  #   title: "业务运维监控"                   # 侧边栏菜单与工作台卡片展示标题
  #   icon: "Activity"                       # Lucide 图标名称（如 Activity, Database, Cpu 等）
  #   description: "实时监控集群节点健康状态"   # 工作台首页卡片简介说明
  #   super_admin_only: false                # 是否仅超级管理员可见

# ── 团队开发指导文档规范仓库配置 ──
docs:
  path: "./docs"                     # 本地面向开发人员的 Markdown 指导文档仓库路径
```

---

## 🛠️ 快速开始与开发命令

Makefile 支持基于源码修改时间戳（包括 Go 源码、前端资源及 `code-common` 跨工程依赖）进行**智能增量构建**：

### 1. 一键增量打包构建
```bash
# 安装依赖、打包前端静态资产并编译 Go 后端二进制
make build
```

### 2. 运行门户服务
```bash
make run
```
默认监听 `:8000` 端口。管理员初始账号：`admin@code-shield.com` / `admin123`。

### 3. 运行自动化测试
```bash
# 运行后端单元测试（自动接入 testdb 隔离测试库，防止数据污染）
make test
```

### 4. 前端独立调试与静态检查
```bash
# 启动本地开发调试服务器 (默认端口 :5173)
make dev

# 执行前端静态代码风格与语法检查
make lint

# 清理所有构建产物
make clean
```

---

## 📁 目录结构

```text
code-bench/
├── config.yaml             # 系统配置文件
├── config.yaml.example     # 系统配置模板示例
├── main.go                 # 程序入口、反向代理网关与路由装配
├── Makefile                # 增量打包、测试与运行脚本
├── docs/                   # 开发者文档中心
│   ├── README.md           # 文档索引与全景概览
│   └── 01-子系统微前端插件化开发接入指南.md # 核心插件化规范指南
├── models/                 # 数据模型与本地配置解析
│   ├── config.go           # gateways 动态对象解析与内置模块元数据
│   └── models.go           # Feedback / Repo / Doc 等实体模型
├── handlers/               # API 控制层
│   ├── modules.go          # 动态微前端模块列表查询 API
│   ├── audit_log.go        # 全局操作审计日志与统计导出
│   ├── auth.go             # 本地登录与认证会话管理
│   ├── oauth2.go           # SSO 单点登录流程与字段映射
│   ├── repo.go             # 代码仓全局管理、防重校验与导入导出
│   ├── arch.go             # 架构元素管理 API
│   ├── user.go             # 用户账号与权限管理
│   ├── department.go       # 部门组织架构管理
│   ├── feedback.go         # 改进建议与贴图上传处理
│   └── docs.go             # 开发人员手册树形扫描、软链接解析与 Raw 路由
├── database/               # 数据库初始化
├── templates/              # 成员/部门/代码仓批量导入 CSV 模板
└── frontend/               # React 前端工程 (全面接入 @code/common)
    ├── src/
    │   ├── components/
    │   │   ├── DynamicRemoteApp.tsx  # 微前端动态容器挂载组件
    │   │   ├── LatexFormula.tsx      # KaTeX 数学公式渲染组件
    │   │   └── MermaidDiagram.tsx    # Mermaid 图表渲染组件
    │   ├── pages/
    │   │   ├── AuditManagement.tsx   # 全局操作审计管理页面
    │   │   ├── DeveloperDocs.tsx     # 开发人员手册交互页面
    │   │   ├── FeedbackCenter.tsx    # 改进建议与反馈中心
    │   │   ├── Repositories.tsx      # 代码仓管理页面
    │   │   ├── UserManagement.tsx    # 用户管理页面
    │   │   └── TeamManagement.tsx    # 团队部门管理页面
    │   ├── utils/
    │   │   └── moduleLoader.ts       # 运行时动态联邦模块加载器
    │   └── App.tsx                   # 门户主框架与动态路由分发
    └── vite.config.ts                # Vite 构建与版本元数据追踪配置
```

---

## 🏷️ 版本历史

### v0.6.0 (2026-09-12)
*   **🧩 插件化微前端运行时动态加载与零代码接入**：
    - 重构微前端集成模式，开发 `DynamicRemoteApp` 与 `moduleLoader`，支持运行时动态注入 `remoteEntry.js` 与解析模块联邦容器。
    - `config.yaml` 中 `gateways` 支持对象化完整配置，新子系统无需修改宿主代码即可即插即用（Plug & Play），自定义菜单标题、Lucide 图标与工作台卡片。
    - 侧边栏微前端菜单支持 `superAdminOnly` 权限过滤与动态拉取/订阅子系统菜单实时变更。
*   **🤖 AI 网关 (`code-gate`) 正式集成**：
    - 门户反向代理网关与动态模块全面集成企业大模型 AI 网关，配置开发期仅超级管理员可见。
*   **🛡️ 全局操作审计中心 (`AuditManagement`)**：
    - 全面集成 `code-common/backend/audit` 审计引擎，覆盖系统登录、账号变更、代码仓增删改与部门变动。
    - 新增全局审计控制台，支持指标统计、多维检索、结构化变更 Diff 抽屉查看。
    - 增加基于保留天数的审计日志安全清理（含二次确认与防误关保护）以及管理员权限下的 CSV 日志导出。
*   **📚 开发人员手册全面增强 (Developer Handbook)**：
    - **KaTeX 数学公式渲染**：集成 KaTeX 引擎，支持行内（`$...$`）与独立块级（`$$...$$`）数学公式高保真排版与一键复制。
    - **外部目录挂载与软链接环路保护**：支持配置外部文档目录路径，支持符号链接（symlink）智能穿透与 DAG 有向无环图环路检测。
    - **长文本智能气泡 & 侧边栏拖拽调宽**：长文件名支持卡片式浮层提示，侧边栏支持自由鼠标拖拽调节宽度，优化多行引用与告警框排版。
    - **开发者接入规范入库**：编写并收录《01-子系统微前端插件化开发接入指南》与文档中心索引。
*   **🗄️ 代码仓与主数据安全加固**：
    - 代码仓录入与批量 CSV 导入增加多重防重检测（仓库名唯一性防 409、Git 地址规范标准化为 `ssh://git@host/`、分支合法性校验与非法默认回退）。
    - 接入架构元素（Architecture Elements）建模与子系统架构推导。
*   **🎨 全局 UI 瘦身与 Design Tokens 规范**：
    - 全面采用 `@code/common` 标准组件（`code-table`、`Drawer`、`Modal`、`EmptyState`、`StatusTag`、`UserMenu`）。
    - 严格遵循深浅双模 Design Tokens 与扁平化 BEM 命名规范，消除所有硬编码颜色。
*   **🚀 工程增量构建与单测环境隔离**：
    - 优化 Makefile，基于源码修改时间戳（含跨工程 `code-common` 依赖）实现智能增量构建。
    - 单测全面接入 `testdb` 隔离测试库，彻底杜绝单测误清空主数据库；增加 `make test` 与 `make run` 快捷目标。
    - 接入版本元数据构建跟踪插件与 Chunk 加载异常智能重载兜底。

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
