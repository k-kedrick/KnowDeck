# Codex Project State

> Baseline established: 2026-09-07 (Asia/Shanghai). Documentation structure reconciled with source on the same date. Source and configuration are authoritative; refresh only affected entries when their inputs change.

## Project

- Lightweight personal blog and read-only knowledge base with an authenticated administration SPA.
- Backend: Go 1.26.4, Gin, pure-Go SQLite (`modernc.org/sqlite`), local media storage.
- Frontend: React 19, TypeScript 6, Vite 8, Tailwind CSS; Markdown/HTML rendering with DOMPurify and rehype sanitization.
- Deployment: two Docker services. Frontend Nginx binds `127.0.0.1:8080`; backend is internal on `8090`; named volumes hold SQLite data and uploads.
- Local Git is initialized on branch `main`; initial project baseline: `1a48894`.

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

Aggregate SHA-256 over sorted relevant inputs. The documentation fingerprint excludes this state file to avoid a circular hash.

| Scope | Fingerprint |
| --- | --- |
| Backend Go source + modules | `8432394b925318eaccc9db674e0379f384dca6f541509b85587b6271a6a95406` |
| Frontend source/config | `61312ac496ccd726824b1ccb05e29cf0c25b3bed70bd75282cd0daea3eaed2f5` |
| Deployment config | `cd8572d412957a41bee4321b907c61657f0fccb96a7bbdf8c1a3a1771d0551fe` |
| Maintained Markdown except this state file | `f39d33cae973a76b6b4824b93164880b3a59d0531a4af5bef19d37435499513a` |

## Documentation Map

- `README.md`: project entry, capabilities, setup, deployment entry and document navigation.
- `ARCHITECTURE.md`: stable boundaries, modules, data flow and architecture constraints.
- `SECURITY.md`: security model and production security requirements.
- `CHANGELOG.md`: durable release history.
- `docs/specs/EDITOR_FORMAT.md`: editor/storage/reader content contract.
- `docs/testing/FEATURE_TEST_MATRIX.md`: change-to-verification selection map; results remain in this file.
- `docs/operations/BACKUP.md`: production data migration, backup and restore.
- Ordinary Codex work reads the project skill plus this file; other documents are loaded only when relevant.

## Verification Cache

### backend-tests

- Command: `go test ./...`
- Result: **PASS** on 2026-09-07; package results were cached by Go.
- Valid for backend fingerprint above.

### backend-vet

- Command: `go vet ./...`
- Result: **PASS** on 2026-09-07.
- Valid for backend fingerprint above.

### frontend-build

- Command: `npm.cmd run build`
- Result: **PASS** on 2026-09-07 (`tsc -b && vite build`).
- Note: Vite reports the lazy Tiptap chunk at 544.30 kB minified, above its 500 kB advisory threshold.
- Valid for frontend fingerprint above.

### frontend-lint

- Command: `npm.cmd run lint`
- Result: **PASS with 12 warnings** on 2026-09-07.
- Warnings: 10 `react(set-state-in-effect)`, one `react(refs)` in `TiptapEditor.tsx`, and one `react(only-export-components)` in `DocumentVisualEditor.tsx`.
- Valid for frontend fingerprint above.

### frontend-tests

- Full command: `npm.cmd test -- --reporter=dot`
- Result: **UNSTABLE** on 2026-09-07: 212 passed, 2 failed, 1 skipped. Failures were `App.test.tsx` document routing and `DocViewer.security.test.tsx` lazy KaTeX rendering.
- Targeted rerun: `npm.cmd test -- src/App.test.tsx src/components/DocViewer.security.test.tsx --reporter=dot` -> **17/17 PASS**.
- Interpretation: the two cases are suite-load/timing-sensitive rather than consistently failing. Do not record the full frontend suite as passing until a full run succeeds reliably.

### Not Verified

- Browser/E2E behavior, real Docker image/runtime behavior, production Nginx/domain/TLS integration, backup/restore, real-server resource usage, and local production data migration.

## Known Risks / TODO

1. **P2 - Frontend test reliability:** two async/lazy-render tests fail in the full suite but pass in isolation; stabilize their synchronization and rerun the full suite.
2. **P3 - Frontend quality debt:** resolve the 12 lint warnings incrementally in affected modules; assess Tiptap chunk size before making it the default editor.
3. **Operational:** production deployment, persistent-volume migration, backup/restore, and browser acceptance remain unverified.

## Incremental Rules

- Start with this file, then inspect `git status` and the relevant diff.
- Reuse a cached result only when the scoped source, tests, config, and dependencies are unchanged.
- New cache entries should record the validated commit and affected paths; invalidate only entries whose inputs changed from that commit.
- Use targeted tests first. Expand to full frontend tests for shared rendering/routing/toolchain changes and to full backend tests for schema/auth/shared repository changes.
- Update durable architecture facts, risks, and verification results here; do not append a chronological activity log.
