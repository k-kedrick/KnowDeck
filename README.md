# 个人博客与知识库

面向个人发布与知识沉淀的轻量系统：访客通过公开页面阅读、搜索文章，管理员通过受保护的后台管理文档、分类、标签、媒体与站点设置。

## 功能

- 首页、文章列表与单篇文档页面，支持响应式布局、主题切换和文章大纲。
- GFM Markdown 与受控 HTML 混合内容渲染，支持 KaTeX、表格、任务列表、代码块复制、图片、视频、iframe 和 Callout。
- SQLite FTS5 全文搜索，公开接口只返回已发布内容。
- JWT 管理后台：文档状态、分类树、标签、媒体文件夹、站点设置及管理员资料。
- 文档编辑器支持两套引擎：默认 `DocumentVisualEditor`，设置 `VITE_EDITOR_ENGINE=tiptap` 可启用 Tiptap 实现。
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
├── .agents/skills/project-owner/   # 项目长期维护规则
├── backend/                         # Go API、服务、仓储、SQLite 与媒体存储
├── frontend/                        # React SPA
├── deploy/                          # Docker 与 Nginx 配置
├── docs/
│   ├── operations/BACKUP.md
│   ├── specs/EDITOR_FORMAT.md
│   └── testing/FEATURE_TEST_MATRIX.md
├── README.md
├── ARCHITECTURE.md
├── SECURITY.md
├── CHANGELOG.md
└── CODEX_PROJECT_STATE.md
```

本地开发数据默认位于 `backend/data/` 与 `backend/uploads/`；根目录的 `data/`、`uploads/` 当前仅为预留目录。

## 本地运行

```powershell
cd backend
go run ./cmd/server
```

```powershell
cd frontend
npm install
npm run dev
```

Vite 开发服务器默认监听 `3000` 并将 `/api`、`/uploads` 代理到后端 `8090`。可用的验证命令：

```powershell
cd backend
go test ./...
go vet ./...

cd ../frontend
npm test
npm run lint
npm run build
```

是否需要运行这些命令以及当前有效结果，以 `CODEX_PROJECT_STATE.md` 的验证缓存为准。

## Docker 部署

```bash
cp .env.production.example .env.production
docker compose --project-name knowledge-base \
  --env-file .env.production \
  -f deploy/docker/docker-compose.yml up -d --build
```

前端只映射到宿主机 `127.0.0.1:8080`，后端仅暴露在 Compose 网络的 `8090`。生产环境必须配置完整站点 URL、CORS 来源、可信代理、至少 32 字符的非默认 JWT 密钥和至少 12 字符的非默认管理员密码。

## 文档

- [架构与数据流](ARCHITECTURE.md)
- [安全模型](SECURITY.md)
- [版本变化](CHANGELOG.md)
- [备份、迁移与恢复](docs/operations/BACKUP.md)
- [编辑器内容格式](docs/specs/EDITOR_FORMAT.md)
- [功能验收矩阵](docs/testing/FEATURE_TEST_MATRIX.md)
- [Codex 当前状态与验证缓存](CODEX_PROJECT_STATE.md)
