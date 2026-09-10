# 功能验收矩阵

本文用于按变化范围选择验证，不记录某次运行的 PASS/FAIL。当前验证结果和可复用缓存只记录在 [CODEX_PROJECT_STATE.md](../../CODEX_PROJECT_STATE.md)。

## 使用规则

1. 从改动对应的最小行开始验证，不默认执行全表。
2. 已有自动化测试覆盖时优先扩展原测试。
3. 只有 UI、浏览器能力、真实上传/下载或部署行为发生变化时才执行相应人工验收。
4. 内容格式变更同时参考 [编辑器内容格式](../specs/EDITOR_FORMAT.md)。

## 公共端

| 能力 | 主要实现 | 自动化证据 | 需要人工验收的变化 |
| --- | --- | --- | --- |
| 路由与文档加载 | `App.tsx`、`PublicLayout.tsx` | `App.test.tsx` | 路由跳转、加载/404/网络错误视觉 |
| 首页与文章列表 | `HomePage.tsx`、`BlogPage.tsx`、`ArticleCard.tsx` | 相关 App/API 测试 | 响应式布局、筛选与分页交互 |
| 站点导航/主题 | `Header.tsx`、`Footer.tsx`、`theme.ts` | `theme.test.ts`、导航测试 | 移动菜单、主题闪烁与持久化 |
| 分类树 | `Sidebar.tsx` | `Sidebar.test.tsx` | 深层分类展开、移动端抽屉 |
| 搜索 | `SearchModal.tsx`、search repository | `SearchModal.test.tsx`、repository tests | Ctrl/Cmd+K、输入法、结果跳转 |
| 文档正文与安全 | `DocViewer.tsx`、`htmlToMarkdown.ts` | `DocViewer.security.test.tsx` | 真实 Markdown/HTML、媒体、链接和恶意输入 |
| 大纲/锚点 | `DocViewer.tsx`、`documentHeadings.ts` | `DocViewer.toc.test.tsx`、`documentHeadings.test.ts` | 长文滚动、高亮、移动目录 |
| KaTeX | `markdownMath.ts`、`DocViewer.tsx` | DocViewer 安全测试 | 首次按需加载与复杂公式 |
| SEO | `SEOHead.tsx`、`seo_handler.go` | `seo.test.ts`、`seo_handler_test.go` | 生产域名下 canonical、分享卡片、站点地图 |
| 公开 API 隔离 | public handler/service/repository | `public_handler_test.go`、repository tests | 真实数据下草稿不可见 |
| 下载/外部图片代理 | public handler、media service | handler/service/storage tests | 大文件、浏览器下载名、上游异常 |

## 管理后台

| 能力 | 主要实现 | 自动化证据 | 需要人工验收的变化 |
| --- | --- | --- | --- |
| 登录与路由守卫 | `AdminLoginPage.tsx`、`AdminAuthGuard.tsx`、auth service | `auth_service_test.go`、App/导航测试 | Token 过期、刷新和重定向 |
| 文档列表/状态 | `AdminDocumentList.tsx`、document handler/service/repository | `document_repository_test.go`、service/API tests | 筛选、分页、快速状态切换 |
| 文档属性与保存 | `AdminDocumentEditor.tsx`、payload/comparison utilities | properties/payload/comparison tests | 新建、更新、发布、降为草稿 |
| 本地草稿 | `useDocumentDraft.ts`、`AdminDocumentEditor.tsx` | hook 与 draft tests | 刷新恢复、冲突提示、存储满 |
| 文档编辑器 | `components/admin/tiptap/**`、`htmlToMarkdown.ts` | Tiptap E2–E7、adapter、compatibility、benchmark tests | 真实编辑、焦点、表格和上传 |
| 分类与标签 | manager pages、handlers/repositories | category/tag handler/repository tests | 层级循环防护、引用计数与删除 |
| 媒体与文件夹 | `AdminMediaManager.tsx`、media handler/service/storage | media service/storage tests | 拖拽上传、移动、批量操作、引用防删 |
| 设置与资料 | settings page/handler/service、auth profile | config/auth tests | 修改后即时呈现、密码变更 |

## 编辑器格式生命周期

格式或内容清洗发生变化时，按受影响能力选择以下链路：

```text
输入/粘贴
  -> 编辑器 DOM 或 ProseMirror 文档
  -> 序列化与清洗
  -> 本地草稿（如相关）
  -> API 持久化
  -> 重新加载编辑
  -> 公开阅读渲染
  -> 搜索/大纲（如结构相关）
```

重点样例：

- Markdown：标题、段落、软换行、列表、任务项、引用、链接、代码、普通表格。
- 富文本：字体、字号、颜色、高亮、对齐、行距、下划线。
- 媒体：站内/外链图片、data/blob 临时图片、视频、iframe、附件。
- 结构：Callout、富表格、空段落、重复标题与非 ASCII 锚点。
- 安全：脚本、事件属性、危险协议、CSS URL/表达式和越界样式。

## 后端与数据

| 变化范围 | 最小验证 |
| --- | --- |
| config/生产校验 | `go test ./internal/config` |
| JWT/密码 | `go test ./internal/service -run Auth`，必要时 handler |
| CORS/headers/限流 | 对应 middleware 测试 |
| SQL 查询或事务 | 对应 repository/service 测试；共享 DB 逻辑再扩大 |
| Schema/FTS/迁移 | repository 全包测试并使用临时数据库验证升级路径 |
| 文件上传/路径 | storage + media service 测试 |
| 路由/响应结构 | handler 测试，随后验证对应前端 API 类型 |

## 构建与全量验证

- 前端共享类型、路由、构建配置或跨模块依赖变化后运行 `npm run build`。
- 后端共享接口、Schema、认证或跨仓储事务变化后考虑 `go test ./...` 与 `go vet ./...`。
- 只有广泛变更、发布候选或用户明确要求时运行完整前端测试套件。
- Docker/Nginx、数据卷或生产环境变量变化时，验证 Compose 配置、健康检查和备份/恢复流程；普通业务改动不需要重复 Docker 构建。
