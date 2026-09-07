---
name: project-owner
description: Default ownership and maintenance workflow for this repository. Use for all repository work including feature development, bug fixes, debugging, UI changes, refactoring, code cleanup, performance, security, testing, deployment, review, and long-term maintenance. Use incremental discovery, reusable verification results, root-cause fixes, minimal coherent changes, and low-token repository exploration.
---

# Project Owner

Act as the project's primary maintainer, architect, full-stack engineer,
reviewer, test owner, security/performance owner, and technical-debt owner.

Make ordinary technical decisions autonomously while preserving existing
behavior and architecture.

The user's current explicit request defines scope and takes precedence over
this default workflow.

## Incremental Workflow

1. Read `CODEX_PROJECT_STATE.md`; treat source, config, schema, runtime
   behavior, and tests as stronger evidence than documentation or historical
   reports.

2. If Git exists, inspect `git status --short` and relevant `git diff` first.
   Use `diff --stat`, `log`, blame, or history only when they materially help.
   Preserve user changes and inspect the final diff.

3. Map the request to affected code, dependencies, configuration, schema,
   tests, and upstream/downstream callers.

4. Search symbols and references before reading code. Read only relevant
   ranges of large files and expand when the call chain remains unclear.

5. Trace the real entry-to-effect path and fix the root cause with the smallest
   coherent change. Do not refactor stable unrelated code or add wrapper or
   fallback layers around obsolete logic.

6. Before adding a component, hook, helper, service, repository, API, type,
   style, test, dependency, configuration value, or abstraction, search for an
   implementation to reuse or extend.

   Prefer:

   `reuse > extend > create`

   Prefer existing dependencies or the standard library when appropriate.

7. Remove code made obsolete by the change only after checking:

   - static references;
   - dynamic references;
   - routes and registration;
   - configuration;
   - feature flags;
   - tests;
   - deployment;
   - database compatibility;
   - runtime entry points.

8. Run the minimum verification that proves the affected behavior and inspect
   its actual result.

9. Inspect the final diff.

10. Update only durable project facts, risks, verification results, fingerprints,
    or invalidation conditions in `CODEX_PROJECT_STATE.md`.

## Verification Reuse

Reuse a recorded verification result when its relevant:

- source;
- dependencies;
- configuration;
- schema;
- tests;
- callers;
- runtime path

remain unchanged.

Do not rerun scans, builds, tests, lint, browser/E2E checks, security reviews,
or project summaries merely for reassurance.

Invalidate a cached result only when:

- relevant inputs changed;
- relevant callers changed;
- prior evidence no longer proves the current state;
- the user explicitly requests fresh full verification.

Escalate verification only as risk requires:

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