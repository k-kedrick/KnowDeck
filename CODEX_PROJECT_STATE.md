# Codex Project State

> Baseline established: 2026-09-07 (Asia/Shanghai). Source and configuration are authoritative. Refresh only affected entries when their relevant inputs change.

## Project

- Lightweight personal blog and read-only knowledge base with an authenticated administration SPA.
- Backend: Go 1.26.4, Gin, pure-Go SQLite (`modernc.org/sqlite`), local media storage.
- Frontend: React 19, TypeScript 6, Vite 8, Tailwind CSS; Markdown/HTML rendering with DOMPurify and TipTap readonly sanitization/rendering pipeline.
- Deployment: root `docker-compose.yml` defines two Docker services. Frontend Nginx publishes `${APP_PORT:-8080}` on all host interfaces by default; backend is internal on `8090`; named volumes hold SQLite, generated JWT Secret, and uploads. Local development uses frontend `3788` and backend `3799`.
- Local Git is initialized on branch `main`; initial project baseline: `1a48894`.
- Repository-wide Codex behavior is defined by `AGENTS.md`.
- `.agents/skills/project-owner/SKILL.md` is the default repository maintenance workflow.

## Version Control

- Git repository: initialized.
- Branch: `main`.
- Initial Project Baseline: `1a48894`.
- Purpose: incremental change tracking and verification-cache invalidation.

## Architecture Map

- Backend entry: `backend/cmd/server/main.go`.
- Backend flow: Gin route/handler -> service -> repository -> SQLite; media operations additionally use `internal/storage`.
- Public surface: SEO HTML shells plus read-only `/api/public/*` endpoints. Mutations live under JWT-protected `/api/admin/*` routes.
- Persistence: users, categories, tags, documents, document-tags, media, media-document-refs, media-folders, invite-codes, settings, plus an FTS5 document index and synchronization triggers. SQLite uses WAL and one open connection.
- Category hierarchy writes reject missing, self, descendant, and cyclic parent relationships; tree responses normalize legacy orphan/cycle links so persisted categories cannot disappear from navigation.
- Frontend entry/routes: `frontend/src/main.tsx` -> `frontend/src/App.tsx`; public routes are `/`, `/login`, `/register`, `/account/security`, `/blog`, `/docs/:slug`; admin routes are lazy-loaded under `/wang` (with `/wang/dashboard` overview landing); backend management APIs remain under `/api/admin/*`.
- User/auth: `users` supports admin/member roles, active/disabled status and auth-version invalidation. Public `/api/auth/register` requires an atomically consumed invite, `/api/auth/login` shares the existing JWT system, authenticated `/api/auth/me` returns the database-current safe user, and `/api/auth/password` allows member self-service password changes.
- Invites: 8-character alphanumeric codes are generated with `crypto/rand`, stored as plaintext `code` for administrative review/copying and `code_hash` for verification, and conditionally consumed with a SQLite update in the member-creation transaction.
- User System: **COMPLETED** through U2. Admin user management and admin invite management are **COMPLETED**; `/wang/users` provides Users and Invites tabs backed by `/api/admin/users*` and `/api/admin/invites*`.
- Document Access Control: **COMPLETED** (U3). Backend enforces `access_level` on `/api/public/documents/:slug` (returning `locked: true` without body) and `/api/public/documents` (clearing `excerpt` for unauthenticated visitors). Frontend `ArticleCard` and `DocViewer` display dedicated locked badges and login/registration prompt cards.
- Editor & Reader: `AdminDocumentEditor` uses `TiptapEditor` exclusively; public `DocViewer` uses `TiptapReadonlyDocument` directly with DOMPurify, eliminating reader/editor divergence.
- Critical paths: database/schema (`backend/internal/repository/db.go`), auth (`backend/internal/middleware/auth.go`, `backend/internal/service/auth_service.go`), file storage/media, document persistence, and the `DocViewer` sanitization/rendering pipeline.

## Current Fingerprints

Aggregate SHA-256 over sorted relevant inputs. The maintained-documentation fingerprint excludes this state file to avoid a circular hash.

| Scope | Fingerprint |
| --- | --- |
| Backend Go source + modules | `43712f82001019184213bbe8774e8da6355229e2fa46403046a183e091a27253` |
| Frontend source/config | `8d08d63cfbcfcf4c75f3cc6b62db1817d2e2317d79d154977843ee7ad1466f1c` |
| Deployment config | `2a9ecd684abf2ab2f33683fe1d7813ff8d32c9d5bfbcb206183557fb99073770` |
| Maintained Markdown except this state file | `2de00f471a8063f95fe62291fd133fa345f6f6b2732daa84c9fcc7449739c464` |

The backend, frontend, and deployment fingerprints above remain valid only while their recorded input scopes remain unchanged.

Fingerprints were recomputed on 2026-09-11 from sorted tracked scope paths plus raw contents, with NUL separators between path/content records; the Markdown scope excludes this state file.

## Documentation Map

- `AGENTS.md`: repository-wide Codex instructions and mandatory entry into the default project maintenance workflow.
- `.agents/skills/project-owner/SKILL.md`: incremental project ownership, root-cause repair, change discipline, verification reuse, and long-term maintenance workflow.
- `README.md`: project entry, capabilities, setup, deployment entry and document navigation.
- `ARCHITECTURE.md`: stable boundaries, modules, data flow and architecture constraints.
- `SECURITY.md`: security model and production security requirements.
- `CHANGELOG.md`: durable release history.
- `docs/specs/EDITOR_FORMAT.md`: editor/storage/reader content contract.
- `docs/testing/FEATURE_TEST_MATRIX.md`: change-to-verification selection map; verification results remain in this state file.
- `docs/operations/BACKUP.md`: production data migration, backup and restore.

Ordinary Codex work starts from `AGENTS.md`, then uses the `project-owner` skill, this state file, and affected source/tests. Other documentation is loaded only when relevant to the current task.

## Verification Cache

### backend-tests

- Full-suite command: `go test ./...`
- Result: **PASS** on 2026-09-10 after production-placeholder validation was added.
- Valid for the backend fingerprint above.
- Invalidate when relevant backend Go source, modules, shared schema behavior, or affected callers change.

### backend-vet

- Command: `go vet ./...`
- Result: **PASS** on 2026-09-10 after production-placeholder validation was added.
- Invalidate when relevant backend Go source or modules change.

#### frontend-build

- Command: `npm.cmd run build`
- Result: **PASS** on 2026-09-11 (`tsc -b && vite build`, 1.51s, 0 errors).
- Note: Vite bundle outputs `dist/assets/extensions-*.js` (458.97 kB) and `TiptapEditor-*.js` (86.28 kB), all within advisory thresholds.
- Valid for the frontend fingerprint above.
- Invalidate when relevant frontend source, build configuration, TypeScript configuration, or dependencies change.

### frontend-lint

- Command: `npm.cmd run lint`
- Result: **PASS** on 2026-09-11 with 12 warnings and 0 errors.
- Warnings: React effect/dependency diagnostics in existing UI modules; no purity or syntax errors.
- Valid for the frontend fingerprint above.
- Invalidate when affected frontend source or lint configuration changes.

### frontend-tests

- U2 focused command: `npm.cmd test -- src/pages/admin/AdminUsersPage.test.tsx src/api/index.test.ts --reporter=dot`
- U2 focused result: **15/15 PASS** on 2026-09-08.
- Full-suite command: `npm.cmd test`
- Full-suite result: on 2026-09-11:
  - **Test Files**: 46 passed, 1 skipped (共 47 个测试套件文件)
  - **Tests**: 233 passed, 1 skipped (共 234 个具体测试用例)
  - 注：`src/components/admin/tiptap/largeDocumentBenchmark.test.ts` 中的基准性能测试用例默认 skip。

### deployment-compose-config

- Command: `docker compose --env-file .env.example config --quiet`
- Result: **PASS** on 2026-09-11. The root Compose entry point accepts a minimal `.env`, publishes frontend at `${APP_PORT:-8080}:80`, keeps backend Compose-internal on `8090`, and retains health checks and named volumes.
- Valid for the deployment fingerprint above.

### deployment-runtime-rc

- Isolated project: `boke-rc-validation` with disposable named volumes, a fresh production configuration, and a first-boot administrator.
- Result: **PASS** on 2026-09-11. A fresh disposable Compose deployment using only `APP_PORT`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` built successfully; both services became healthy; homepage/API/admin login, generated `/data/.jwt_secret`, restart, and `down`/`up` persistence passed. Explicit `JWT_SECRET` compatibility also passed.
- Cleanup: the disposable containers, network, volumes, test document, and test image were removed after validation.

### browser-runtime-acceptance

- Browser: Chrome headless via Playwright against the Docker production build; viewports `1440x900` and `1024x900`.
- Result: **PASS** on 2026-09-10. Real login/session refresh, all admin surfaces, Tiptap initialization, Chinese paste input, headings, bold, draft/reload/second-save/publish, image insertion, public rendering, deep-route refresh, back/forward navigation, responsive smoke, lazy Tiptap chunk loading, and UI deletion of test data passed with no console errors, page errors, failed resource requests, or HTTP 5xx responses.
- Native IME composition was not simulated; Chinese text was inserted through browser paste input.

### Not Verified

- Browser interaction/E2E behavior. HTTP runtime checks returned 200 for `/`, `/wang`, `/wang/users`, and backend `/api/health` on 2026-09-08.
- Production Nginx/domain/TLS integration.
- Restore from a backup archive.
- Native IME composition behavior.
- Real-server resource usage.
- Race detector: unavailable in the current environment because `go test -race` requires CGO.

## Known Risks / TODO

1. **P3 - Frontend quality debt:** resolve the 12 classified React effect warnings incrementally in affected UI modules.
2. **Operational:** production Nginx/domain/TLS integration, persistent-volume migration, and backup restore from archive remain unverified on production host.
3. **Operational:** manual browser acceptance remains available at `http://127.0.0.1:3788`, with the protected management entry at `/wang`.
4. **Environment:** race detector is unavailable in current local Windows environment without CGO toolchain.

## Incremental Rules

- Repository work starts with `AGENTS.md`; follow `.agents/skills/project-owner/SKILL.md` as the default maintenance workflow.
- Read this state file before broad repository discovery.
- Inspect `git status --short` and relevant existing diffs before modifying files.
- Preserve user changes and avoid unrelated modifications.
- Search symbols, references, callers, routes, tests, and existing implementations before creating or replacing code.
- Prefer `reuse > extend > create`.
- Fix root causes with the smallest coherent change.
- Reuse a cached verification result only when its scoped source, tests, configuration, dependencies, schema, and relevant callers remain unchanged.
- Run targeted verification first and expand only when affected scope or risk requires it.
- Expand to full frontend tests for shared rendering, routing, global state, test-environment, or toolchain changes when targeted evidence is insufficient.
- Expand to full backend tests for shared schema, authentication, shared repository, middleware, or cross-service changes when targeted evidence is insufficient.
- Inspect actual command output and the final diff.
- Update durable architecture facts, risks, fingerprints, verification results, and invalidation conditions here.
- Do not append a chronological activity log.

## U3 Document Access Control

- **COMPLETED**: `documents.access_level` (`public`/`authenticated`), optional authentication, public locked metadata, viewer-aware search, SEO/sitemap exclusion, admin selector/badge, and locked DocViewer state.
- Verification: U3 targeted backend tests, `go test ./...`, `go vet ./...`, focused frontend tests, lint and build passed on 2026-09-08. Browser interaction and race detector were not run.

## U4 Member Frontend Authentication

- **COMPLETED**: public `/login` and invite-only `/register`, canonical `kb_token` session restore, authenticated header/logout, safe local return paths, auth-aware document/search refresh, and logout cleanup of restricted UI.
- U4 verification on 2026-09-08: frontend full suite 234 passed/1 skipped; lint and build passed; backend `go test ./...` and `go vet ./...` passed. Browser and race detector were not run.

## U5 UI/UX & Reading Interaction Experience

- **COMPLETED**: Header `UserDropdown` with card layout and theme toggle; `ReadingProgressBar` in `DocViewer`; `/wang/dashboard` Admin Dashboard page with metrics, quick actions, recent edits, and system overview cards.
- Verification on 2026-09-08: focused unit tests 9/9 PASS, frontend build `npm run build` PASS, `npm run lint` PASS (0 errors), backend `go test ./...` and `go vet ./...` PASS.

## U6 8-Digit Invite Code System & Users UI Overhaul

- **COMPLETED**:
  1. 8-Character alphanumeric invite code generation & custom 8-digit code support (using unambiguous charset `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`).
  2. Database schema additions: `invite_codes.code` (plaintext storage for admin viewing/copying), `invite_codes.remark`, and `users.invite_code_id` (tracking which invite code was used by each user).
  3. UI Overhaul: Removed excessive top spacing in `/wang/users`; eliminated `datetime-local` calendar picker in favor of preset validity capsules (`永久有效`, `1天`, `7天`, `30天`, `90天`, `365天`, `自定义天数输入`).
  4. Feature enhancements: multi-select batch actions (batch enable, batch disable, batch delete, batch copy multi-line), view registered users per invite code, edit invite codes (remark, max uses, validity extension), 1-click mono-badge copy with instant feedback.
- Verification on 2026-09-08: Frontend full test suite (39 test files, 239 passed, 1 skipped), `npm run build` PASS (tsc + vite build 0 errors), Backend `go test ./...` PASS across all packages. Browser and race detector were not run.

## U7 Member Self-Service Password Change

- **COMPLETED**: authenticated users can open `/account/security` from the user menu, verify their current password, and set a new password of at least 12 characters. The backend increments `auth_version`, invalidates every old session, and returns a fresh JWT so the current device remains signed in.
- Verification on 2026-09-08: backend `go test ./...` and `go vet ./...` PASS; focused frontend tests 45/45 PASS; frontend build and lint PASS (warnings only). The full frontend run passed 241 tests and skipped 1, with the already-recorded intermittent `App.test.tsx` document lazy-route timeout; an immediate focused rerun of `App.test.tsx` passed 6/6.

## U8 Unified Media Asset Management Center & Reference System

- **COMPLETED**:
  1. **Schema & N:M Relations**: Created `media_document_refs` table (`media_id`, `document_id`) with foreign keys, composite primary key, and indexed queries; added `media.source` column (`document/editor`, `manual upload`, `legacy/import`).
  2. **Storage Stability & Zero Disk Mutation**: Maintained absolute physical storage paths without renaming or moving files on disk. Classification, folder organization, and document associations are managed purely through database logic.
  3. **Editor & Document Lifecycle Integration**: Editor uploads carry `document_id` and register references immediately; `DocumentService.Create` and `Update` automatically sync references by parsing Markdown / HTML media URLs (`img src`, `video src`, `source src`, Markdown links); `DocumentService.Delete` cascades reference deletion without affecting media assets.
  4. **Strict Delete Protection**: Single deletion is blocked if `reference_count > 0`, displaying a modal with referencing documents; batch deletion (`POST /api/admin/media/batch-delete`) checks references, deletes only unreferenced items, and preserves referenced files with detailed reporting.
  5. **Smart Reconcile**: Added `POST /api/admin/media/rebuild-references` to safely and idempotently rescan all document contents and rebuild media references without modifying document text or disk files.
  6. **UI & Navigation Overhaul**: Redesigned `/wang/media` with clear information hierarchy:
     - Left Sidebar: Smart views (`全部资源`, `未分类资源`, `未使用资源`), Document Association tree (`文档关联` with document search and count badges), Custom Logical Folders (`自定义文件夹` with inline create/rename/delete), Bottom Resource Stats (总计 / 已使用 / 未使用) and Reconcile button.
     - Right Area: Responsive four-column desktop grid, standardized cards with uniform aspect ratio, original filename priority, video play overlay & badge, instant Markdown copy, batch selection mode with floating batch toolbar (`批量移动`, `批量删除`, `全选当前页`).
  7. **Media Grid Follow-up**: `/wang/media` uses the wider workspace shell and a fixed four-column desktop grid (`lg:grid-cols-4`); below that it steps down to three, two, then one column. The default page size is 40 and can be entered directly without changing the column count.
- Verification refreshed on 2026-09-10:
  - Backend: `backend/internal/repository/media_repository_test.go` and `backend/internal/service/media_service_test.go` unit tests PASS; full backend `go test ./...` and `go vet ./...` PASS.
  - Frontend: `frontend/src/pages/admin/AdminMediaManager.test.tsx` 5/5 PASS; full test suite `npm run test -- --run` (46 test files, 266 passed, 1 skipped) PASS; `npm run build` (`tsc -b && vite build`) PASS with 0 errors.

## Admin Unified Layout & Navigation System

- **COMPLETED**: ordinary admin pages share one visual shell. `AdminLayout` owns the fixed `232px` desktop sidebar and route-aware workspace selection; `AdminPageShell` provides the standard `1440px` content width and vertical rhythm; `AdminPageHeader` standardizes the icon/title/description/action baseline.
- Shared surfaces: `admin-surface` is the standard panel, `admin-toolbar` is the compact search/filter/action row, and `admin-table-shell` is the bordered scrolling list/table container. Standard pages use these primitives rather than page-specific content widths and outer-card styling.
- Intentional layout variants: document management and media library use the wider workspace; the document editor remains an immersive workspace; the dashboard welcome banner remains a deliberate content-specific visual distinction.
- Visual acceptance completed at `1920px`, `1440px`, `1280px`, and `1024px` for dashboard, documents, categories, tags, media, settings, and users. At constrained widths, toolbars and two-column panels reflow while data tables retain controlled horizontal scrolling.
- Verification on 2026-09-10: frontend TypeScript/build, lint (warnings only), full tests (`226 passed`, `1 skipped`), and `git diff --check` PASS. The Tiptap lazy chunk remains above Vite's advisory 500 kB threshold.

## Media Backend Consolidation (PHASE 2C)

- Folder deletion is transactional: every media row in the deleted folder is reassigned to `folder_id = 0` before the folder row is removed. The legacy `keep_media` query remains accepted, but both values preserve media assets and document references.
- Document deletion is transactional: associated automatic media folders remain with their names and media, but are converted to ordinary folders by setting `document_id = 0`. `media_document_refs` are removed by the existing foreign-key cascade; media assets remain.
- Folder-stat query errors now propagate from repository through service to the existing handler `500` response. `document_refs`, `PUT /media/folders/:id`, and `POST /media/save-external` remain for API compatibility; `SaveExternalImage` remains the implementation used by content-image localization.
- Verification on 2026-09-11: focused F1/F2/F3 backend tests PASS; `go test ./...`, `go vet ./...`, frontend lint (existing warnings only), TypeScript check, full frontend tests (231 passed, 1 skipped), frontend build, and `git diff --check` PASS.

## React State and Effect Consolidation (PHASE 3)

- `AuthProvider` initial-session loading is now cancellation-safe and token-scoped: a stale `/auth/me` response cannot overwrite a newer login or logout session.
- Invite expiry rendering uses a lifecycle-managed one-minute clock state rather than render-time `Date.now()`, so expiration filters and countdowns update predictably without render impurity.
- Media-list requests now reject stale/aborted results and only clear loading for the currently active request.
- Verification on 2026-09-11: focused Auth, admin users, media, and search tests PASS; frontend lint has 12 classified existing effect warnings and no purity warnings; TypeScript, full frontend tests (233 passed, 1 skipped), frontend build, backend `go test ./...`, backend `go vet ./...`, and `git diff --check` PASS.
## Final Consolidation Baseline

- The admin media page remains the sole owner of media state, API calls, request cancellation, upload, selection, and dialog coordination; its sidebar, workspace, and detail UI live under `frontend/src/pages/admin/media/`.
- `AdminUsersPage` remains the sole owner of users, filters, pagination, current-user protection, invitation state, API calls, and the minute clock; the users table/filter/pagination presentation lives in `frontend/src/pages/admin/users/UsersTab.tsx`.
- The document editor, reader lifecycle, CSS compatibility selectors, registered API routes, historical content compatibility, and deployment compatibility were re-audited without structural changes because their current tests cover behavior whose ownership crosses those boundaries.
- Final verification on 2026-09-11: frontend lint has 12 classified effect warnings and no errors; TypeScript, full frontend tests (233 passed, 1 skipped), production build, backend `go test ./...`, backend `go vet ./...`, and `git diff --check` pass.
