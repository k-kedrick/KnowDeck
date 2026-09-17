# PROJECT CODE HEALTH AUDIT

最终收尾日期：2026-09-17（Asia/Shanghai）
审计状态：FINAL CLOSURE。本文档记录当前代码与已完成专项审计的最终结论。

---

## 1. Executive Summary

项目整体代码健康。当前架构边界清楚：React SPA 经统一 API client 调用 Gin；后端复杂写路径主要遵循 Handler → Service → Repository → SQLite；媒体、富文本和历史兼容逻辑仍是必要的复杂度集中区。

本轮治理实际完成两项生产代码变更：

- **AUD-001 RESOLVED**：删除已验证无消费者的 `VideoLightbox` 与 `VideoLightboxProps`。
- **AUD-006 RESOLVED**：删除无明确产品契约的 public site localStorage cache，实现收敛为 `Backend Public API → React State → Public UI`。

专项审计确认：

- 编辑器 CSS 复杂但受控；无 SAFE dead CSS、无确认 breakpoint 冲突，源码层滚动模型健康；当前不建议重构。
- 历史草稿 key 迁移仍承担真实兼容职责，必须保留。
- 后端分层总体健康；不应为形式统一强制给所有 Handler 增加 thin service。
- `SettingService` 的薄方法维持 settings domain boundary，保留。

```text
CURRENT SAFE CLEANUP CANDIDATES:
NONE

FUNCTIONAL ISSUES:
NONE CONFIRMED
```

没有确认的 P0/P1 代码健康问题。剩余项目为 P2/P3 的未来维护观察项，不构成本轮重构任务。

---

## 2. Final Status Overview

| Audit | Status | Decision |
| --- | --- | --- |
| AUD-001 | RESOLVED | Dead code removed |
| AUD-004 | CLOSED / NO ACTION | KEEP AS-IS |
| AUD-005 | ACTIVE COMPATIBILITY | KEEP |
| AUD-006 | RESOLVED | Public cache removed |
| AUD-007 | CLOSED / NO ACTION | No backend refactor |
| AUD-008 | ACTIVE | KEEP |

---

## 3. Current Architecture

```text
Frontend
├─ main.tsx → App.tsx（BrowserRouter；/wang 页面 lazy）
├─ Pages / Components（页面拥有短生命周期 UI state）
├─ AuthContext（kb_token + /api/auth/me 当前用户）
├─ api/index.ts（唯一 HTTP client）
├─ utils / hooks（内容、草稿、主题、SEO、分类树）
└─ index.css + Tailwind（全局 token、编辑器响应式结构）

Backend
├─ cmd/server/main.go（对象装配、路由、限流）
├─ middleware（认证、CORS、限流、安全头）
├─ handler（HTTP binding、auth context、response）
├─ service（认证、文档、媒体、分类、邀请、设置规则）
├─ repository（SQLite SQL / transaction）
├─ storage（文件存储接口与实现）
└─ model（实体、DTO）
```

---

## 4. Work Completed

### AUD-001 — VideoLightbox Dead Code

```text
Status: RESOLVED
Commit: af3a7e8 chore: remove verified dead VideoLightbox code
```

已删除：

```text
frontend/src/components/ImageLightbox.tsx
- VideoLightboxProps
- VideoLightbox
```

删除前确认 Imports、callers、JSX、routes、lazy imports、tests、dynamic usage、configuration dependency 均为 0。`ImageLightbox` 真实运行路径保持不变。

### AUD-004 — Editor CSS Patch Stack

```text
Status: CLOSED / NO ACTION
```

最终结论：

```text
Editor CSS: complex but controlled
Safe dead CSS: NONE
Breakpoint conflict: NONE CONFIRMED
Scroll model: HEALTHY AT SOURCE LEVEL
Structural refactor: NOT RECOMMENDED NOW
```

保留未来 P2 observation：Tree / TOC 的 persistent preference state 与 effective visible overlay state 语义可能不一致。

```text
FUTURE IMPROVEMENT
NOT CURRENT ACTION
```

只有未来修改编辑器响应式布局，或确认已造成真实 UI 问题时，才重新打开 AUD-004。

### AUD-005 — Legacy Draft Key Migration

```text
Status: ACTIVE COMPATIBILITY
Decision: KEEP / NO ACTION
```

历史草稿 key 迁移仍保护升级中的未保存新文档。写入新 key 成功后才删除旧 key，迁移失败时保留旧记录。当前不具备删除兼容路径的证据。

### AUD-006 — Public Site localStorage Cache

```text
Status: RESOLVED
Commit: f95f06a refactor: remove stale public site cache
```

已删除：

```text
cached_site_info
cached_site_tree
getCachedSiteInfo
getCachedTree
AdminSettingsPage 对 cached_site_info 的 stale invalidation
```

最终数据路径：

```text
Backend Public API
↓
React State
↓
Public UI
```

`cached_site_tags` 不属于 AUD-006，保持未改。

### AUD-007 — Backend Handler / Service Boundary

```text
Status: CLOSED / NO ACTION
```

最终结论：

```text
Backend layering: HEALTHY
Duplicated business logic: NONE CONFIRMED
Transaction boundary: HEALTHY
Structural backend refactor: NOT RECOMMENDED
Forced Service layer: NOT RECOMMENDED
```

Future observations only：

- **AUD-007-02**：`AdminTagHandler` 含少量 Tag 领域规则；仅当 Tag domain 增长时再考虑 Service extraction。
- **AUD-007-04**：`AdminTagHandler` Create / Update 对 Repository error 的 HTTP 粒度不完全一致。

两项均无确认功能问题，当前不实施。

### AUD-008 — SettingService Thin Methods

```text
Status: ACTIVE
Decision: KEEP / NO ACTION
```

`GetAllSettings` / `SaveSettings` 是薄透传，但 `SettingService` 仍承担 public site info 聚合、默认值和布尔设置解析。删除薄方法会破坏现有 settings domain boundary，收益不足。

---

## 5. Actual Source Changes

本轮治理中实际发生的生产代码变更仅有：

| Commit | Production change |
| --- | --- |
| `af3a7e8` | 删除 `VideoLightbox` 与 `VideoLightboxProps` |
| `f95f06a` | 删除 public site info/tree 的 localStorage cache 实现与 settings stale invalidation |

AUD-004、AUD-005、AUD-007、AUD-008 仅进行了专项审计或决策，没有应用源码改动。

---

## 6. Remaining Technical Debt

| Priority | Item | Status |
| --- | --- | --- |
| P2 | Tree / TOC persisted preference 与窄屏 effective overlay presentation 的状态语义 | FUTURE IMPROVEMENT；仅在确认真实 UI 问题或修改响应式布局时处理 |
| P2 | `AdminTagHandler` 的小型领域规则与 Create / Update 错误映射粒度 | OBSERVATION ONLY；不创建 TagService、不调整 HTTP status |
| P3 | 12 个既有 React lint warnings | 保留；按未来受影响页面逐项处理，不批量重构 |
| P3 | `AdminUserService` 在 Handler constructor 内局部创建 | DI consistency observation；无确认 testability 或 runtime 问题 |
| P3 | 历史草稿 key migration | 有效兼容契约；保留直到具备明确弃用条件 |

以下内容不是当前技术债清理候选：富文本格式链、SQLite 自动迁移、媒体引用重建、SEO 兼容 URL、Storage 接口、现有 Service 边界。

---

## 7. Functional Issues

```text
NONE CONFIRMED
```

lint warnings、架构形式不统一、未来 stale-state 风险、未来 error-mapping 风险均不自动等同于功能缺陷。

---

## 8. Safe Cleanup Candidates

```text
CURRENT SAFE CLEANUP CANDIDATES:
NONE
```

---

## 9. Verification

| Check | Final result |
| --- | --- |
| `frontend: npm.cmd test` | PASS：48 passed、1 skipped；254 passed、1 skipped |
| `frontend: npm.cmd run lint` | PASS：0 errors、12 existing warnings |
| `frontend: npm.cmd run build` | PASS：`tsc -b && vite build` |
| `backend: go test ./...` | PASS |
| `backend: go vet ./...` | PASS |
| `docker compose --env-file .env.example config --quiet` | PASS |
| `git diff --check` | PASS |

```text
RUNTIME / BROWSER E2E:
NOT VERIFIED IN FINAL CLOSURE
```

---

## 10. Evidence Index

| ID | Current evidence | Final conclusion |
| --- | --- | --- |
| AUD-001 | No consumers before removal; production deletion verified | RESOLVED |
| AUD-004 | Selector → DOM mapping、state model、breakpoint matrix、source scroll chain | CLOSED / NO ACTION |
| AUD-005 | Migration path and tests preserve legacy local drafts | ACTIVE COMPATIBILITY / KEEP |
| AUD-006 | Current source has no production site info/tree localStorage cache path | RESOLVED |
| AUD-007 | Handler dependency matrix、Service classification、transaction review | CLOSED / NO ACTION |
| AUD-008 | SettingService has real aggregate behavior beyond thin methods | KEEP / NO ACTION |

---

## 11. Final Recommendation

```text
Stop this code-health governance cycle.
Resume normal feature development.
```

没有新的 P0/P1 问题，也没有 SAFE cleanup 候选。后续只在相关功能发生变化时，按受影响边界重新审计相应 P2/P3 observation；不要为维持治理流程而制造重构任务。
