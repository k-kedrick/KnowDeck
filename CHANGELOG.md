# 变更日志 (CHANGELOG.md)

所有本项目的架构变动、功能新增、Bug 修复与部署更新均记录在此。

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- member 邀请码注册、登录与 `/api/auth/me`，以及管理员邀请码创建、列表和禁用 API。
- 增加管理员用户列表、搜索、筛选、分页、创建 member/admin、启用/禁用、角色调整和密码重置 API，并实施自操作与最后 active admin 保护。
- 增加 `/wang/users` 用户/邀请码管理界面，支持完整用户操作、邀请码生成与一次性明文展示。
- 后台新增管理员账号与密码修改功能，并在凭据变更后使旧认证 Token 失效。
- 增加首页、文章列表、单篇文章的 SEO HTML 外壳，以及 `robots.txt`、`sitemap.xml`。
- 增加媒体文件夹、媒体移动/批量移动、外链图片保存与文档图片本地化链路。
- 增加可通过 `VITE_EDITOR_ENGINE=tiptap` 启用的 Tiptap 编辑器，并覆盖历史内容兼容、表格、媒体、上传锚点与大文档回归测试。

### Fixed

- 邀请码消费与 member 创建使用原子事务；认证按数据库当前状态、角色与 `auth_version` 使旧 Token 失效。
- 文档列表改用独立状态 PATCH 接口，避免用不含正文的列表对象执行全量更新而清空内容。
- 文档与标签同步、文档删除、分类删除等多步写入改为事务处理。
- 收紧 CORS 来源、媒体路径、搜索片段和文档内容的安全边界。

### Changed

- 统一本地开发端口与管理入口：前端迁移至 `3788`、后端迁移至 `3799`、Docker 宿主入口迁移至 `5185`，管理页面迁移至 `/wang/*`。
- 文档体系收敛为 README、架构、安全、变更日志、Codex 动态状态及三个按需专项文档；移除重复的 AI 项目总结和缺陷台账。

## [v0.1.0-Init] - 2026-08-28

### Added

- 确立《AI Coding 项目总负责人 / 首席架构师工作协议》，明确生产安全第一原则。
- 初始化标准架构文档 `ARCHITECTURE.md`、安全规范 `SECURITY.md`、备份恢复方案（现位于 `docs/operations/BACKUP.md`）与项目说明 `README.md`。
- 完成现有 Go 后端 (`knowledge-base/backend`) 与 React 前端 (`frontend`) 的代码库审计。
- 后端基础架构：Go + Gin + Pure Go SQLite + JWT Auth + Rate Limiter + Local Storage。
- 前端基础架构：Vite + React 19 + TypeScript + TailwindCSS + Markdown 引擎。

### Security & DevOps

- 明确宿主服务（3X-UI, Xray, 既有 Nginx）隔离规范与零侵入原则。

## [v0.1.1-Phase1] - 2026-08-28

### Fixed

- **后端数据库连接池死锁**: 修复 `DocumentRepository.List` 中 `rows.Next()` 期间嵌套查询标签导致 SQLite 连接死锁的问题。
- **时间格式兼容性**: 在 `utils` 中添加 `ParseFlexibleTime`，完美解析 SQLite 数据库标准时间格式。
- **前端登录 API 映射**: 修正 `frontend/src/api/index.ts` 中的登录接口路径为 `/admin/auth/login`。
- **Vite 网络绑定**: 配置 `vite.config.ts` 监听 `0.0.0.0` 支持双栈 (IPv4/IPv6) 访问。

### Verified

- 完成后端 Go 服务 (`:8090`) 与前端 React SPA (`:3000`) 本地一键拉起与自动化监控。
- 经过真实 Chrome 浏览器与 `browser_subagent` 验证：首页渲染、Markdown 排版、Callouts、Go 代码高亮、KaTeX 数学公式、FTS5 全文搜索弹窗及 JWT 鉴权完全正常。

## [v0.2.0-Phase2] - 2026-08-28

### Added

- **管理后台全套 UI 视图**:
  - `AdminAuthGuard`: 未登录重定向与 JWT Token 刷新守护。
  - `AdminLayout`: 响应式后台 Shell，提供侧边栏导航与用户信息展示。
  - `AdminLoginPage`: 登录控制台与频率阻断反馈。
  - `AdminDocumentList`: 支持模糊搜索、状态/分类筛选、置顶与快速删除。
  - `AdminDocumentEditor`: **Markdown 双栏实时编辑器**（DOMPurify 净化、代码高亮、KaTeX 公式、Mermaid 图表、Callouts 提示框、拖拽文件上传自动插图）。
  - `AdminCategoryManager`: 分类父子层级树管理与排序。
  - `AdminTagManager`: 细分标签管理。
  - `AdminMediaManager`: 媒体文件网格、复制 MD 代码与删除保护。
  - `AdminSettingsPage`: 站点全局配置管理。
- **后端媒体安全防护**: 在 `MediaService.Delete` 中添加数据库全文引用检测，拦截已被文档引用的媒体硬删除。
- **前端客户端全量 API 导出**: 补全 `frontend/src/api/index.ts` 中全部 20 个 Admin 接口方法。

### Verified

- `go test ./...` 100% 编译通过。
- `npm run build` (tsc + vite build) 100% 零错误打包。
- 通过 `browser_subagent` 完成全量 25 项端到端流程验证（登录 -> 新建文章 -> Markdown 实时预览 -> 保存发布 -> 前台可见 -> 分类标签设置 -> 登出）。

## [v0.2.5-Phase2.5] - 2026-08-28

### Verified & Hardened

- **Git 审计与清理**: 建立根目录 `.gitignore`，清理临时调试文件。
- **DOMPurify XSS 过滤回归**: 验证包含 `<script>`、`<iframe src="javascript:...">` 和 `onerror` 的恶意 Payload 被 100% 清洗阻断，未破坏正常 Markdown。
- **草稿/发布隔离回归**: 验证 `DRAFT` 状态文档在 API、数据库和前台界面被 100% 隔离隐藏。
- **并发与死锁回归**: 验证 30 次并发 HTTP 请求无 `SQLITE_BUSY` 和死锁挂起。
- **生产 Blockers 标注**: 明确记录生产环境中 `JWT_SECRET` 和 `ADMIN_PASSWORD` 必须覆写，且 Nginx SPA 需配置 `try_files` 的安全要求。

## [v0.3.0-WYSIWYG-Editor] - 2026-08-28

### Added

- **云端文档风可视化编辑器 (DocumentVisualEditor)**: 新增居中沉浸式画布、WYSIWYG 实时渲染、选区浮动工具栏、快捷 Block 块插入（支持 H1/H2/H3、Callouts 提示框、代码块、表格、媒体文件拖拽上传）。
- **多视图模式自由切换**: 提供“✨ 沉浸式可视化模式”、“📝 Markdown 双栏模式”与“👁️ 全屏真实预览模式”无缝切换。
- **双向 Markdown 转换增强**: 在 `htmlToMarkdown.ts` 中增强对 Callouts (`> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`) 和飞书/Notion 布局容器解包的转换支持。

### Fixed

- **文档超宽挤压与右侧溢出 Bug 修复**:
  - 在 `index.css` 中添加 `.markdown-body img` 与 `video` 的 `max-width: 100% !important; height: auto !important;` 响应式规则，彻底解决大图/截图挤压表格单元格导致右侧文字变成单字竖排溢出的样式缺陷。
  - 给 `.markdown-body table` 补充 `display: block; max-width: 100%; overflow-x: auto;` 容器横向滚动保护。
  - 在 `htmlToMarkdown.ts` 中针对包含图片的 Feishu / Notion 布局包装表格进行智能解包，转换为自上而下的标准块级段落。
- **URL 路径末尾粘连中文字符吞噬 404 Bug 修复**:
  - 根因：Markdown 解析器或前端剪贴板将 URL 进行了 Percent-encoding (`%E4%B8...`)，原 CJK 匹配正则无法识别 ASCII 编码的字符，导致整个后续中文句子被误当做 URL 路径导致点击 404 重定向失败。
  - 修复：在 `sanitizeUrlAndText` 中先使用 `decodeURIComponent` 解密 `rawHref`，精准分离标准的 ASCII URL 与后续粘连的中文字符/标点（如 `https://myaccount.google.com/security` 与 `下滑找到这个位置`），并在 `DocViewer.tsx` / `DocumentVisualEditor.tsx` 中同步生效。

### Verified

- `cmd /c npm run build` (tsc -b && vite build) 100% 零错误打出 `dist/` 生产包。
- `go vet ./...` 100% 后端校验通过。
- 通过 Chrome 真实浏览器完成前后台可视排版、保存发布与前台展示验证。

## [v0.4.0-Native-Document] - 2026-08-28

### Added

- **原生文档划词浮动工具条 (Floating Context Selection Toolbar)**:
  - 彻底去除静态顶置工具栏，实现划词自动在选中文本正上方弹出浮动上下文菜单。
  - 采用成熟在线文档交互：包含 `H1 / H2 / H3 / 正文` 标题下拉菜单、`≡ ∨` 对齐/列表下拉菜单、粗体 **B**、斜体 *I*、下划线 <u>U</u>、删除线 ~~S~~、行内代码 `</>`。

### Fixed

- **切换标题字号无需刷新实时变大 Bug 修复**:
  - 根因：Tailwind 重置样式 (`@tailwind base`) 默认重置了 HTML 原生 `<h1>`, `<h2>`, `###` 的字号；且画布 `canvasRef` 缺失 `.markdown-body` 样式作用域，导致点击 `formatBlock` 生成 raw `<h2>` 时字体大小未立即改变。
  - 修复：在 `index.css` 中为 `[contenteditable] h1`, `[contenteditable] h2`, `[contenteditable] h3` 追加 `!important` 标题缩放规则，并在 `DocumentVisualEditor.tsx` 中封装 `applyHeadingBlock` 强制触发 DOM 实时重绘。点击 H1/H2/H3 瞬间文字即刻放缩变大。
- **编辑保存后块级段落合并黏连及红字/行内颜色丢失 Bug 修复**:
  - 根因：从飞书/Word/网页复制粘贴的内容在 DOM 中常以 `<div>...</div>` 包裹段落或包含 `<span style="color: ...">`。之前 `htmlToMarkdown.ts` 的 `case 'div'` 直接返回 `childrenStr`（缺少 `\n\n` 块级分隔符），且 `case 'span'` 忽略了 `style="color: ..."`，导致保存成 Markdown 时所有 `div` 块被连成一行大长句，且文字颜色丢失。
  - 修复：在 `htmlToMarkdown.ts` 中将 `div`, `section`, `article`, `main`, `header`, `footer` 升级为标准块级元素（自动包裹 `\n\n` 换行），并在 `span` / `font` / `mark` 解析逻辑中保留 `style="color: ..."` 与 `style="background-color: ..."` 样式，实现编辑模式（图一）与保存前台渲染模式（图二）100% 完全一致。

## [v0.5.0-Visual-Image-Resizer] - 2026-08-28

### Added

- **图片可视化缩放与悬浮操作条 (Visual Image Resizer & Floating Action Bar)**:
  - 点击编辑器中任意图片，自动在图片上方弹出一体化悬浮控制条。
  - **快捷 Preset 尺寸**：支持一键缩放至 `25%`（小图）、`50%`（中图）、`75%`（大图）、`100%`（全宽）与 `原图`（Auto）。
  - **对齐控制**：支持 `居中` | `居左` | `居右` 布局对齐与一键删除。
  - **右下角 Handle 拖拽**：绘制蓝色焦点外框与右下角 Handle 手柄，支持按住鼠标直接拖拽放缩任意宽度。
- **图片显示裂开失效 (`🖼️图片` 图标) 及 DOMPurify 净化抹除 Bug 修复**:
  - 根因：DOMPurify 的默认安全 URI 正则 (`ALLOWED_URI_REGEXP`) 未包含 `data:` (剪贴板 Base64 截图) 与 `blob:` (本地临时对象 URL)。当用户直接 Ctrl+V 粘贴图片或插入 Base64 图片时，DOMPurify 默认清除了 `src` 属性，导致 `<img src="data:image/png;base64,...">` 被擦除变成 `<img alt="图片">` 裂图。
  - 修复：在 `DocumentVisualEditor.tsx` 与 `AdminDocumentEditor.tsx` 中为 `DOMPurify.sanitize` 配置 `ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|file|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i` 明确放行 `data:` 与 `blob:`，并在 Visual Editor 中新增 `onPaste` 剪贴板图片自动拦截与静默上传支持，彻底解决裂图问题。

## [v0.6.0-Rich-Text-Table-Matrix] - 2026-08-28

> [!NOTE]
> **历史事实校准注记**：本版本曾记录 8x8 动态表格网格选择器设计。默认 `DocumentVisualEditor` 实际保留 HTML/GFM 表格解析与序列化兼容，但没有该交互创建 UI；Tiptap 可选引擎具有表格扩展。当前格式边界见 `docs/specs/EDITOR_FORMAT.md`。

### Added

- **文档 8x8 交互式网格表格选择器 (Document Table Matrix Grid Picker)**:
  - 鼠标划过“插入支持富文本的表格”下拉菜单，自动弹出 8x8 动态行列感知选择网格。
  - 划过网格单元格（如 3x4）时实时高亮并显示 `3 x 4 富文本表格`，点击即刻在光标处生成多列富文本表格。
- **HTML 富文本表格与嵌入图片多列排版保留 (Rich Text Table Preservation)**:
  - 根因：之前 `htmlToMarkdown.ts` 在处理包含图片的表格时会将 `<table>` 解包成垂直段落，导致图三中原本左右并排的双列图片表格（图二）拆解成单列。
  - 修复：升级 `htmlToMarkdown.ts`，为包含图片、多行文本或复杂列样式的表格完整保留 `<table class="feishu-rich-table">` 标签与 CSS 列宽限定，在前后台完美展现图二双列并排嵌入图片的排版。
- **粘贴段落文字忽大忽小、行高间距混乱 Bug 修复**:
  - 根因：从飞书/Word/网页复制粘贴的文本带有 `font-size: 16px; line-height: 1.2` 等杂乱内联 CSS 规则，覆盖了正文默认样式；且选择划词转换为“正文”时未擦除残留内联样式，导致同为“正文”但文字大小不一、垂直间距忽大忽小。
  - 修复：在 `htmlToMarkdown.ts` 中新增 `cleanInlineStyle` 过滤掉内联 `font-size`/`font-family`/`line-height`/`margin` 杂质（100% 保留文字颜色与高亮笔底色），并在 `applyHeadingBlock('P')` 触发时自动擦除选中文本的异形字号，实现全篇正文段落 15px 字号与 1.75 舒适行间距的完美对齐。

## [v0.7.0-Line-Height-Harmonization] - 2026-08-28

### Fixed

- **换行与回车间距忽大忽小 (Paragraph vs Soft Break Gap Mismatch) Bug 修复**:
  - 根因：之前 `index.css` 对 `<p>` 段落设置了 `1.25rem` (20px) 的底边距，而同一段落内部由 `<br />` 分隔的行间距只有 0px。导致按 `Enter` 产生新段落 `<p>` 时留白极宽，而软换行 `<br />` 时又过于紧凑，视觉上呈现“同样的换行但行距完全不同”。
  - 修复：在 `index.css` 中将段落边距统一定制为 `margin-bottom: 0.5rem !important` (8px)，并在 `DocViewer.tsx` 中接入 `remark-breaks` 插件，使 Markdown 内部软换行与段落换行行间距 100% 自然平滑过渡，统一为在线文档换行规范。

## [v0.8.0-Table-Column-Divider-Resizer] - 2026-08-29

> [!NOTE]
> **历史事实校准注记**：本版本曾记录默认编辑器的表格分栏拖拽设计。`DocumentVisualEditor` 实际只保留表格布局与内容兼容；Tiptap 可选引擎提供可调整表格扩展。当前格式边界见 `docs/specs/EDITOR_FORMAT.md`。

### Added

- **文档表格列宽自由拖拽调节器 (Table Column Divider Drag Resizer)**:
  - 鼠标悬停在表格列分界线上时，自动感应并呈现蓝色分栏拖拽指示线与 `col-resize` 交互手柄（对齐图三至图五）。
  - 支持按住鼠标向左/向右自由拖动，实时调节左列（图片列）与右列（文字列）的宽度百分比（如 65%:35% 或 50%:50%）。
  - 新增表格浮动控制条，支持一键 `+行`、`+列` 以及删除整个表格。

### Fixed

- **表格右侧撑破拉长、超出纸张边界 Bug 修复 (Fixed Layout & Word Wrap)**:
  - 在 `index.css` 中为所有表格配置 `table-layout: fixed !important; width: 100% !important; max-width: 100% !important;` 以及 `word-break: break-word !important;`，文字单元格自适应换行，图片按列宽自适应缩放，彻底消除图一、图二中右侧超出文档边界的缺陷。
- **表格多行整列同步响应与拖拽指示线跟随 Bug 修复 (Multi-row Column Width Synchronization)**:
  - 根因：之前拖拽分栏时仅设置了当前单个单元格的宽度，其余 `<tr>` 行仍受默认宽度限制，导致多行表格（包含大图或多行文本）无法被拖动收缩；且拖拽过程中指示线未跟随光标实时更新坐标。
  - 修复：在 `handleColDragStart` 中迭代 `Array.from(table.rows)` 为所有行的对应列同步设置 `style.width` 与 `style.maxWidth` 百分比，并在 `mousemove` 过程中动态计算更新蓝色指示线像素位置，实现多行多图表格 100% 丝滑左右放缩。

## [v0.8.1-P1-Time-Fix-And-Simplify] - 2026-09-01

### Fixed

- **SQLite 时间解析 P1 Bug (零值 0001-01-01 回归修复)**:
  - 根因：`media_repository.go`、`search_repository.go`、`user_repository.go`、`setting_repository.go` 错误使用 `time.Parse(time.RFC3339, ...)` 解析 SQLite 默认 `CURRENT_TIMESTAMP`（`YYYY-MM-DD HH:MM:SS` 格式），导致解析失败静默回退为 `time.Time{}` (`0001-01-01T00:00:00Z`)。
  - 修复：统一将 4 个 Repository 的时间解析替换为权威 `utils.ParseFlexibleTime`，并在 `utils.go` 中增强对 `RFC3339Nano` 及带微秒/纳秒时间戳的兼容解析。
  - 新增端到端 Repository 集成回归测试与 `utils_test.go` 时间测试，100% PASS。

## [v0.9.0-TOC-And-Directory-Revamp] - 2026-09-02

### Added

- **前台阅读端与后台大纲全量美化及完整内容展示升级**:
  - **看全内容保障 (Full Content Visibility)**:
    - 彻底解除前台右侧“本文目录” (TOC) 与后台右侧“本文大纲” (Outline) 的单行强制截断（`truncate`），引入 `break-words leading-snug` 多行自适应排版，长标题 100% 完整展示不再截断为 `...`。
    - 边栏容器适度加宽扩展（前台 TOC 与后台大纲扩展至 `w-72` ~ `w-80`，左侧目录树扩展至 `w-72`），在超宽屏下提供更充裕可视空间。
    - 提供“换行模式 / 紧凑单行”自由切换开关（Wrap Toggle）。
  - **现代化云端文档美学重塑**:
    - 引入层级树导向折线（Tree Guide Lines）与发光活跃小节指示条（`active-toc-glow`）。
    - 后台大纲重构为精致的彩色层级微标（`H1` 极光蓝、`H2` 翡翠绿、`H3` 罗兰紫、`H4` 琥珀金）。
    - 前后目录树与大纲均增加即时搜索/筛选输入框，秒级过滤定位小节与文档。

## [v0.9.1-Pure-Doc-TOC-Layout] - 2026-09-02

### Changed

- **前台文档阅读页面重构为纯净单文档 + 大纲导航架构 (图一/图二规范)**:
  - **彻底移除无关元素 (Clean Distraction-Free Layout)**:
    - 移除阅读文档页面左侧的“知识库目录”大标题、分类计数徽章、搜索输入框以及跨分类/跨文档树状列表，只专注呈现当前阅读文档的纯净内容与本篇大纲。
  - **左侧纯净大纲导航 (Image 2 Style)**:
    - 左侧边栏顶部仅保留 `<<` 极简折叠按钮；
    - 下方直接展示当前文档的蓝色大标题链接（点击平滑回滚至顶部），紧随其后呈现该文档完整的 H1~H4 小节大纲；
    - 支持小节层级缩进、呼吸活跃小节高亮指示条与点击平滑滚动跳转。
  - **100% 沉浸式阅读折叠视图 (Image 1 Style)**:
    - 点击 `<<` 折叠后，左侧大纲栏完整收起，左上角呈现极简 `≡` / `>>` 展开按钮，正文居中占满屏幕，享受无干扰阅读。
  - **正文头部微数据对齐**:
    - 大字号文章标题 + 圆形头像图标 + 作者名称 + 修改日期 + 分割线，去除多余厚重浮动卡片框。

### Verified

- `tsc -b && vite build` 生产构建 100% 零错误。
- `go test ./...` 与 `npx vitest run` 自动化全量测试 100% 全部通过。

## Unreleased

### Changed
- Added public/authenticated document access levels, viewer-aware public/search/SEO ACLs, and locked document UI.

### Added
- Public member login, invite registration, session restore, safe return paths, authenticated header state, and auth-aware restricted document and search refresh.
