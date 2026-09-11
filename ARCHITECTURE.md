# 架构设计

本文描述当前系统的长期架构事实。当前运行状态、验证缓存与风险见 [CODEX_PROJECT_STATE.md](CODEX_PROJECT_STATE.md)。

## 系统边界

```text
Browser / Client
  ├─ 公开路由: /, /login, /register, /account/security, /blog, /docs/:slug
  └─ 管理路由: /wang/*
            │
            ▼
Nginx frontend container (:80, 宿主 ${APP_BIND_ADDRESS:-0.0.0.0}:${APP_PORT:-8080})
  ├─ 静态 SPA 资源 (/index.html, /assets/*)
  ├─ /api/* -> 代理到 backend:8090
  ├─ /uploads/* -> 只读挂载 docker_kb-uploads 卷 (带 sandbox CSP 安全头)
  └─ SEO 路由 (/, /blog, /docs/:slug, /robots.txt, /sitemap.xml) -> 代理到后端渲染 HTML 外壳
            │
            ▼
Go/Gin backend (:8090, 仅 Compose 内部网络访问，不对外暴露)
  ├─ Middleware (Recovery, CORS, SecurityHeaders, RateLimiter, Auth)
  ├─ Handlers: 传输层参数绑定与协议转换
  ├─ Services: 业务领域编排与事务协调
  ├─ Repositories: 参数化 SQL 查询与事务控制
  ├─ SQLite 数据存储 (/data/app.db，WAL 模式)
  └─ LocalStorage 文件引擎 (/uploads)
```

本地开发环境由 Vite 在 `3788` 提供前端 SPA，并将 `/api` 与 `/uploads` 代理到后端 `3799`。

## 前端架构

前端入口为 `frontend/src/main.tsx`，核心路由定义在 `frontend/src/App.tsx`。公共端与管理端通过 React Router 7 组织，较重的文档编辑器、阅读器与管理页面采用动态懒加载导入。

### 公共端页面

- `PublicLayout`: 负责站点基本信息注入、顶部导航、全局搜索入口、明暗主题切换与全局页脚。
- `HomePage` 与 `BlogPage`: 展示公开文章、精选置顶、分类列表与按标签多维筛选。
- `DocumentPage` & `DocViewer`: 根据 slug 请求文章；根据 `access_level` 判定展示完整正文还是受限锁定引导卡片；提供双侧目录树/大纲折叠联动、阅读进度条与图片画廊灯箱。
- `LoginPage` & `RegisterPage`: 提供前台会员登录与基于 8 位邀请码的注册，支持安全路径回跳。
- `AccountSecurityPage`: 提供已登录用户自主修改密码，要求校验当前密码与新密码强度（>= 12 位）。
- `SearchModal`: 调用公开全文检索接口，支持快捷键唤起（Ctrl/Cmd + K）。
- `SEOHead`: 客户端动态维护 Canonical、OpenGraph、Twitter Card 与 JSON-LD 结构化数据。

### 管理端页面 (`/wang/*`)

- `AdminAuthGuard`: 守卫 `/wang/*` 受保护路由，验证 `localStorage` 中的 JWT Token 与角色权限，非管理员重定向至 `/wang/login`。
- `AdminLayout`: 提供桌面端固宽侧边栏导航与响应式移动抽屉。
- `AdminDashboardPage`: 呈现站点概览数据、快捷操作入口与近期编辑文章。
- `AdminDocumentList` & `AdminDocumentEditor`: 文档列表支持状态/分类筛选、置顶与批量操作；编辑器使用统一的 `TiptapEditor`。
- `AdminCategoryManager` & `AdminTagManager`: 分类层级树维护（带防环校验）与标签多对多关联。
- `AdminMediaManager`: 媒体资产中心，包含智能分类视图（全部/未分类/未使用）、文档关联树、逻辑文件夹与分片上传控制。
- `AdminUsersPage`: 包含 Users 与 Invites 两个 Tab，负责用户启停/角色分配/密码重置，以及 8 位邀请码生成、明文展示复制、有效期限修改、使用记录反查与批量管理。
- `AdminSettingsPage`: 维护站点全局元信息与公开展示配置。

`frontend/src/api/index.ts` 是统一 HTTP 客户端和前端 API 类型边界，统一处理 Bearer JWT 附加、请求取消与错误规范化。

## 后端架构

依赖装配与服务入口位于 `backend/cmd/server/main.go`：

```text
HTTP Request
  -> Gin Recovery / CORS / SecurityHeaders / IP RateLimiter / AuthMiddleware
  -> Handler: 参数绑定、权限前置校验与 HTTP 状态码映射
  -> Service: 领域业务规则编排、跨仓储事务协同与文件系统调度
  -> Repository: 参数化 SQL 执行、SQLite 单写事务控制
  -> SQLite DB (WAL 模式) / Storage 驱动
```

### 核心业务领域

- **Authentication & Authorization**:
  - 密码使用 bcrypt 进行安全哈希存储。
  - 采用 HS256 签名算法签发 JWT。Token Payload 包含 `user_id`、`role` 与 `auth_version`。
  - 用户凭据变更（修改密码、重置密码、禁用账号、角色调整）后递增 `auth_version`，中间件实时读取数据库最新状态并拒绝失效版本。
  - 角色区分 `admin` 与 `member`；管理员接口严格经过 `RequireAdmin` 守卫。
- **User & Invite System**:
  - 用户注册仅支持通过邀请码完成，新用户角色固定为 `member`。
  - 邀请码支持生成 8 位无歧义随机码或自定义码；为满足管理员在后台随时复制与核对的需求，数据库保留明文 `code` 与用于校验的 `code_hash`。
  - 邀请码消费与用户创建处于同一 SQLite 事务中，记录 `users.invite_code_id` 并更新使用计数。
  - 管理员管理接口提供防自禁用、防自降级与“最后一个 active admin”保护规则。
  - 提供已登录会员自助修改密码接口（`PATCH /api/auth/password`），成功后更新版本并颁发新 Token。
- **Document Access Control**:
  - 文章分为 `public`（公开）与 `authenticated`（登录可见）两级访问权限。
  - 未登录访客获取受限文章时，后端不返回 `content` 与 `excerpt`，仅返回 `locked: true` 元信息；全文搜索前置过滤正文片段；Sitemap 自动排除受限文章。
- **Documents & Taxonomy**:
  - 支持草稿 (`draft`)、发布 (`published`) 与归档；支持分类归属、多标签关联、置顶与权重排序。
  - 分类层级在写入时严格检查父级有效性，杜绝自引用与祖先后代循环依赖。
- **Media Asset & Chunked Upload**:
  - 支持常规文件上传与针对大文件/视频的分片断点续传（`upload-sessions`），分片上传完成后在服务端流式校验合并。
  - 媒体与文档建立 `media_document_refs` 多对多引用关系，文章保存时自动解析媒体链接并同步引用。
  - 严格删除保护：当媒体引用计数 `reference_count > 0` 时阻断删除；批量删除自动跳过被引用的文件。
  - 提供 `POST /api/admin/media/rebuild-references` 接口，可幂等重新扫描全量文档内容并修复历史引用。
- **Search Engine**:
  - 基于 SQLite FTS5 虚拟表，使用 `unicode61` 分词器。
  - 通过 `documents_ai`、`documents_au`、`documents_ad` 触发器保持主表与 FTS5 虚表实时同步；FTS 异常时支持优雅降级为模糊查询。
- **SEO & Static Shells**:
  - 后端对 `/`、`/blog`、`/docs/:slug` 等入口注入预渲染的 SEO HTML Shell，并直接提供 `/robots.txt` 与 `/sitemap.xml`。

## 数据持久化与 Schema

SQLite 数据库通过 `backend/internal/repository/db.go` 进行初始化与版本迁移，严格配置连接池 `MaxOpenConns(1)` 以适配单写模型。

### 核心数据表清单 (11张)

1. `users`: 用户账号、bcrypt 密码哈希、角色、状态、`auth_version` 及所使用的 `invite_code_id`。
2. `categories`: 层级分类树、图标、描述、排序与父级 ID。
3. `tags`: 标签主表与唯一 slug。
4. `documents`: 文章主体，包含标题、正文、`access_level`、发布状态、分类、排序、置顶与浏览量。
5. `document_tags`: 文档与标签多对多关联中间表（外键级联删除）。
6. `media`: 媒体资产元数据、文件路径、URL、大小、MIME 类型与来源。
7. `media_document_refs`: 媒体文件与引用文档的多对多关系表（主键复合约束，带级联删除）。
8. `media_folders`: 媒体逻辑文件夹层级（物理文件不移动，仅逻辑归类）。
9. `invite_codes`: 邀请码记录，包含明文 `code`、哈希 `code_hash`、创建人、最大次数、已用次数、有效期与备注。
10. `settings`: 键值对系统配置表。
11. `documents_fts`: FTS5 虚拟全文检索表。

## 内容契约与排版引擎

数据库中的 `documents.content` 存储受控 HTML 或历史 GFM Markdown 字符串。

- **后台编辑**: 统一使用 `TiptapEditor`。利用 `editorContentAdapter.ts` 转换输入，在用户没有修改文档内容时保留原始字符串；实际编辑后由 TipTap 输出经过 `DOMPurify` 清洗的 HTML。
- **前台阅读**: 统一由 `DocViewer` 调用只读 TipTap 组件 `TiptapReadonlyDocument` 进行渲染，彻底消除传统 Markdown 独立渲染器与富文本编辑器样式、表格、视频排版不一致的问题。
- **内容净化**: 纯粹由 `DOMPurify` 结合 `htmlToMarkdown.ts` 中的标签、属性、样式与协议白名单进行防御，不存在任何第三方 remark/rehype 管道。

## 文件存储与安全

- 开发环境存储在 `backend/uploads/`。
- 生产环境存储在命名卷 `docker_kb-uploads`（挂载至 `/uploads`）。
- 存储层生成基于时间戳与安全随机数的文件名，所有路径经过 `filepath.Clean` 与根目录边界校验，杜绝路径穿越。
- 上传请求受到全局上限及图片、视频、文件分类大小校验，禁止上传危险可执行文件及 SVG。

## 部署拓扑

`docker-compose.yml` 编排两项独立服务：

- **backend**:
  - 非 root 运行（容器用户 `app:app`，UID/GID 1000）。
  - 挂载 `docker_kb-data`（读写）与 `docker_kb-uploads`（读写）。
  - 仅暴露在 Docker 内部网络 `8090` 端口，不映射宿主端口。
- **frontend**:
  - 基于 Nginx 1.29 静态服务。
  - 默认发布宿主所有网卡端口 `${APP_BIND_ADDRESS:-0.0.0.0}:${APP_PORT:-8080}:80`，可直接通过 `http://服务器IP:8080` 访问；若前面有宿主反代，可通过配置 `APP_BIND_ADDRESS=127.0.0.1` 限制为回环监听。
  - 上传卷以只读方式挂载（`docker_kb-uploads:/uploads:ro`），并配置专属附件下载 CSP 与 Sandbox 头。
- **持久化数据卷**:
  - `docker_kb-data`: 持久化保存 SQLite 数据库文件（`app.db`、WAL/SHM）以及首次启动自动生成的 `data/.jwt_secret`。
  - `docker_kb-uploads`: 持久化保存所有上传的物理图片与多媒体文件。

## 架构核心原则与约束

1. **分层严格隔离**: 请求必须沿 `handler -> service -> repository` 流转，禁止 handler 穿透直连数据库。
2. **读写分离与只读防线**: 公开端仅允许 GET 查询已发布且符合权限的内容；任何写操作必须通过 `/api/admin/*` 或特定认证中间件。
3. **真实单写原则**: SQLite 保持单写连接池配置，跨表写入由仓储层显式管理事务。
4. **备份一致性边界**: 数据库与上传文件构成强一致性业务单元，备份与恢复必须同时对 `docker_kb-data` 和 `docker_kb-uploads` 进行打包与还原。
