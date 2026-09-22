# Codex Project State

> Current maintenance state and reusable verification evidence. Source, configuration, schema, tests, and runtime behavior override this file. Updated 2026-09-22 (Asia/Shanghai) during Phase 2 documentation alignment; this file intentionally excludes release history and completed audit narratives.

## Current Project Facts

- Git baseline before the uncommitted Phase 2 documentation/metadata changes: `1365186` (`main`, equal to `origin/main`). No commit has been created for Phase 2.
- Frontend: React 19, TypeScript 6, Vite 8, React Router 7, Tailwind CSS, TipTap 3, DOMPurify.
- Backend: Go 1.26.4, Gin, `modernc.org/sqlite`, SQLite WAL with one open connection, local media storage.
- Deployment: root `docker-compose.yml` runs an internal backend on `8090` and an Nginx frontend published at `${APP_BIND_ADDRESS:-0.0.0.0}:${APP_PORT:-8080}`. Named volumes `docker_kb-data` and `docker_kb-uploads` persist data.
- Runtime entry points: `frontend/src/main.tsx` → `frontend/src/App.tsx`; `backend/cmd/server/main.go`.
- Backend layering: handlers own HTTP binding and response mapping; complex business paths use services; some simple CRUD/query handlers directly use repositories.
- Persistence: `users`, `categories`, `tags`, `documents`, `document_tags`, `media`, `media_document_refs`, `media_folders`, `invite_codes`, `settings`, plus `documents_fts` and synchronization triggers. Additive schema migration is in `backend/internal/repository/db.go`.
- Category writes reject missing, self, descendant, and cyclic parents; tree reads normalize legacy orphan/cycle links so persisted categories remain navigable.
- Document ACL is enforced by the backend: unauthenticated reads of `authenticated` documents receive locked metadata without body/excerpt; search and sitemap apply the same access boundary.
- Content uses `TiptapEditor` and `TiptapReadonlyDocument`; untouched historical Markdown/HTML is retained, while edited content follows the sanitizer/HTML pipeline defined by `docs/specs/EDITOR_FORMAT.md`.
- Media lifecycle preserves assets: folder deletion reassigns media to folder `0`; document deletion converts associated automatic folders to ordinary folders and lets reference rows cascade. `/api/admin/media/save-external` remains a compatibility API; current editor localization uses `/api/admin/media/localize-images`.
- Critical maintenance paths: schema/migration, authentication, document persistence, media storage/reference synchronization, and the editor/reader sanitizer pipeline.

## Documentation Responsibilities

- `README.md`: user entry, local quick start, Docker entry, common configuration.
- `ARCHITECTURE.md`: current architecture and data-flow facts.
- `SECURITY.md`: current security model and constraints.
- `CHANGELOG.md`: released timeline and unreleased changes.
- `PROJECT_CODE_HEALTH_AUDIT.md`: completed historical audit evidence.
- `docs/specs/*`, `docs/operations/*`, `docs/testing/*`: current scoped contracts, procedures, and verification selection.

## Current Fingerprints

Aggregate SHA-256 over sorted tracked paths. For each path, the calculation feeds UTF-8 normalized relative path, NUL, raw file bytes, NUL. The documentation scope excludes this file to avoid a circular hash.

| Scope | Fingerprint | Scope inputs |
| --- | --- | --- |
| Backend | `ad5a148a6cc896a787cff95d0ed32602248b83222ceee84d69922015fd56dd7b` | `backend/**/*.go`, `go.mod`, `go.sum` |
| Frontend | `d66ace6c7653253aa484c71b947ce50716dbe3b0f85ab15a9f5e0a9afd3b5492` | frontend source, package metadata/lockfile, build config, TypeScript config, HTML |
| Deployment | `4f9f00e286a8544aa35232f3a8a14f70af4ceb351b9450dfa9ef7d367a62b674` | Compose, root environment example, Dockerfiles, Nginx config |
| Maintained Markdown | `c9be4ba1c720fb878c2a46e048e1b8e1da043164b80ec34fc1656430f1d5c873` | README, architecture, security, changelog, AGENTS, health audit, `docs/**` |

These fingerprints describe the Phase 2 working tree before commit. Recompute a scope after changing any listed input.

## Verification Evidence

Historical evidence below is explicitly not a Phase 2 rerun.

| Scope | Latest actual result | Commit / date | Reuse condition |
| --- | --- | --- | --- |
| Backend tests and vet | `go test ./...` PASS; `go vet ./...` PASS | `1365186`, 2026-09-17 | Backend Go/modules/schema/callers unchanged |
| Frontend tests | `npm.cmd test` PASS: 48 test files passed, 1 skipped; 254 tests passed, 1 skipped | `1365186`, 2026-09-17 | Frontend source, resolved dependencies, test configuration, and callers unchanged |
| Frontend lint | `npm.cmd run lint` PASS: 0 errors, 12 existing warnings | `1365186`, 2026-09-17 | Frontend source/lint config unchanged |
| Frontend build | `npm.cmd run build` PASS | `1365186`, 2026-09-17 | Frontend source/build config/resolved dependencies unchanged |
| Compose syntax | `docker compose --env-file .env.example config --quiet` PASS | `1365186`, 2026-09-17 | Compose, Dockerfiles, Nginx, root environment example unchanged |
| Diff integrity | `git diff --check` PASS | `1365186`, 2026-09-17 | Re-run after any text/code change |

Phase 2 changes only Markdown and the lockfile root-package version (`1.0.2` → `1.0.3`); dependency resolutions are unchanged. The prior behavior tests are retained as historical evidence, not restated as a new run. Phase 2 must run `npm ci --dry-run` and `git diff --check`.

## Current Verification Gaps / Risks

- Browser/E2E behavior was not rerun during the 2026-09-17 final code-health closure.
- Docker daemon/runtime is not available in the current environment; Compose/runtime deployment is not rerun in Phase 2.
- Backup restoration from an archive and production domain/TLS integration remain unverified.
- The race detector is unavailable in this Windows environment without a CGO toolchain.
- Native IME behavior has focused component evidence but no real-browser IME simulation.
- Existing frontend lint baseline: 12 warnings, 0 errors; resolve only in affected modules.
- `POST /api/admin/media/save-external` has no current frontend caller but remains a potential compatibility API. Do not remove without external-consumer verification.

## Maintenance Rules

1. Do not treat a prior PASS as a current rerun; record command, date, commit, and scope.
2. Invalidate only affected evidence when its source, dependency graph, configuration, schema, caller, or test input changes.
3. Prefer focused verification; escalate to a full suite only when the changed boundary requires it.
4. Update this file only for durable current facts, fingerprints, verification evidence, risks, or invalidation conditions. Put release history in `CHANGELOG.md` and closed audits in `PROJECT_CODE_HEALTH_AUDIT.md`.
