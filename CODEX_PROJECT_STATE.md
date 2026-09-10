# Codex Project State

> Baseline established: 2026-09-07 (Asia/Shanghai). Source and configuration are authoritative. Refresh only affected entries when their relevant inputs change.

## Project

- Lightweight personal blog and read-only knowledge base with an authenticated administration SPA.
- Backend: Go 1.26.4, Gin, pure-Go SQLite (`modernc.org/sqlite`), local media storage.
- Frontend: React 19, TypeScript 6, Vite 8, Tailwind CSS; Markdown/HTML rendering with DOMPurify and rehype sanitization.
- Deployment: root `docker-compose.yml` defines two Docker services. Frontend Nginx binds `127.0.0.1:5185`; backend is internal on `8090`; named volumes hold SQLite data and uploads. Local development uses frontend `3788` and backend `3799`.
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
- Persistence: users, categories, tags, documents, document-tags, media, media-folders, settings, plus an FTS5 document index and synchronization triggers. SQLite uses WAL and one open connection.
- Category hierarchy writes reject missing, self, descendant, and cyclic parent relationships; tree responses normalize legacy orphan/cycle links so persisted categories cannot disappear from navigation.
- Frontend entry/routes: `frontend/src/main.tsx` -> `frontend/src/App.tsx`; public routes are `/`, `/blog`, `/docs/:slug`; admin routes are lazy-loaded under `/wang` (with `/wang/dashboard` overview landing); backend management APIs remain under `/api/admin/*`.
- User/auth: `users` supports admin/member roles, active/disabled status and auth-version invalidation. Public `/api/auth/register` requires an atomically consumed invite, `/api/auth/login` shares the existing JWT system, and authenticated `/api/auth/me` returns the database-current safe user.
- Invites: plaintext codes are generated with `crypto/rand`, stored only as SHA-256 hashes, and consumed with a conditional SQLite update in the member-creation transaction.
- User System: **COMPLETED** through U2. Admin user management and admin invite management are **COMPLETED**; `/wang/users` provides Users and Invites tabs backed by `/api/admin/users*` and `/api/admin/invites*`.
- Document Access Control: **COMPLETED**. Backend enforces `access_level` on `/api/public/documents/:slug` (returning `locked: true` without body) and `/api/public/documents` (clearing `excerpt` for unauthenticated visitors). Frontend `ArticleCard` and `DocViewer` display dedicated locked badges and login/registration prompt cards.
- Editor: `AdminDocumentEditor` uses `TiptapEditor` exclusively. It reuses drafts from `useDocumentDraft` and the existing persistence/reader content contract.
- Critical paths: database/schema (`repository/db.go`), auth (`middleware/auth.go`, `service/auth_service.go`), file storage/media, document persistence, and the `DocViewer` sanitization/rendering pipeline.

## Current Fingerprints

Aggregate SHA-256 over sorted relevant inputs. The maintained-documentation fingerprint excludes this state file to avoid a circular hash.

| Scope | Fingerprint |
| --- | --- |
| Backend Go source + modules | `069cab7f88cb686d5fbdd371f25779693947b295ec381df07388e7e62a089acf` |
| Frontend source/config | `8d08d63cfbcfcf4c75f3cc6b62db1817d2e2317d79d154977843ee7ad1466f1c` |
| Deployment config | `f066d94ca9bf9b31fadb4032bfa9097d33d4ee249ed97357f85c269fdd67aafd` |
| Maintained Markdown except this state file | `2256c3e4fe2449f5ac563a41be4f459f929a44f990433afd8b1f2baa08a9d9bd` |

The backend, frontend, and deployment fingerprints above remain valid only while their recorded input scopes remain unchanged.

All four fingerprints were recomputed on 2026-09-10 from sorted tracked and nonignored pending-addition scope paths plus raw contents, with NUL separators between path/content records; the Markdown scope excludes this state file.

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

### frontend-build

- Command: `npm.cmd run build`
- Result: **PASS** on 2026-09-08 after frontend UI modern aesthetic upgrade (`tsc -b && vite build`).
- Note: Vite reports the lazy Tiptap chunk at 544.26 kB minified, above its 500 kB advisory threshold.
- Result refreshed: **PASS** on 2026-09-10 after removing obsolete legacy-editor metadata and compatibility-path wording.
- Valid for the frontend fingerprint above.
- Invalidate when relevant frontend source, build configuration, TypeScript configuration, or dependencies change.

### frontend-lint

- Command: `npm.cmd run lint`
- Result: **PASS** on 2026-09-10 with 20 warnings and no errors.
- Warnings: React effect/dependency/manual-memoization diagnostics in existing UI modules, plus `react(refs)` in `TiptapEditor.tsx`; none were introduced by the release cleanup.
- Valid for the frontend fingerprint above.
- Invalidate when affected frontend source or lint configuration changes.

### frontend-tests

- U2 focused command: `npm.cmd test -- src/pages/admin/AdminUsersPage.test.tsx src/api/index.test.ts --reporter=dot`
- U2 focused result: **15/15 PASS** on 2026-09-08.
- Full-suite command: `npm.cmd test -- --reporter=dot`
- Full-suite result: **226/226 PASS**, 1 skipped (46 test files) on 2026-09-10.

### deployment-compose-config

- Command: `docker compose --env-file .env.example config --quiet`
- Result: **PASS** on 2026-09-10. The root Compose entry point publishes frontend at `127.0.0.1:5185:80` and keeps backend Compose-internal on `8090`.
- Valid for the deployment fingerprint above.

### deployment-runtime-rc

- Isolated project: `boke-rc-validation` with disposable named volumes, a fresh production configuration, and a first-boot administrator.
- Result: **PASS** on 2026-09-10. `docker compose build --no-cache` built backend (85 MB) and frontend (97.3 MB); both services became healthy. Public/admin HTTP smoke, document create/edit/publish/read/delete, image upload/public access/article reference, restart, `down`/`up`, non-root execution, placeholder-secret rejection, and disposable-volume backup all passed.
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
- Local production-data migration.
- Race detector: unavailable in the current environment because `go test -race` requires CGO.

## Known Risks / TODO

1. **P2 - Frontend test reliability:** one async/lazy document-route test in `App.test.tsx` failed in the full suite while U2 focused tests passed; stabilize its synchronization and rerun the full suite.
2. **P3 - Frontend quality debt:** resolve the 20 lint warnings incrementally in affected modules.
3. **P3 - Tiptap bundle size:** assess the lazy Tiptap chunk size before making Tiptap the default editor.
4. **Operational:** production Nginx/domain/TLS integration, persistent-volume migration, backup restore, and native IME composition remain unverified.
5. **Operational:** manual browser acceptance remains available at `http://127.0.0.1:3788`, with the protected management entry at `/wang`.
6. **Planned U3+:** article/search/SEO access controls and member login/register frontend UI are not implemented.

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
