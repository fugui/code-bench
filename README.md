# CodeBench 开发者综合工作台 (Portal)

> **当前版本**：`v0.2.0`

CodeBench 是面向研发效能与安全管理的一站式综合工作台主应用容器。项目采用微前端（Micro-frontends） Host 架构进行设计，聚合了包括代码质量管理（Code Shield）、大模型网关（ModelGate）以及接口联调管理（ProtoHub）等子系统模块。

后端使用 Go 语言搭建，提供轻量的高并发微前端集成环境、统一认证中心及请求转发网关（Gateway）。

---

## 🧩 系统架构与微前端集成

CodeBench 采用**微前端宿主（Host）模式**，将多个异构子应用动态拼装为一个统一的控制台：

*   **宿主主应用 (Host)**：`code-bench` 负责整体布局、路由管理、暗黑/明亮主题切换、系统账户及团队/代码仓管理。
*   **子应用 (Remote)**：利用 **Vite Module Federation (模块联邦)** 在浏览器运行时动态拉取子应用组件（例如代码质量微应用 `ShieldApp` 由 `shield/App` 远程模块呈现，并动态载入 `shield/menu` 获取菜单选项）。
*   **统一网关 (Gateway)**：后端内置反向代理机制，将前端发往主应用的子系统 API 请求（如 `/api/shield/*`）自动透明分流转发给后台对应的独立服务（如 `code-shield-server`）。

---

## 🔐 统一认证与 SSO 机制

主应用接管了全站的身份认证工作，保证了用户只需一次登录，即可无缝穿梭于所有子应用中：

*   **OAuth2 / OIDC 单点登录**：支持企业级单点登录系统。授权通过后，自动获取用户信息及所属部门。
*   **用户 ID 对齐与影子账户 (Shadow Users)**：当用户首次从 SSO 登录成功后，主应用会将该用户的基本数据及统一派发的 `UserID` 下发给子系统，子系统在本地数据库中创建或对齐对应的“影子账户”及外键关系。
*   **统一令牌验证**：主应用与各子系统之间共享同一个 `jwt_secret` 进行对称签名。主应用负责签发 JWT，子应用作为被动消费端，直接在中间件中对传入的 Bearer Token 进行快速验签鉴权。

---

## ⚙️ 系统配置指南 (config.yaml)

系统默认加载根目录下的 `config.yaml` 配置文件（模版参考 `config.yaml.example`），包含以下关键配置版块：

### 1. HTTP 服务配置 (server)
```yaml
server:
  port: ":8000"                      # 服务监听端口
  gin_log: true                      # 是否打印 GIN 框架路由日志
  external_url: "http://127.0.0.1:8000" # 服务的外部访问基准 URL（供重定向及 callback 解析）
```

### 2. 认证配置 (auth)
```yaml
auth:
  jwt_secret: "YOUR_JWT_SECRET_KEY_HERE" # 统一共享的 JWT 签名密钥（生产环境请务必修改且两边保持一致，留空则随机生成临时密钥）
  password_login_enabled: true        # 是否启用传统用户名/密码本地登录
  
  # OAuth2 单点登录配置
  oauth2:
    enabled: false                   # 是否启用单点登录
    client_id: "code-bench"          # 在 SSO 平台注册的 Client ID
    client_secret: "YOUR_CLIENT_SECRET" # SSO 客户端密钥
    auth_url: "https://sso.com/auth"  # 授权端点 URL
    token_url: "https://sso.com/token" # Token 交换端点
    userinfo_url: "https://sso.com/userinfo" # 用户数据获取端点
    redirect_url: ""                 # 回调重定向 URL (留空则根据 external_url 自动推导)
    scopes:
      - "openid"
      - "profile"
      - "email"
    admin_list:
      - "admin@yourcompany.com"      # 管理员账号白名单列表，匹配到的用户登录后自动设为系统管理员
    field_mapping:
      username: "preferred_username" # 映射为账号名/英文名
      email: "email"                 # 映射为邮箱
      name: "name"                   # 映射为中文名/姓名
      employee_id: "employee_id"     # 映射为工号
      unique_id: "unique_id"         # 映射为 SSO 平台唯一标识 UUID
      employee_type: "employee_type" # 映射为员工类型
    dept_api_url: ""                 # 用于拉取部门信息的外部 API 接口 (可选)
```

### 3. 微服务网关与同步配置 (sync & gateways)
```yaml
sync:
  targets:
    - "http://127.0.0.1:8080"        # 子服务同步列表

gateways:
  shield: "http://127.0.0.1:8080"    # 代码质量微服务后台转发终点
```

---

## 🛠️ 开发者指南

我们提供了 `Makefile` 进行一键构建、开发以及依赖管理。

### 1. 安装前端依赖
在执行开发和编译前，必须拉取并安装前端项目依赖：
```bash
make install
```

### 2. 启动本地开发调试服务器
启动前端 Vite 开发服务器（支持热重载 HMR），本地调试默认端口为 `:5173`，后端 Go 服务默认在 `:8000`：
```bash
make dev
```

### 3. 一键全系统打包构建
打包前端生成生产环境的压缩静态资产（输出到 `frontend/dist/`），并把 Go 后端编译为可执行文件（在根目录下生成 `code-bench-portal`）：
```bash
make build
```

### 4. 本地生产环境预览
在本地以生产环境模式运行并预览构建出的静态资产：
```bash
make preview
```

### 5. 清理构建产物
删除所有编译生成的中间文件、可执行二进制文件及前端 `dist/` 文件夹：
```bash
make clean
```

---

## 🚀 构建与检查 (Build & Check) 模块重构设计

为了提升流水线子系统（`code-pipeline`）的内聚性，同时避免多子系统重复录入代码仓数据而引发的数据一致性冲突，我们对「构建与检查」模块进行了全新重构设计：

### 1. 以代码仓镜像为中心的数据流 (Pull 模式)
*   **全局数据源对齐**：主应用 `code-bench` 担当底层数据管理控制台，全权负责全局应用代码仓配置的增删改。
*   **本地只读镜像表**：子应用 `code-pipeline` 本地数据库只保存只读的 `repositories` 镜像表。数据写操作被完全封锁。
*   **定时主动同步 (Pull)**：`code-pipeline` 弃用被动推送 (Push) 接收模式，通过后台挂载的定时器 (以 5 分钟为周期) 携带系统签发的 Bearer Token 向 `code-bench` 的 `GET /api/repos` 接口发起主动拉取，全量更新本地镜像缓存。支持未入库仓库的单条 Lazy Load 同步保护。

### 2. 分支多流水线绑定架构 (Execution Plan)
*   **多分支绑定关系**：每个代码仓对应 1 至多个分支。
*   **流水线方案绑定**：各分支均支持配置多条、单条或零条（例如个人测试分支）流水线配置（`ExecutionPlan`），通过 `repository_id` 外键与本地镜像仓库关联。
*   **双向交互入口**：
    *   **以代码仓为中心**：前端 `Repos.tsx` 页面作为首要管理入口，左侧加载只读仓库卡片，右侧直接按分支列表平铺展现绑定方案、最新执行状态及三方日志链接，提供直观的分支覆盖视角。
    *   **以流水线为中心**：前端 `PipelineConfig.tsx` 页面保留流水线级别的关联展现，但创建/编辑方案时均通过下拉框选择已同步的镜像代码仓，禁止用户自由输入任意 URL。

### 3. 三方系统实时透传与轻量化日志
*   **废除本地日志库**：`code-pipeline` 彻底剥离本地日志及历史状态表（`ExecutionLog`），消除海量无用文本数据对数据库存储的无谓挤占。
*   **代理代理透传 API**：当用户在界面（代码仓、最近历史或仪表盘）上查看运行日志和最新状态时，后端 Handler 通过代理调用向真正执行流水线的第三方 CI/CD 系统实时发出查询请求，高保真度向前端进行透传呈现。
*   **直达超链接**：前端日志弹出窗或操作按钮提供可以直达第三方流水线系统日志页面的超链接，免去重复登录和寻找轨迹的琐碎步骤。

---

## 📜 版本历史

### v0.3.0 (2026-07-05)
*   **主应用全局会话拦截优化**：主应用入口添加了全局 fetch 401 拦截器，以处理子应用嵌入时的会话失效问题，优化微前端宿主健壮性。
*   **代码仓元数据增强**：`Repository` 数据模型中新增了 `HTTPURL` 字段，且在异步查询时能够补全保存 `ssh_url` 与 `http_url`，若 `project_id` 或 `http_url` 缺失则会触发异步同步补全。
*   **登录态有效期优化**：调整 local token 签发有效期为 6 小时，以便对齐 SSO 会话。

### v0.2.0 (2026-06-08)
*   **统一登录与 SSO 鉴权机制**：全面集成并打通企业级 SSO 单点登录与常规密码登录流，建立了统一的 JWT 令牌生命周期与会话拦截体系，彻底解决了登录回调过程中的无限重定向等流转缺陷。
*   **公共数据与底层管理服务**：纳入了统一的用户、团队、代码仓等全局元数据管理，并为所有微前端子应用提供统一的外键绑定和影子账户同步。
*   **部门信息自动化同步**：实现了基于 Cookie 安全透传的同源代理机制与入库绑定，解决了获取部门信息时所面临的跨域响应体（CORS）读取拦截问题。

### v0.1.0 (2026-05-10)
*   **微前端聚合宿主架构**：建立 CodeBench 统一宿主框架原型，基于 Module Federation 模块联邦实现对 Code Shield 等异构子应用的动态运行时拼装和布局整合。
*   **轻量化代理分流网关**：后端引入轻量路由代理网关，透明接管并智能分发前端子系统 API 请求，实现微服务无感聚合。

