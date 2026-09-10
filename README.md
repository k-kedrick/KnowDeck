# 个人博客与知识库

面向个人发布与知识沉淀的轻量系统：访客通过公开页面阅读、搜索文章，管理员通过受保护的后台管理文档、分类、标签、媒体与站点设置。

## 功能

- 首页、文章列表与单篇文档页面，支持响应式布局、主题切换和文章大纲。
- GFM Markdown 与受控 HTML 混合内容渲染，支持 KaTeX、表格、任务列表、代码块复制、图片、视频、iframe 和 Callout。
- SQLite FTS5 全文搜索，公开接口只返回已发布内容。
- JWT 管理后台：文档状态、分类树、标签、媒体文件夹、站点设置、管理员资料，以及 `/wang/users` 用户与邀请码管理。
- 文档编辑器使用 `TiptapEditor`。
- 本地草稿恢复、图片上传与外链图片本地化。
- 首页/文章 SEO HTML 外壳、`robots.txt` 与 `sitemap.xml`。

## 技术栈

- 后端：Go 1.26、Gin、`modernc.org/sqlite`、JWT、bcrypt。
- 前端：React 19、TypeScript 6、Vite 8、Tailwind CSS、React Router。
- 内容：React Markdown、remark/rehype、DOMPurify、KaTeX。
- 部署：Go 容器、Nginx 静态前端、SQLite 与上传目录命名卷。

## 目录

```text
boke/
├── AGENTS.md                         # Codex 项目级默认维护指令
├── .agents/
│   └── skills/
│       └── project-owner/
│           └── SKILL.md              # 项目长期维护工作流
├── backend/                          # Go API、服务、仓储、SQLite 与媒体存储
├── frontend/                         # React SPA
├── deploy/                           # Docker 与 Nginx 配置
├── docs/
│   ├── operations/
│   │   └── BACKUP.md                 # 备份、迁移与恢复
│   ├── specs/
│   │   └── EDITOR_FORMAT.md          # 编辑器内容格式契约
│   └── testing/
│       └── FEATURE_TEST_MATRIX.md     # 功能与验证选择矩阵
├── scripts/                          # 项目维护脚本
├── data/                             # 根目录预留数据目录
├── uploads/                          # 根目录预留上传目录
├── .dockerignore
├── .env.example
├── .env.production.example
├── .gitignore
├── README.md
├── ARCHITECTURE.md
├── SECURITY.md
├── CHANGELOG.md
└── CODEX_PROJECT_STATE.md
```

`AGENTS.md` 是 Codex 在本仓库中的项目级默认维护入口。

`.agents/skills/project-owner/SKILL.md` 定义增量开发、根因修复、最小改动、验证复用与长期维护工作流。

`CODEX_PROJECT_STATE.md` 保存当前架构地图、风险、验证缓存及其失效条件。

普通开发任务不需要默认加载全部项目文档；Codex 根据 `AGENTS.md` 和 `project-owner` 工作流，只读取当前任务所需的源码、测试和专项文档。

本地开发数据默认位于 `backend/data/` 与 `backend/uploads/`；根目录的 `data/`、`uploads/` 当前仅为预留目录。

## 本地运行

启动后端：

```powershell
cd backend
Copy-Item .env.example .env
# 在未跟踪的 .env 中填写本机开发凭证后启动
go run ./cmd/server
```

启动前端：

```powershell
cd frontend
npm install
npm run dev
```

Vite 开发服务器监听 `3788`（`http://127.0.0.1:3788`），并将 `/api`、`/uploads` 代理到后端 `3799`（`http://127.0.0.1:3799`）。管理页面入口为 `http://127.0.0.1:3788/wang`。

可用的验证命令：

```powershell
cd backend
go test ./...
go vet ./...

cd ../frontend
npm test
npm run lint
npm run build
```

是否需要运行这些命令以及已有结果是否仍然有效，以 `CODEX_PROJECT_STATE.md` 的验证缓存和失效条件为准。

默认优先执行受影响范围的定向验证，不因为普通修改而重复运行全部测试、构建或浏览器验收。

## Docker 部署

```bash
cp .env.production.example .env.production

docker compose --project-name knowledge-base \
  --env-file .env.production \
  -f deploy/docker/docker-compose.yml \
  up -d --build
```

前端只映射到宿主机 `127.0.0.1:5185`，后端仅暴露在 Compose 网络的 `8090`。

生产环境必须配置：

- 完整站点 URL；
- 明确的 CORS 来源；
- 正确的可信代理；
- 至少 32 字符的非默认 `JWT_SECRET`；
- 至少 12 字符的非默认 `ADMIN_PASSWORD`。

生产部署、数据迁移、备份和恢复的权威流程见 `docs/operations/BACKUP.md`。

## Codex 项目维护

本仓库使用以下三层长期维护结构：

```text
AGENTS.md
    ↓
.agents/skills/project-owner/SKILL.md
    ↓
CODEX_PROJECT_STATE.md
    ↓
affected source / tests / relevant documentation
```

职责分别为：

- `AGENTS.md`：仓库级默认 Codex 指令，要求普通开发任务默认使用 `project-owner`。
- `project-owner/SKILL.md`：定义实际开发、调试、修复、重构、清理和验证工作流。
- `CODEX_PROJECT_STATE.md`：保存当前项目状态和可复用验证证据，避免每次从头扫描和重复测试。

对于普通开发工作，不需要每次重新粘贴完整项目提示词。

用户可以直接描述当前问题或需求，例如：

```text
我测试发现后台保存文章后重新进入偶尔还是旧内容。
直接定位根因并修复，修复完成后保持项目可继续测试。
```

Codex 应按照仓库默认工作流自动处理。

## 文档

- [Codex 项目级指令](AGENTS.md)
- [架构与数据流](ARCHITECTURE.md)
- [安全模型](SECURITY.md)
- [版本变化](CHANGELOG.md)
- [备份、迁移与恢复](docs/operations/BACKUP.md)
- [编辑器内容格式](docs/specs/EDITOR_FORMAT.md)
- [功能验收矩阵](docs/testing/FEATURE_TEST_MATRIX.md)
- [Codex 当前状态与验证缓存](CODEX_PROJECT_STATE.md)
