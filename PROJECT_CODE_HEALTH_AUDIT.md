# PROJECT CODE HEALTH AUDIT

审计日期：2026-09-17（Asia/Shanghai）  
审计模式：只读审计；未修改应用源码、数据库、部署或依赖。本文档是本轮唯一新增工件。

---

## 1. Executive Summary

项目整体健康，分层和运行入口清楚：React SPA 通过统一 API client 访问 Gin，Gin 的大部分写路径经 Handler → Service → Repository → SQLite；媒体和富文本是复杂度的主要集中区。新鲜验证全部通过（前端 250 通过/1 跳过、后端测试与 vet 通过、构建通过、Compose 配置通过）。

没有发现大量已退出运行的功能或可批量删除的遗留代码。唯一满足 **SAFE** 标准的生产删除候选是未被任何生产、测试、路由、动态导入、配置或文档运行契约使用的 `VideoLightbox`。其余看似复杂的内容兼容、草稿迁移、SEO 旧 URL、数据库迁移均有明确历史或运行依赖，不能机械删除。

存在可辨识的“补丁叠加”痕迹，但集中在合理的高风险边界：富文本兼容/净化、编辑器响应式外壳、历史本地草稿迁移。风险不是代码失控，而是后续在这些位置继续直接叠加行为会使回归面扩大。最不应动的是 HTML 内容格式链、SQLite 自动迁移与媒体引用重建；它们承载历史数据兼容和安全边界。

主要技术债：12 个 React `set-state-in-effect` lint 警告、4 个超大管理页、`index.css` 中编辑器响应式覆盖栈，以及前端站点信息/目录 localStorage 缓存没有版本或 TTL。它们都不是本轮应自动修复的问题。

---

## 2. Audit Scope

### Reviewed

- `frontend/src`：路由、惰性加载、API client、认证、页面/组件、草稿/缓存、Tiptap 扩展与 `index.css`。
- `backend/cmd/server/main.go`：全部路由和对象装配入口。
- `backend/internal/{handler,service,repository,middleware,storage,model,config}`：层次、构造路径、迁移、直接依赖与主要兼容路径。
- `docker-compose.yml`、`deploy/nginx/default.conf`、`frontend/package.json`、`backend/go.mod`。
- 静态引用、路由、惰性导入、测试和已知兼容字符串检索。

### Runtime / static verification

| 检查 | 结果 |
| --- | --- |
| `frontend: npm.cmd test` | PASS：46 passed、1 skipped；250 passed、1 skipped |
| `frontend: npm.cmd run lint` | PASS：0 error、12 warnings |
| `frontend: npm.cmd run build` | PASS：`tsc -b && vite build` |
| `backend: go test ./...` | PASS |
| `backend: go vet ./...` | PASS |
| `docker compose --env-file .env.example config --quiet` | PASS |

### Partially reviewed / Not Verified

- 未运行浏览器 E2E、真实 Docker 启动、迁移真实生产库、备份恢复与 race detector。
- 未检查外部未纳入仓库的 API 消费者；因此 API、数据库和兼容层一律不作为安全删除候选。

---

## 3. Current Architecture

```text
Frontend
├─ main.tsx → App.tsx（BrowserRouter；/wang 页面 lazy）
├─ Pages / Components（页面拥有短生命周期 UI state）
├─ AuthContext（kb_token + /api/auth/me 的当前用户）
├─ api/index.ts（请求、DTO、上传协议的唯一 HTTP client）
├─ utils / hooks（内容、草稿、主题、SEO、分类树）
└─ index.css + Tailwind（全局 token、编辑器响应式结构规则）

Backend
├─ cmd/server/main.go（DI、Gin 路由、限流、服务装配）
├─ middleware（认证、CORS、限流、安全头）
├─ handler（HTTP 绑定、响应、路由入口）
├─ service（认证、文档、媒体、分类、邀请、设置规则）
├─ repository（SQLite SQL / 事务）
├─ storage（本地文件存储接口与实现）
└─ model（实体、DTO）

Deployment
├─ docker-compose.yml（前端公开；后端内部网络）
└─ deploy/nginx/default.conf（SPA、SEO shell、API、上传文件）
```

实际依赖方向总体正确。例外是部分较早 Handler 直接使用 Repository（如标签、用户），而文档/媒体/分类使用 Service；这是一致性债，不是死代码证据。

---

## 4. Code Status Overview

| 状态 | 结论 |
| --- | --- |
| ACTIVE | 路由、API client、所有 Repository、Storage、Tiptap 主链均有入口。 |
| ACTIVE BUT DEBT | 管理页、富文本转换、编辑器 CSS、localStorage 缓存。 |
| DUPLICATE | 没有确认可合并的生产重复实现；工具函数和编辑器上传三处外观相似但生命周期不同。 |
| SUPERSEDED | 未确认生产实现。 |
| COMPATIBILITY | 旧 `?doc=` URL、历史草稿 key、旧数据库列迁移、TipTap/HTML 格式处理。 |
| DEAD | `VideoLightbox`（AUD-001）。 |
| UNKNOWN | 外部 API 消费者、已有数据库与历史富文本样本。 |

---

## 5. Dead Code Candidates

| ID | 文件 | 符号 | 类型 | 当前状态 | 无用证据 | 删除可信度 | 风险 |
| -- | -- | -- | -- | -- | -- | -- | -- |
| AUD-001 | `frontend/src/components/ImageLightbox.tsx:182-216` | `VideoLightbox` / `VideoLightboxProps` | React component | DEAD | 全仓 `rg` 仅命中定义；Imports 0；JSX callers 0；routes/lazy imports 0；tests 0；配置/动态字符串 0；同文件 `ImageLightbox` 仍有真实调用，不受影响。 | **SAFE** | P3 |

`normalizeDocumentLinks()` 和 `htmlToMarkdown()` **不是** DEAD：前者有单元测试消费者，后者被编辑器适配器和兼容测试使用。`findFirstDocSlug()` 是递归内部调用但无外部入口，属于未导出的能力不应保留的候选；然而它所在文件的公开 context 类型和未来路由行为边界相邻，缺少单独测试/变更收益，标记 **LIKELY SAFE / NO ACTION**，不进入安全清理。

---

## 6. Duplicate / Superseded Logic

### AUD-002 — 上传锚点逻辑：KEEP

- Implementation A：`TiptapEditor.tsx` 的粘贴/拖放上传。
- Implementation B：`TiptapToolbar.tsx` 的文件选择上传。
- 重叠：都用 `UploadAnchorPlugin` 定位异步完成后的插入位置。
- 差异：事件来源、错误恢复、临时 input、上传进度和用户交互生命周期不同。
- Current callers：编辑器事件与工具栏按钮均真实运行。
- 结论：**KEEP**。抽象为单个“大上传流程”会把不同 UI 生命周期耦合，属于禁止机械 DRY 的情形。

### AUD-003 — HTML 内容处理：KEEP，边界需保持清晰

- `htmlToMarkdown.ts`：粘贴输入规范化、白名单净化、旧 Markdown/HTML 转换。
- `editorContentAdapter.ts`：编辑会话格式判别、初始内容和保存序列化。
- `documentHtml.ts` / `documentLinks.ts`：只读 DOM 后处理、图片行为与链接行为。
- 调用链分处输入、编辑会话、只读渲染三个安全/生命周期边界；不是重复实现。
- 结论：**KEEP / DO NOT REMOVE**。函数名可改进，但合并会混淆“持久化格式转换”和“已净化 DOM 行为”。

---

## 7. Patch-on-Patch Problems

### AUD-004 — 编辑器布局 CSS PATCH STACK（P2）

```text
基础 admin shell
↓
editor-route shell / workspace grid
↓
1280、1440、1600 宽度区间覆盖
↓
<=1599 overlay、<=1439 drawer、<=1279 property overlay
↓
!important 强制隐藏/显示 nav toggle
```

- Files：`frontend/src/index.css:183-714`，核心规则约 `219-477`。
- Why：编辑器需要独立滚动容器，同时在宽桌面、窄桌面和移动端切换树/目录/属性面板。
- Root cause location：布局状态由 `AdminDocumentEditor` 和 `AdminLayout` 分散持有，CSS 根据 data attributes 做响应式补偿。
- Current risk：P2；阈值重叠会使未来新增面板难以预测，`!important` 降低了局部组件样式的可组合性。
- Recommended future direction：仅在视觉回归测试覆盖后，定义单一 viewport/layout 状态表，按该表收敛选择器；不要逐条删除现有 media query。

### AUD-005 — 新建草稿 key 迁移（P2，COMPATIBILITY）

```text
历史 kb_draft_doc_new
↓
带 localDraftId 的 kb_draft_doc_new:<id>
↓
写入新 key 成功后再删除旧 key
↓
列表通过 kb:drafts-changed 刷新
```

- Files：`frontend/src/hooks/useDocumentDraft.ts:42-217`，`AdminDocumentEditor.tsx:90-160`，`AdminDocumentList.tsx:21,64-67`。
- Why：避免升级时遗失未保存的新文档。
- 真实调用和迁移失败保留旧记录的测试均存在。
- 结论：**DO NOT REMOVE**。未来折叠前提是设定历史版本支持截止时间、验证活跃客户端完成迁移，并保留备份/回滚策略。

---

## 8. Frontend State Problems

### Source of truth map

| 数据 | Source of Truth | Derived / Cache | Temporary UI state | 结论 |
| --- | --- | --- | --- | --- |
| 当前用户 | 后端 `/api/auth/me` | `kb_token` 仅会话凭据 | `loading` | 正确；`AuthContext` 用 AbortController 和 token 比对阻止旧请求覆盖。 |
| 站点信息、目录 | 后端 public API | `cached_site_info`、`cached_site_tree` | `PublicLayout` state | AUD-006：缓存无 TTL/版本，可能短暂显示已过时菜单。P2。 |
| 文档详情 | `getDocumentBySlug` | 无 | `loading/error/docDetail` | 正确；序列号 + AbortController 抵御路由/登录竞态。 |
| 编辑草稿 | localStorage（离线草稿）和已保存文档（服务端） | `useDocumentDraft` 比较函数 | 编辑器表单 state | 合理双来源，但格式变更必须保留迁移测试。 |
| 标签、分类、媒体等 admin 列表 | 相应管理 API | 页面内列表 | modal/form/filter/loading | 无第二持久化来源。 |

### AUD-006 — 公共站点缓存无失效协议（P2）

- Files：`frontend/src/components/PublicLayout.tsx:12-66`。
- 证据：初始渲染直接使用 `cached_site_info` / `cached_site_tree`；网络成功后覆盖，失败时旧值可持续展示；没有 schema version、时间戳、TTL 或 admin 保存后的跨标签通知。
- 当前行为：后端不可达或请求失败时，用户可能看到已过期的站点设置/目录。
- 建议根因方向：将缓存显式定义为“启动占位缓存”，增加版本/短 TTL，或完全以请求结果为准。**不建议本轮修复**。

### Effect debt

lint 的 12 项均为同步 `setState` in effect：`SearchModal`、`AdminTagManager`、`AdminSettingsPage`、`AdminCategoryManager`、`AdminDocumentList`（2）、`AdminMediaManager`（2）、`AdminDocumentEditor`（2）、`MediaDetailModal`。这些是明确可追踪的 P3 debt，不等同于功能缺陷；审计未发现未取消请求导致旧响应覆盖新状态的证据。应按页面变更时逐个处理，而不是为清零警告批量重构。

---

## 9. Backend Architecture Problems

### AUD-007 — Service 边界不一致（P2）

- 文件：`backend/cmd/server/main.go`（装配）；`admin_tag_handler.go`、`admin_user_handler.go` 对 Repository 的直接依赖；文档/媒体/分类 Handler 则走 Service。
- 证据：所有 Handler 均有 main 路由入口；不是无入口代码。`AdminUserHandler` 还在构造器内创建 `AdminUserService`，而不是由 composition root 注入。
- 影响：业务规则增加时容易在 Handler/Service 两处扩散；目前没有已知行为分叉。
- 结论：**MERGE/REFACTOR CANDIDATE，UNCERTAIN，非本轮改动**。后续仅在新增用户/标签业务规则时统一构造方式。

### AUD-008 — 设置 Service 的透传方法（P3，NO ACTION）

- 文件：`backend/internal/service/setting_service.go:55-61`。
- `GetAllSettings` / `SaveSettings` 目前是 Repository 的薄透传，但同类服务还包含公共站点聚合、默认值和布尔解析。
- 结论：**KEEP**。删除会使 Handler 直接绕开已存在的设置业务边界，收益不足以覆盖一致性风险。

### 数据库

`repository/db.go` 的列补齐、FTS 和历史默认值迁移属于生产数据契约。`access_level`、`media.source`、invite 明文 code/remark、`users.invite_code_id` 均有 schema 和服务/API 使用；没有任何表/列可标记 SAFE。所有疑似历史列均为 **NEEDS REVIEW / DO NOT REMOVE**，因为真实库、备份、旧容器和外部 API 未验证。

---

## 10. Dependency Audit

### npm — KEEP

- React、React DOM、React Router：应用入口、路由、Context。
- DOMPurify：富文本输入/搜索 snippet 安全边界。
- `@tiptap/*` 和 `@tiptap/pm`：编辑器、只读渲染、自定义 extension。
- `lucide-react`：页面和通用组件的图标 imports。
- Vite、TypeScript、Vitest、Testing Library、jsdom、Oxlint、Tailwind/PostCSS：均对应当前脚本或配置。

### npm — REVIEW / REMOVE CANDIDATE

无。审计未见安装后无源代码消费者的直接 npm 依赖；不升级、不重新分类依赖。

### Go — KEEP

- Gin：路由/绑定；JWT：认证；UUID：媒体/业务标识；`x/crypto`：密码与安全随机相关；modernc SQLite：唯一 DB driver。
- 所有 indirect 模块均由 Gin 或 pure-Go SQLite 等直接依赖链引入。无手工清理 `go.mod` 的证据。

---

## 11. CSS / UI Technical Debt

- **CSS PATCH STACK：AUD-004**。编辑器响应式外壳是唯一明确的层叠补偿区域。
- `!important` 共用于：编辑器 nav toggle 显隐、reduced-motion、文章内 heading/image 修正；后两类是可访问性和内容渲染约束，不应与布局补丁混为一谈。
- 未发现可证明无消费者的全局 selector；Tailwind class 和富文本生成 class 可能动态存在，不能用静态 grep 删除。

---

## 12. Functional Issues

本轮未确认需要单独升级为功能缺陷的项目。测试运行中的 jsdom 提示 `Not implemented: navigation to another Document` 未导致测试失败，且不是生产浏览器行为证据，记录为 **NOT VERIFIED**，不作为 Bug。

---

## 13. Safe Cleanup Candidates

仅包含可安全处理项：

1. **AUD-001**：删除 `VideoLightbox` 与其私有 `VideoLightboxProps`。需运行 `npm.cmd test`、`npm.cmd run lint`、`npm.cmd run build`。不改 API、CSS、数据库或 UI 行为。

---

## 14. Needs Manual Decision

- AUD-004：是否投资编辑器布局状态/响应式 CSS 收敛。
- AUD-005：旧草稿 key 的保留窗口和弃用条件。
- AUD-006：站点数据缓存应采用 TTL、版本化还是移除。
- AUD-007：是否统一所有管理 Handler 的 Service 注入边界。
- 数据库历史列、API 字段、SEO `?doc=` 旧链接、富文本兼容扩展：外部和历史依赖未知，均不得删除。

---

## 15. NO ACTION

- `Storage` 接口仅有本地实现，但它隔离文件操作并被媒体服务依赖；不为“单实现接口”删除。
- `SettingService` 薄透传方法：仍维持设置领域边界。
- 编辑器三处上传流程：交互生命周期不同。
- `htmlToMarkdown` 及历史文档转换：测试和数据格式契约明确，不能按文件长度拆分。
- 大文件：`AdminUsersPage`、`AdminDocumentEditor`、`AdminMediaManager`、`htmlToMarkdown`、`api/index.ts` 均超过 600 行（最大 1504 行）；职责复杂但有真实入口，不能仅按行数拆分。

---

## 16. Recommended Cleanup Plan

### Phase 1 — SAFE CLEANUP
- 目标：只处理 AUD-001。
- 允许：删除未使用 component/type；补充或保持现有构建测试。
- 不允许：改视频 UI 或媒体 API。
- 风险：低；要求前端 test/lint/build。

### Phase 2 — DUPLICATE LOGIC
- 目标：无已批准候选；仅在新证据显示两个上传入口业务规则漂移时进入。
- 不允许：为减少代码创造通用上传状态机。
- 风险：中；需编辑器粘贴、拖放、工具栏上传回归。

### Phase 3 — PATCH COLLAPSE
- 目标：AUD-004 编辑器布局选择器按状态表收敛，AUD-006 明确缓存契约。
- 不允许：顺带视觉重构、改变断点行为。
- 风险：高；需要多 viewport 浏览器回归。

### Phase 4 — STRUCTURAL REFACTOR
- 目标：仅在相关功能迭代时处理 AUD-007，统一 Handler/Service 装配与责任。
- 不允许：批量移动所有 Repository 代码。
- 风险：中；需要后端全测、管理 API 合同测试。

### Phase 5 — OPTIONAL FUNCTION FIXES
- 当前没有已确认功能缺陷；若缓存陈旧被产品确认为缺陷，再按 AUD-006 实施。

---

# EVIDENCE INDEX

## AUD-001
- Category：SAFE DELETE；Risk：P3。
- Files/Symbols：`ImageLightbox.tsx`，`VideoLightbox`、`VideoLightboxProps`。
- Definition：存在；Imports/Callers/Routes/Dynamic usage/Tests：均为 0。
- Config/Database/Compatibility：均未发现依赖。
- Conclusion：DEAD；Confidence：**SAFE**；Action：Phase 1。

## AUD-004
- Category：CSS PATCH STACK；Risk：P2。
- Files：`index.css:219-477`（并受 `:183-216` admin shell 规则影响）。
- Callers：`AdminDocumentEditor`、`AdminLayout` 输出相应 classes/data attributes。
- Runtime：构建通过；多 viewport 浏览器行为未本轮复验。
- Conclusion：ACTIVE BUT DEBT；Confidence：**DO NOT REMOVE**；Action：Phase 3。

## AUD-005
- Category：COMPATIBILITY / PATCH STACK；Risk：P2。
- Files：`useDocumentDraft.ts`、`AdminDocumentEditor.tsx`、`AdminDocumentList.tsx`。
- Tests：草稿迁移和失败保留测试通过。
- Database/Config：无；Compatibility：旧 localStorage key 明确存在。
- Conclusion：ACTIVE COMPATIBILITY；Confidence：**DO NOT REMOVE**；Action：人工确定弃用前提后再审计。

## AUD-006
- Category：STATE / CACHE；Risk：P2。
- Files：`PublicLayout.tsx:12-66`。
- Source：public API；Cache：localStorage；Temporary state：React state。
- Runtime：请求成功时覆盖；离线/失败缓存陈旧行为未 E2E 验证。
- Conclusion：ACTIVE BUT DEBT；Confidence：**UNCERTAIN**；Action：产品决定缓存语义。

## AUD-007
- Category：ARCHITECTURE CONSISTENCY；Risk：P2。
- Files：`main.go`、管理 Handler、`AdminUserService`。
- Routes：全部目标 Handler 有 main 路由；非 dead code。
- Compatibility/Database：受管理 API 合同和 Repository SQL 影响。
- Conclusion：REFACTOR CANDIDATE；Confidence：**UNCERTAIN**；Action：随业务变更处理。

## AUD-008
- Category：Thin service；Risk：P3。
- Files：`setting_service.go:55-61`。
- Callers：设置 Handler；同 Service 还聚合公共站点信息。
- Conclusion：KEEP / NO ACTION；Confidence：**DO NOT REMOVE**。

---

## Required Answers

1. **整体健康吗？** 是；架构清晰，复杂度集中且受测试覆盖。
2. **有明显 AI 覆盖式修复吗？** 有局部补丁痕迹（编辑器布局、草稿迁移、富文本兼容），不是全局失控。
3. **有被新功能替代未删除的吗？** 未确认生产替代实现。
4. **有无调用代码吗？** 有：AUD-001 `VideoLightbox`。
5. **有重复 API/function/component 吗？** 有相似上传流程，但都应 KEEP；无确认应合并的生产重复。
6. **有重复状态来源吗？** 站点信息/目录存在 API + localStorage cache；草稿双来源是有意设计。
7. **有不必要依赖吗？** 未发现。
8. **有 CSS 层层覆盖吗？** 有：AUD-004 编辑器响应式布局。
9. **哪些能 100% 安全清理？** 仅 AUD-001。
10. **哪些暂时绝对不该动？** 富文本格式链、草稿迁移、SQLite 自动迁移、媒体引用重建、SEO 兼容 URL。
11. **哪些是真实功能缺陷？** 本轮未确认。
12. **最安全清理顺序？** AUD-001 → 逐页解决 lint 警告 → 经决策后处理缓存/布局 → 随功能迭代统一后端边界。
