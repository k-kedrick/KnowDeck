# 功能验收矩阵

本文用于按变化范围选择验证策略，不记录某次运行的 PASS/FAIL（当前验证结果和可复用缓存记录在 [CODEX_PROJECT_STATE.md](../../CODEX_PROJECT_STATE.md)）。

## 使用规则

1. 从改动对应的最小测试范围开始验证，不默认执行全量测试套件。
2. 已有自动化测试覆盖时优先扩展原测试，严格维护已有用例的通过状态。
3. 标注说明：
   - `[AUTOMATED]`: 具备已实现的单元/集成自动化测试。
   - `[MANUAL]`: 需要真实浏览器或人工操作交互验证。
   - `[NOT COVERED]`: 尚未纳入常规自动化测试覆盖。
4. 内容格式变更同时参考 [编辑器内容格式](../specs/EDITOR_FORMAT.md)。

## 公共端能力矩阵

| 业务能力 | 主要实现源码 | 验证模式与证据文件 | 人工交互验收关注点 |
| :--- | :--- | :--- | :--- |
| **路由与页面加载** | `frontend/src/App.tsx`<br>`PublicLayout.tsx` | `[AUTOMATED]` `App.test.tsx` | 路由平滑跳转、加载态、404 与网络异常视觉兜底 |
| **首页与博客列表** | `HomePage.tsx`<br>`BlogPage.tsx`<br>`ArticleCard.tsx` | `[AUTOMATED]` `App.test.tsx` | 响应式断点排版、标签组合筛选与清空、置顶卡片样式 |
| **站点导航与主题** | `Header.tsx`<br>`Footer.tsx`<br>`utils/theme.ts` | `[AUTOMATED]` `theme.test.ts`<br>`UserDropdown.test.tsx` | 暗色/亮色切换无闪烁、移动端顶部菜单交互与 LocalStorage 持久化 |
| **知识库分类侧边栏** | `Sidebar.tsx`<br>`utils/categoryTree.ts` | `[AUTOMATED]` `Sidebar.test.tsx` | 深层父子分类递归展开、移动端遮罩抽屉、当前活动文档项高亮 |
| **全文检索 (FTS5)** | `SearchModal.tsx`<br>`backend/internal/repository/search_repository.go` | `[AUTOMATED]` `SearchModal.test.tsx`<br>`search_access_test.go` | Ctrl/Cmd + K 快捷键唤醒、中文输入法兼容、高亮匹配摘要、权限过滤与片段清洗 |
| **文档阅读与安全渲染** | `DocViewer.tsx`<br>`TiptapReadonlyDocument.tsx`<br>`htmlToMarkdown.ts` | `[AUTOMATED]` `DocViewer.security.test.tsx`<br>`htmlToMarkdown.test.ts` | 真实 Markdown/HTML、图片画廊灯箱、视频播放、恶意 XSS 脚本过滤拦截 |
| **大纲联动与滚动追踪** | `DocViewer.tsx`<br>`documentHeadings.ts` | `[AUTOMATED]` `DocViewer.toc.test.tsx`<br>`documentHeadings.test.ts` | 长文章平滑滚动定位、标题动态 Active 高亮、左侧 TOC 折叠/展开 |
| **阅读进度指示** | `ReadingProgressBar.tsx` | `[AUTOMATED]` `ReadingProgressBar.test.tsx` | 顶部阅读进度条随页面滚动平滑延伸 |
| **文章权限访问控制 (U3)**| `DocViewer.tsx`<br>`document_repository.go` | `[AUTOMATED]` `DocViewer.locked.test.tsx`<br>`documentPayload.access.test.ts` | 未登录访客访问 `authenticated` 文章时展示锁卡片与登录/注册引导，正文与摘要被隐藏 |
| **前台会员登录与注册 (U4)**| `LoginPage.tsx`<br>`RegisterPage.tsx`<br>`auth/AuthContext.tsx` | `[AUTOMATED]` `RegisterPage.test.tsx`<br>`AuthContext.test.tsx`<br>`returnTo.test.ts` | 8 位邀请码注册、登录态无缝恢复、安全 `returnTo` 来源回跳、退出登录清理缓存 |
| **会员自助修改密码 (U7)**| `AccountSecurityPage.tsx`<br>`service/auth_service.go` | `[AUTOMATED]` `AccountSecurityPage.test.tsx`<br>`auth_service_test.go` | 原密码校验、新密码长度拦截（>= 12 位）、成功后 Token 无缝更新且旧设备失效 |
| **SEO HTML 外壳与站点地图**| `SEOHead.tsx`<br>`backend/internal/handler/seo_handler.go` | `[AUTOMATED]` `seo.test.ts`<br>`seo_handler_test.go` | 生产域名 Canonical、OpenGraph 卡片、`/sitemap.xml` 排除非公开文章、`/robots.txt` |
| **外部图片代理与附件下载** | `public_handler.go`<br>`service/media_service.go` | `[AUTOMATED]` `public_handler_test.go`<br>`media_service_test.go` | 外部图片防盗链代理与限流、大附件断点下载名规范化 |

## 管理后台能力矩阵

| 业务能力 | 主要实现源码 | 验证模式与证据文件 | 人工交互验收关注点 |
| :--- | :--- | :--- | :--- |
| **管理员鉴权与路由守卫** | `AdminLoginPage.tsx`<br>`AdminAuthGuard.tsx`<br>`service/auth_service.go` | `[AUTOMATED]` `AdminAuthGuard.test.tsx`<br>`auth_service_test.go` | Token 过期拦截、刷新重定向、非 admin 角色越权阻断 |
| **总览看板 (U5)** | `AdminDashboardPage.tsx` | `[AUTOMATED]` `AdminDashboardPage.test.tsx` | 统计卡片指标呈现、快捷操作入口、最近编辑文章列表链接 |
| **文档列表与状态流转** | `AdminDocumentList.tsx`<br>`service/document_service.go` | `[AUTOMATED]` `document_repository_test.go`<br>`document_service_test.go` | 列表筛选、快速切换发布/草稿状态、文档删除事务回滚 |
| **文档属性与草稿保存** | `AdminDocumentEditor.tsx`<br>`useDocumentDraft.ts` | `[AUTOMATED]` `AdminDocumentEditor.draft.test.tsx`<br>`AdminDocumentEditor.properties.test.tsx`<br>`useDocumentDraft.test.ts` | 本地草稿跨刷新恢复、版本冲突提示、分类/标签表单同步保存 |
| **TipTap 核心编辑器** | `components/admin/tiptap/**`<br>`editorContentAdapter.ts` | `[AUTOMATED]` `TiptapEditor.test.tsx`<br>`TiptapE2~E7` 套件 (`TiptapE2.test.tsx` 等)<br>`editorCompatibility.test.ts` | 划词气泡工具条、富文本表格增删行列、代码块语法高亮、未改动保留原格式 |
| **分类层级树管理** | `AdminCategoryManager.tsx`<br>`category_service.go` | `[AUTOMATED]` `AdminCategoryManager.data.test.tsx`<br>`category_service_test.go` | 树状折叠展开、新建子分类、排序调整、防自引用与祖先环路循环阻断 |
| **标签管理** | `AdminTagManager.tsx`<br>`TagCombobox.tsx` | `[AUTOMATED]` `AdminTagManager.test.tsx`<br>`TagCombobox.test.tsx` | 标签创建、同名规范化、文章关联数计数与标签级联解除 |
| **媒体中心与引用体系 (U8)**| `AdminMediaManager.tsx`<br>`media/MediaWorkspace.tsx`<br>`service/media_service.go` | `[AUTOMATED]` `AdminMediaManager.test.tsx`<br>`media_service_test.go`<br>`media_repository_test.go` | 智能分类切换、逻辑文件夹操作、引用计数 > 0 阻止单删、批量删除保留引用项 |
| **媒体引用智能修复** | `POST /api/admin/media/rebuild-references` | `[AUTOMATED]` `media_service_test.go` | 幂等重新扫描全量文档并修复历史图片关联 |
| **分片大文件上传** | `uploadEditorMedia.ts`<br>`admin_media_handler.go` | `[AUTOMATED]` `TiptapE4AsyncUpload.test.tsx`<br>`media_service_test.go` | 超大视频切片上传进度条、网络中断重试、服务端合并一致性 |
| **用户体系管理 (U2)** | `AdminUsersPage.tsx`<br>`users/UsersTab.tsx`<br>`user_service.go` | `[AUTOMATED]` `AdminUsersPage.test.tsx`<br>`user_service_test.go` | 用户分页查询、启停状态切换、角色分配、重置密码、自操作与最后管理员保护 |
| **8 位邀请码管理 (U6)** | `AdminUsersPage.tsx`<br>`service/invite_service.go` | `[AUTOMATED]` `AdminUsersPage.test.tsx`<br>`invite_service_test.go` | 8 位邀请码生成与明文展示、一键复制徽章、修改备注/使用限制、查看使用者列表、批量删除/启停 |
| **站点全局设置** | `AdminSettingsPage.tsx`<br>`service/setting_service.go` | `[NOT COVERED]` 暂无专属自动化测试<br>当前依赖人工验收 | 站点名称、副标题、页脚、公开属性修改后前台即时同步与持久化校验 |

## 后端与基础设施验证分级

| 变更范围 | 最小建议自动化测试 | 升级验证路径 |
| :--- | :--- | :--- |
| **配置与环境变量** | `go test ./internal/config` | 环境变量覆盖与缺省回退验证 |
| **认证、Token 与密码策略** | `go test ./internal/service -run Auth` | `go test ./internal/handler -run Auth` |
| **中间件 (CORS/安全头/限流)**| `go test ./internal/middleware` | 模拟恶意 Origin 与高频请求 |
| **SQL 仓储与事务** | 对应模块 `repository_test.go` | 共享 DB 逻辑全仓储测试并验证 WAL 并发 |
| **Schema、迁移与 FTS5** | `go test ./internal/repository` | 临时 SQLite 数据库迁移验证 |
| **媒体存储与分片逻辑** | `go test ./internal/storage` + `media_service_test.go` | 物理文件写入与临时切片清理验证 |
| **Docker Compose 与部署拓扑** | `docker compose --env-file .env.example config --quiet` | 容器健康检查与数据卷读写权限验证 |

## 全量构建与集成指令

在发布新版本或涉及全站基础依赖升级时执行：

```powershell
# 1. 后端全量测试与静态分析
cd backend
go test ./...
go vet ./...

# 2. 前端代码质量与全量测试
cd ../frontend
npm.cmd run lint
npm.cmd test
npm.cmd run build

# 3. Docker 编排语法静态校验
cd ..
docker compose --env-file .env.example config --quiet
```
