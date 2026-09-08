# 架构设计

本文只描述长期架构事实。当前问题、验证结果与迁移状态见 [CODEX_PROJECT_STATE.md](CODEX_PROJECT_STATE.md)。

## 系统边界

```text
Browser
  ├─ public React routes: /, /blog, /docs/:slug
  └─ protected React routes: /wang/*
            │
            ▼
Nginx frontend container (:80, host 127.0.0.1:5185)
  ├─ static SPA assets
  ├─ /api/* -> backend:8090
  └─ /uploads/* -> read-only upload volume
            │
            ▼
Go/Gin backend (:8090, Compose network only)
  ├─ middleware and HTTP handlers
  ├─ services
  ├─ repositories
  ├─ SQLite /data/app.db
  └─ local media storage /uploads
```

开发环境由 Vite 在 `3788` 提供 SPA，并代理 API 与上传资源到后端 `3799`。

## 前端

入口为 `frontend/src/main.tsx`，路由定义在 `frontend/src/App.tsx`。公共与管理页面通过 React Router 组织，较重的文档阅读器和管理页面采用动态导入。

### 公共端

- `PublicLayout` 负责站点信息、顶部导航、搜索入口、主题与页脚。
- `HomePage` 和 `BlogPage` 展示公开内容。
- `DocumentPage` 根据 slug 请求文章；`DocViewer` 渲染正文、文章大纲与前后篇。
- `SearchModal` 调用公开搜索接口。
- `SEOHead` 管理客户端元信息；后端同时为公共入口提供 SEO HTML 外壳、站点地图和 robots 文件。

### 管理端

`AdminAuthGuard` 保护 `/wang/*`，`AdminLayout` 提供统一布局；后端管理 API 仍为 `/api/admin/*`。页面覆盖文档、分类、标签、媒体、媒体文件夹、站点设置、管理员资料与用户管理。`/wang/users` 以 Users/Invites 两个 Tab 提供用户查询、创建、状态/角色变更、密码重置，以及邀请码创建、一次性明文展示、列表和禁用流程。

`frontend/src/api/index.ts` 是统一 HTTP 客户端和前端 API 类型边界。管理请求使用 localStorage 中的 Bearer JWT。

## 后端

入口和依赖装配位于 `backend/cmd/server/main.go`：

```text
HTTP request
  -> Gin recovery / CORS / security headers / optional rate limit / auth
  -> handler: bind and validate transport data
  -> service: business rules and multi-repository orcheschestration
  -> repository: parameterized SQL and transactions
  -> SQLite
```

媒体链路还会经过 `internal/storage` 完成本地文件读写。公共 API 位于 `/api/public/*` 且仅注册 GET；管理业务位于 JWT 中间件保护的 `/api/admin/*`。登录、搜索和外部图片代理分别使用内存限流器。

### 主要领域

- Authentication：bcrypt 密码验证、HS256 JWT 签发与解析；`users.auth_version` 写入 JWT 并在认证时校验，凭据变更会递增该版本。
- Users：`users` 区分 `admin`/`member` 与 `active`/`disabled`；认证中间件以数据库当前用户、状态、角色和 `auth_version` 为授权事实。
- Invites：`invite_codes` 仅存 SHA-256 哈希；管理员创建、列表、禁用邀请码，注册通过 `RegistrationService` 在同一 SQLite 事务中消费邀请码并创建固定为 member 的用户。
- Admin user management：`GET/POST /api/admin/users` 提供查询与创建，`PATCH /api/admin/users/:id/status`、`PATCH /api/admin/users/:id/role` 和 `POST /api/admin/users/:id/reset-password` 提供受保护的账号变更；事务规则阻止自禁用、自降级和最后一个 active admin 被禁用或降级。
- Admin invite management：`GET/POST /api/admin/invites` 提供列表与创建，`PATCH /api/admin/invites/:id/status` 提供幂等禁用；列表不返回明文邀请码或 `code_hash`。
- Public auth：`/api/auth/register`、`/api/auth/login` 为公开入口，`/api/auth/me` 需要 JWT；`/api/admin/*` 继续经过 `AuthMiddleware` 与 `RequireAdmin`。
- Documents：草稿/发布/归档、分类、标签、排序、置顶、前后篇和浏览量。
- Categories/Tags：层级分类和多对多标签。
- Search：SQLite FTS5；失败时由仓储实现降级查询。
- Media：上传、引用保护、文件夹、移动、外链图片保存与文档图片本地化。
- Settings：站点 KV 设置与公开站点信息汇总。

## 数据与一致性

SQLite DSN 启用 `foreign_keys(1)`、WAL、`busy_timeout(5000)` 和 `synchronous(NORMAL)`；连接池限制为一个连接以适配单写模型。

主要表：

- `users`
- `categories`
- `tags`
- `documents`
- `document_tags`
- `media`
- `media_folders`
- `settings`
- `documents_fts`（FTS5 虚拟表）

`documents_fts` 由 insert/update/delete 触发器同步。文档与标签同步、文档删除及分类相关的多步写入在仓储层使用事务。Schema 和轻量升级逻辑集中在 `backend/internal/repository/db.go`；修改该文件时必须同时检查现有数据兼容、索引、触发器与回滚策略。

## 内容与编辑器

数据库的 `documents.content` 保存 Markdown 或受控 HTML；两者均可包含安全允许的富文本结构。权威格式约束见 [编辑器内容格式](docs/specs/EDITOR_FORMAT.md)。

- 默认编辑器：`DocumentVisualEditor`，基于 contentEditable，使用 `htmlToMarkdown.ts` 完成标准化和安全清洗。
- 可选编辑器：`TiptapEditor`，通过 `VITE_EDITOR_ENGINE=tiptap` 启用，复用相同的持久化和阅读兼容边界。
- 阅读器：Markdown 内容经 remark/rehype 管道处理；HTML 内容先清洗再呈现。数学插件按需加载。
- 本地草稿：`useDocumentDraft` 保存编辑器引擎、内容格式和文档元数据，正式保存成功后按快照一致性清理。

## 文件存储

开发默认路径为 `backend/uploads/`。生产路径为命名卷 `docker_kb-uploads` 挂载到 `/uploads`。文件记录与文件内容分别由 SQLite 和本地存储管理，因此备份与恢复必须同时覆盖数据库和上传卷。

存储层生成安全文件名并限制解析后的绝对路径仍位于上传根目录。上传服务实施总大小、分类大小、扩展名与文件头检查；媒体删除前检查文档引用。

## 部署

`deploy/docker/docker-compose.yml` 定义：

- backend：非 root 运行，挂载 `docker_kb-data` 和 `docker_kb-uploads`。
- frontend：Nginx 静态服务，仅绑定宿主回环地址，上传卷只读挂载。
- 两个服务均启用资源限制、PID 限制、日志轮转和 `no-new-privileges`。

宿主 HTTPS 与域名反向代理使用独立 Nginx 配置接入，不覆盖现有站点。迁移、备份和恢复见 [运维文档](docs/operations/BACKUP.md)。

## 架构约束

1. 保持 handler -> service -> repository 分层；不要从 handler 直接访问数据库。
2. 公开路由不得暴露草稿或注册写操作。
3. Schema、认证、媒体路径和内容清洗属于高风险边界，修改时验证完整调用链。
4. 文档内容格式必须同时兼容编辑、存储、搜索和只读渲染。
5. 数据库与上传文件是同一业务备份单元。
6. 部署不得暴露后端端口或覆盖宿主现有代理配置。

## Document access control

Documents have one persisted `access_level`: `public` or `authenticated`; legacy rows migrate to `public`. Admin CRUD carries this field. Public document and search routes use optional authentication: anonymous visitors receive safe locked metadata for authenticated documents, while authenticated users receive content. Search filters before FTS snippet generation; authenticated documents are `noindex,nofollow` and excluded from the sitemap. The admin editor exposes the setting, the list shows an access badge, and the viewer does not render a locked body or TOC.
