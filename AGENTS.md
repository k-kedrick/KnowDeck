# Project Instructions

This repository uses `project-owner` as its default maintenance workflow.

## Default Workflow

For every task in this repository, including feature development, bug fixes,
debugging, UI changes, refactoring, code cleanup, performance, security,
testing, deployment, review, and long-term maintenance:

1. Read and follow `.agents/skills/project-owner/SKILL.md`.
2. Read `CODEX_PROJECT_STATE.md` before broad repository discovery.
3. Inspect `git status --short` and relevant existing diffs before modifying files.
4. Preserve user changes. Do not revert, overwrite, format, or modify unrelated work. Never use destructive forms such as `reset --hard`, `checkout .`, `restore .`, `clean -fd`, force-push, or shared-history rewriting without explicit user instruction and verified scope; distinguish pre-existing user changes from the current task's changes.
5. Map the current request to affected entry points, callers, dependencies,
   configuration, schema, tests, and runtime effects.
6. Search symbols and references before reading large files.
7. Before creating anything new, search for an existing implementation.
   Prefer `reuse > extend > create`.
8. Trace the real entry-to-effect path and fix the root cause with the smallest
   coherent change.
9. Reuse still-valid verification results recorded in
   `CODEX_PROJECT_STATE.md`.
10. Run only the minimum additional verification required by the affected scope
    and risk.
11. Inspect the final diff before considering the task complete.
12. Update `CODEX_PROJECT_STATE.md` only when durable project facts, risks,
    verification results, fingerprints, or invalidation conditions materially change.

Do not require the user to explicitly invoke `$project-owner` for ordinary
repository work.

If automatic project-skill discovery is unavailable, read
`.agents/skills/project-owner/SKILL.md` directly and follow it as repository
instructions.

The user's current explicit request defines the task scope and takes precedence
over this default workflow.

## Source Of Truth

When information conflicts, use this precedence:

1. Current explicit user request
2. Current source code, configuration, schema, runtime behavior, and tests
3. `CODEX_PROJECT_STATE.md`
4. Relevant maintained project documentation
5. Historical reports and changelog entries

Do not treat documentation or historical reports as stronger evidence than
current source and runtime behavior.

## Default Context

For ordinary work, load only:

- `.agents/skills/project-owner/SKILL.md`
- `CODEX_PROJECT_STATE.md`
- affected source code
- affected tests

Do not read every project document or scan the whole repository by default.

Load additional documentation only when relevant:

- `README.md` — setup, local runtime, commands, project navigation
- `ARCHITECTURE.md` — architecture, module boundaries, data flow
- `SECURITY.md` — authentication, uploads, content safety, networking, secrets
- `docs/specs/EDITOR_FORMAT.md` — editor, storage, rendering, content-format changes
- `docs/testing/FEATURE_TEST_MATRIX.md` — verification selection
- `docs/operations/BACKUP.md` — deployment, migration, backup, restore
- `CHANGELOG.md` — durable release-level changes

## Documentation Impact

Documentation follows the implementation; it is not a reason to reinterpret
source, configuration, schema, runtime behavior, tests, or Git history. For
each change, identify whether a documented fact changed. If not, do not create
a documentation diff or scan every Markdown file.

| Change scope | Review only when applicable |
| --- | --- |
| Public usage, local startup, common configuration, deployment entry | `README.md` |
| Module boundary, data flow, frontend/backend architecture | `ARCHITECTURE.md`, `CODEX_PROJECT_STATE.md` when a durable maintenance fact changes |
| Auth, ACL, JWT, CORS, secrets, trusted proxies, upload/content security | `SECURITY.md`; `ARCHITECTURE.md` or state only if their facts change |
| TipTap, Markdown/HTML, serialization, rendering, image localization | `docs/specs/EDITOR_FORMAT.md`; architecture/state only when their respective facts change |
| Docker, Compose, Nginx, volumes, backup, restore, deployment | `README.md`, relevant `docs/operations/*`; security/architecture only when affected |
| Test files, coverage, verification strategy | `docs/testing/FEATURE_TEST_MATRIX.md` — never place one-off PASS/FAIL there |
| User-visible feature, meaningful bug fix/refactor, formal feature removal | assess `CHANGELOG.md` → `Unreleased`; exclude formatting and non-behavioral micro-cleanup |
| Fingerprint, reusable verification, compatibility constraint, current risk | `CODEX_PROJECT_STATE.md` only when durable |

`CODEX_PROJECT_STATE.md` contains current baseline, fingerprints, reusable
verification, active constraints, risks, and pending manual verification. Do
not turn it into a changelog, an audit archive, or an architecture/security
duplicate. Preserve historical descriptions in `CHANGELOG.md` and
`PROJECT_CODE_HEALTH_AUDIT.md`; do not rewrite them to match current code.

At task close: inspect the final diff, verify affected behavior and references,
update only applicable documentation, state what was run now versus reused or
not run, and then report the remaining verification gap.

Use a release gate only when the user explicitly requests a release, tag, or
version upgrade. Then verify working tree, relevant tests/build, version
metadata, `CHANGELOG.md`, applicable README/deployment facts, documentation
links, tag, and `origin/main`. Ordinary changes do not create releases.

## Change Discipline

Preserve the established architecture, layering, conventions, data flow, and
public behavior unless the current task explicitly requires changing them.

Do not:

- perform unrelated refactors;
- rewrite stable code merely for style;
- run repository-wide formatting without necessity;
- introduce duplicate helpers, components, hooks, services, repositories,
  APIs, types, styles, or dependencies;
- add speculative abstractions;
- add compatibility wrappers or fallback layers around obsolete logic instead
  of removing confirmed dead paths;
- change production design only to make tests easier;
- run full repository scans, full builds, full test suites, browser/E2E checks,
  security reviews, or project summaries merely for reassurance;
- create ordinary `implementation_plan`, walkthrough, audit, fix-report,
  summary, or temporary documentation files;
- overwrite, revert, or discard user changes.

Comments should explain rationale, compatibility, security, business
constraints, or non-obvious traps. Do not add comments that merely restate code.

## Verification

Use the smallest verification level that proves the affected behavior.

Escalate only when required:

```text
syntax / type / lint
    ↓
focused test
    ↓
module or package test
    ↓
application build
    ↓
full suite
    ↓
browser / E2E
