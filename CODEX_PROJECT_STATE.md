# Codex Project State

> Baseline established: 2026-09-07 (Asia/Shanghai). Source and configuration are authoritative. Refresh only affected entries when their relevant inputs change.

## Project

- Lightweight personal blog and read-only knowledge base with an authenticated administration SPA.
- Backend: Go 1.26.4, Gin, pure-Go SQLite (`modernc.org/sqlite`), local media storage.
- Frontend: React 19, TypeScript 6, Vite 8, Tailwind CSS; Markdown/HTML rendering with DOMPurify and rehype sanitization.
- Deployment: two Docker services. Frontend Nginx binds `127.0.0.1:8080`; backend is internal on `8090`; named volumes hold SQLite data and uploads.
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
- Frontend entry/routes: `frontend/src/main.tsx` -> `frontend/src/App.tsx`; public routes are `/`, `/blog`, `/docs/:slug`; admin routes are lazy-loaded under `/admin`.
- Editor: `AdminDocumentEditor` defaults to the legacy `DocumentVisualEditor`; the Tiptap implementation is selected only when `VITE_EDITOR_ENGINE=tiptap`. Drafts are stored locally through `useDocumentDraft`.
- Critical paths: database/schema (`repository/db.go`), auth (`middleware/auth.go`, `service/auth_service.go`), file storage/media, document persistence, and the `DocViewer` sanitization/rendering pipeline.

## Current Fingerprints

Aggregate SHA-256 over sorted relevant inputs. The maintained-documentation fingerprint excludes this state file to avoid a circular hash.

| Scope | Fingerprint |
| --- | --- |
| Backend Go source + modules | `8432394b925318eaccc9db674e0379f384dca6f541509b85587b6271a6a95406` |
| Frontend source/config | `61312ac496ccd726824b1ccb05e29cf0c25b3bed70bd75282cd0daea3eaed2f5` |
| Deployment config | `cd8572d412957a41bee4321b907c61657f0fccb96a7bbdf8c1a3a1771d0551fe` |
| Maintained Markdown except this state file | `INVALIDATED — refresh after the current AGENTS.md / project-owner workflow changes` |

The backend, frontend, and deployment fingerprints above remain valid only while their recorded input scopes remain unchanged.

The maintained Markdown fingerprint must be recomputed from the real repository after the current workflow-document changes are finalized. Do not invent or manually approximate this hash.

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

- Command: `go test ./...`
- Result: **PASS** on 2026-09-07; package results were cached by Go.
- Valid for the backend fingerprint above.
- Invalidate when relevant backend Go source, modules, shared schema behavior, or affected callers change.

### backend-vet

- Command: `go vet ./...`
- Result: **PASS** on 2026-09-07.
- Valid for the backend fingerprint above.
- Invalidate when relevant backend Go source or modules change.

### frontend-build

- Command: `npm.cmd run build`
- Result: **PASS** on 2026-09-07 (`tsc -b && vite build`).
- Note: Vite reports the lazy Tiptap chunk at 544.30 kB minified, above its 500 kB advisory threshold.
- Valid for the frontend fingerprint above.
- Invalidate when relevant frontend source, build configuration, TypeScript configuration, or dependencies change.

### frontend-lint

- Command: `npm.cmd run lint`
- Result: **PASS with 12 warnings** on 2026-09-07.
- Warnings: 10 `react(set-state-in-effect)`, one `react(refs)` in `TiptapEditor.tsx`, and one `react(only-export-components)` in `DocumentVisualEditor.tsx`.
- Valid for the frontend fingerprint above.
- Invalidate when affected frontend source or lint configuration changes.

### frontend-tests

- Full command: `npm.cmd test -- --reporter=dot`
- Result: **UNSTABLE** on 2026-09-07: 212 passed, 2 failed, 1 skipped.
- Failures: `App.test.tsx` document routing and `DocViewer.security.test.tsx` lazy KaTeX rendering.
- Targeted rerun: `npm.cmd test -- src/App.test.tsx src/components/DocViewer.security.test.tsx --reporter=dot` -> **17/17 PASS**.
- Interpretation: the two cases are suite-load/timing-sensitive rather than consistently failing.
- Do not record the full frontend suite as passing until a fresh full run succeeds reliably.
- Invalidate affected targeted evidence when the related routing, rendering, lazy-loading, tests, configuration, or dependencies change.

### Not Verified

- Browser/E2E behavior.
- Real Docker image/runtime behavior.
- Production Nginx/domain/TLS integration.
- Backup/restore.
- Real-server resource usage.
- Local production-data migration.

## Known Risks / TODO

1. **P2 - Frontend test reliability:** two async/lazy-render tests fail in the full suite but pass in isolation; stabilize their synchronization and rerun the full suite.
2. **P3 - Frontend quality debt:** resolve the 12 lint warnings incrementally in affected modules.
3. **P3 - Tiptap bundle size:** assess the lazy Tiptap chunk size before making Tiptap the default editor.
4. **Operational:** production deployment, persistent-volume migration, backup/restore, and browser acceptance remain unverified.
5. **Maintenance metadata:** recompute the maintained Markdown fingerprint after the current `AGENTS.md` and `project-owner` workflow changes are finalized.

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