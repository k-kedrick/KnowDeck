# Codex Project State

> Baseline established: 2026-09-07 (Asia/Shanghai). Source and configuration are authoritative. Refresh only affected entries when their relevant inputs change.

## Project

- Lightweight personal blog and read-only knowledge base with an authenticated administration SPA.
- Backend: Go 1.26.4, Gin, pure-Go SQLite (`modernc.org/sqlite`), local media storage.
- Frontend: React 19, TypeScript 6, Vite 8, Tailwind CSS; Markdown/HTML rendering with DOMPurify and rehype sanitization.
- Deployment: two Docker services. Frontend Nginx binds `127.0.0.1:5185`; backend is internal on `8090`; named volumes hold SQLite data and uploads. Local development uses frontend `3788` and backend `3799`.
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
- Editor: `AdminDocumentEditor` defaults to the legacy `DocumentVisualEditor`; the Tiptap implementation is selected only when `VITE_EDITOR_ENGINE=tiptap`. Drafts are stored locally through `useDocumentDraft`.
- Critical paths: database/schema (`repository/db.go`), auth (`middleware/auth.go`, `service/auth_service.go`), file storage/media, document persistence, and the `DocViewer` sanitization/rendering pipeline.

## Current Fingerprints

Aggregate SHA-256 over sorted relevant inputs. The maintained-documentation fingerprint excludes this state file to avoid a circular hash.

| Scope | Fingerprint |
| --- | --- |
| Backend Go source + modules | `dc0d0dbb7145685c62dbcf0eaa328d79bd3d5bf119204c8e7177724f95f7aba3` |
| Frontend source/config | `3762ad5d2b22440c8991214e52f81b445cbbf363705f7fb53cd3294ed970cb81` |
| Deployment config | `80e147f0b82e2f40ec518eb83a42c15a71e0a8131a2c81ffe4a7f28df965ff6f` |
| Maintained Markdown except this state file | `4678ec9641749f161437dc742703457639c2ef2d26efe5dfdc83c76cfe8f8d03` |

The backend, frontend, and deployment fingerprints above remain valid only while their recorded input scopes remain unchanged.

All four fingerprints were recomputed on 2026-09-08 from sorted tracked and nonignored pending-addition scope paths plus raw contents, with NUL separators between path/content records; the Markdown scope excludes this state file.

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
- Result: **PASS** on 2026-09-08 after U2 user/invite administration and security regression coverage.
- Valid for the backend fingerprint above.
- Invalidate when relevant backend Go source, modules, shared schema behavior, or affected callers change.

### backend-vet

- Command: `go vet ./...`
- Result: **PASS** on 2026-09-08 after U2 completion.
- Invalidate when relevant backend Go source or modules change.

### frontend-build

- Command: `npm.cmd run build`
- Result: **PASS** on 2026-09-08 after frontend UI modern aesthetic upgrade (`tsc -b && vite build`).
- Note: Vite reports the lazy Tiptap chunk at 544.26 kB minified, above its 500 kB advisory threshold.
- Valid for the frontend fingerprint above.
- Invalidate when relevant frontend source, build configuration, TypeScript configuration, or dependencies change.

### frontend-lint

- Command: `npm.cmd run lint`
- Result: **PASS** on 2026-09-08 with 12 pre-existing warnings and no U2 page warning.
- Warnings: 10 `react(set-state-in-effect)`, one `react(refs)` in `TiptapEditor.tsx`, and one `react(only-export-components)` in `DocumentVisualEditor.tsx`.
- Valid for the frontend fingerprint above.
- Invalidate when affected frontend source or lint configuration changes.

### frontend-tests

- U2 focused command: `npm.cmd test -- src/pages/admin/AdminUsersPage.test.tsx src/api/index.test.ts --reporter=dot`
- U2 focused result: **15/15 PASS** on 2026-09-08.
- Full-suite command: `npm.cmd test -- --reporter=dot`
- Full-suite result: **239/239 PASS** on 2026-09-08 (39 test files passed, 1 skipped). All test files including `App.test.tsx`, `AdminDashboardPage.test.tsx`, and `AdminUsersPage.test.tsx` passed.

### deployment-compose-config

- Command: `docker compose --env-file .env.production.example -f deploy/docker/docker-compose.yml config`
- Result: **PASS** on 2026-09-07 with required production placeholders supplied; frontend publishes `127.0.0.1:5185:80` and backend remains Compose-internal on `8090`.
- Valid for the deployment fingerprint above.

### Not Verified

- Browser interaction/E2E behavior. HTTP runtime checks returned 200 for `/`, `/wang`, `/wang/users`, and backend `/api/health` on 2026-09-08.
- Real Docker image/runtime behavior.
- Production Nginx/domain/TLS integration.
- Backup/restore.
- Real-server resource usage.
- Local production-data migration.
- Race detector: unavailable in the current environment because `go test -race` requires CGO.

## Known Risks / TODO

1. **P2 - Frontend test reliability:** one async/lazy document-route test in `App.test.tsx` failed in the full suite while U2 focused tests passed; stabilize its synchronization and rerun the full suite.
2. **P3 - Frontend quality debt:** resolve the 12 lint warnings incrementally in affected modules.
3. **P3 - Tiptap bundle size:** assess the lazy Tiptap chunk size before making Tiptap the default editor.
4. **Operational:** production deployment, persistent-volume migration, backup/restore, and browser acceptance remain unverified.
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
