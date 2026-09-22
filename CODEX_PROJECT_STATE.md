# Codex Project State

> Current maintenance state and reusable verification evidence. Source, configuration, schema, tests, and runtime behavior override this file. Updated 2026-09-22 (Asia/Shanghai) during Phase 2 documentation alignment; this file intentionally excludes release history and completed audit narratives.

## Current Project Facts

- Verified performance-code baseline: `16438afb5da76645eae576b46fe570c40c27ae6f` (`main`, equal to `origin/main`) before this documentation-only closeout commit.
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

These fingerprints predate the performance-code baseline and are retained only as historical evidence. Recompute a scope before reusing them.

## Verification Evidence

Final performance regression acceptance at `16438af` on 2026-09-23 (Asia/Shanghai):

| Scope | Latest actual result | Reuse condition |
| --- | --- | --- |
| Backend tests | `go test ./...` PASS | Backend source/modules/schema/callers unchanged |
| Frontend tests | `npm.cmd test -- --run` PASS: 48 test files passed, 1 skipped; 266 tests passed, 1 skipped | Frontend source, dependencies, test configuration, and callers unchanged |
| Frontend build | `npm.cmd run build` PASS | Frontend source/build config/resolved dependencies unchanged |
| Frontend lint | `npm.cmd run lint` PASS: 0 errors, 11 existing warnings | Frontend source/lint config unchanged |
| Diff integrity | `git diff --check` PASS | Re-run after any text/code change |

Completed performance work:
- B1 external image localization uses bounded concurrency of 3; repeated saves do not re-download localized images, and save failure preserves dirty state.
- C1 media search does not request per keystroke; same-dataset mutation refresh preserves the grid, while dataset changes avoid stale content.
- D1 public reader navigation retains the committed document with a subtle pending state, atomically commits the next document, and preserves error/404/ACL correctness.

Deferred — do not optimize without new evidence: `SyncDocumentReferences`, `ReconcileDocumentLocalMedia`, editor full serialization/draft persistence, TOC scans, and a thumbnail pipeline. Current measurements do not demonstrate user benefit sufficient to justify compatibility risk.

## Current Verification Gaps / Risks

- MANUAL / NOT VERIFIED: Chinese IME; real-browser focus/selection; long-document scroll; anchor navigation; Back/Forward; visual transition/layout shift; repeated external-download Network inspection; real login/logout/register/password and admin save/publish/upload/delete flows.
- Docker runtime: NOT REVALIDATED. Deployment files were unchanged; `docker compose --env-file .env.example config --quiet` requires an unsupplied `ADMIN_PASSWORD`.
- PRE-EXISTING SECURITY FOLLOW-UP: external image fetching has no independent SSRF allowlist review.

## Maintenance Rules

1. Do not treat a prior PASS as a current rerun; record command, date, commit, and scope.
2. Invalidate only affected evidence when its source, dependency graph, configuration, schema, caller, or test input changes.
3. Prefer focused verification; escalate to a full suite only when the changed boundary requires it.
4. Update this file only for durable current facts, fingerprints, verification evidence, risks, or invalidation conditions. Put release history in `CHANGELOG.md` and closed audits in `PROJECT_CODE_HEALTH_AUDIT.md`.
