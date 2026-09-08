# CodeBench 开发者文档中心 (Documentation Center) 📚

欢迎查阅 CodeBench 开发者技术指导文档库。本目录收录 CodeBench 门户平台的核心架构规范、子系统开发指南与微前端集成说明，旨在帮助全团队工程师基于统一资产库 `code-common` 快速构建并接入高质量业务子系统。

---

## 🗺️ 文档知识地图与索引

```text
code-bench/docs/
├── README.md                                             # 📖 本文档：文档中心索引与全景概览
└── 01-子系统微前端插件化开发接入指南.md                      # 🚀 核心手册：微前端插件化架构实战、契约规范与零代码接入
```

---

## 📑 核心技术文档导读

### 1. [01-子系统微前端插件化开发接入指南.md](file:///home/fugui/codes/code-bench/docs/01-%E5%AD%90%E7%B3%BB%E7%BB%9F%E5%BE%AE%E5%89%8D%E7%AB%AF%E6%8F%92%E4%BB%B6%E5%8C%96%E5%BC%80%E5%8F%91%E6%8E%A5%E5%85%A5%E6%8C%87%E5%8D%97.md)
*   **面向读者**：新业务子系统开发者、微前端集成工程师。
*   **核心内容**：
    *   **架构与拓扑**：CodeBench 运行时动态加载机制与数据交互时序。
    *   **前端工程契约**：Vite 模块联邦配置规范、`./src/menu.ts` 菜单定义规范、`./src/App.tsx` 双模根组件适配。
    *   **后端服务契约**：依托 `code-common/backend/server` 实现自动前缀剥离、统一 JWT 鉴权与模型复用。
    *   **即插即用配置**：`config.yaml` 中 `gateways` 节点的完整对象配置范例与 Lucide 图标字典。
    *   **常见问题 FAQ**：排查动态加载 404、路由冲突、亮色主题适配等常见坑点。

---

## 🔗 相关工程与公共基础库
*   **公共基础资产库**：[`code-common`](file:///home/fugui/codes/code-common)（统一 Go 后端鉴权/模型与 React 前端规范组件库）
*   **宿主配置文件示例**：[`config.yaml.example`](file:///home/fugui/codes/code-bench/config.yaml.example)
*   **团队通用开发规范**：[`GEMINI.md`](file:///home/fugui/codes/code-common/rules/GEMINI.md) 与 [`AGENTS.md`](file:///home/fugui/codes/code-common/rules/AGENTS.md)
