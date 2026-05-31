---
phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-
plan: 07
subsystem: infra
tags: [lint-guards, ts-morph, ci, oauth-scopes, husky]

requires:
  - phase: 76
    provides: "76-03 GWS scope typed-const + Deprovisionable interface"
  - phase: 70
    provides: "lint-guards package (D-04) + structured-diff format (D-03) + husky pre-push (D-01)"
provides:
  - "lint:scopes CI guard (4th sibling) — ts-morph scope-drift detector"
  - "scopes-guard run-guard + format-offence + fixtures"
  - "root lint-scopes.mjs shim + npm script + husky + ci.yml wiring"
affects: [76-08, 76-09]

tech-stack:
  added: []
  patterns: ["ts-morph {files} guard mirroring logs-guard", "write-scope pattern allow-set trace"]

key-files:
  created:
    - packages/lint-guards/src/scopes-guard/run-guard.ts
    - packages/lint-guards/src/scopes-guard/format-offence.ts
    - packages/lint-guards/src/scopes-guard/__tests__/run-guard.test.ts
    - packages/lint-guards/src/scopes-guard/__fixtures__/conformant-adapter.ts
    - packages/lint-guards/src/scopes-guard/__fixtures__/drifted-adapter.ts
    - scripts/lint-scopes.mjs
  modified:
    - packages/lint-guards/src/index.ts
    - package.json
    - .husky/pre-push
    - .github/workflows/ci.yml

key-decisions:
  - "Guard takes `{ adapterFiles, scopeFiles }` (absolute paths) and uses per-file addSourceFileAtPath + skipAddingFilesFromTsConfig — mirrors the proven logs-guard ts-morph pattern, not the plan's whole-tsconfig Project (faster, no project-wide load)"
  - "Allow-set = global scopes/*.ts const arrays ∪ same-file `as const` arrays; only write-pattern scopes (excluding *.readonly) must trace"
  - "Tests run the guard directly against fixture file paths (deterministic GREEN), instead of the plan's soft-assertion-until-76-08 approach — the real GWS adapter has no write scope yet so pnpm lint:scopes already passes (20 adapters clean)"
  - "Formatter named formatScopesOffences (plural, offence[]) to match sibling formatSchemaOffences/formatLogsOffences shape"

patterns-established:
  - "Four-guard topology is now five: lint:schema, lint:logs, lint:scopes, i18n:parity (+ the hardening guards)"

requirements-completed: [IDP-14]

duration: 8 min
completed: 2026-05-31
---

# Phase 76 Plan 07: lint:scopes CI Guard Summary

**ts-morph `lint:scopes` guard (4th lint-guards sibling) that fails CI when an IdP adapter inlines a write-capable OAuth scope not traced to a typed-const, wired into the npm script, husky pre-push, and ci.yml.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-31T16:58:00Z
- **Completed:** 2026-05-31T17:01:00Z
- **Tasks:** 6
- **Files:** 6 created + 4 modified

## Accomplishments
- `runScopesGuard({ adapterFiles, scopeFiles })` returns structured `untyped-scope` offences; read-only scopes exempt; same-file + imported `as const` arrays form the allow-set.
- `formatScopesOffences` structured-diff output (Phase 70 D-03 shape).
- Conformant + drifted fixtures; 5 GREEN tests (run the guard against fixture paths directly).
- Root `scripts/lint-scopes.mjs` shim (globs adapters + scopes, exits 1 on offence).
- `lint:scopes` npm script, husky pre-push, and ci.yml step.
- `pnpm lint:scopes` exits 0 (20 adapters clean).

## Task Commits

1. **76-07-01..06: guard + formatter + fixtures + test + shim + wiring** — `3a7160e9` (feat)

## Files Created/Modified
See frontmatter `key-files`.

## Decisions Made
See frontmatter `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Improvement] Guard signature + test strategy adapted to sibling conventions**
- **Found during:** Tasks 76-07-01 / 76-07-03
- **Issue:** The plan's guard loaded the whole tsconfig Project and the test used a soft "may be RED until 76-08" assertion.
- **Fix:** Took `{ adapterFiles, scopeFiles }` + per-file `addSourceFileAtPath` (logs-guard pattern); tests run the guard against fixture paths directly for deterministic GREEN. The real GWS adapter has no write scope yet, so `pnpm lint:scopes` already passes — no RED window.
- **Verification:** lint-guards typecheck 0; scopes-guard 5 GREEN; `pnpm lint:scopes` OK (20 clean).
- **Committed in:** `3a7160e9`

---

**Total deviations:** 1 auto-fixed (convention alignment)
**Impact on plan:** No scope creep. The guard enforces D-15 exactly and is wired into all three enforcement layers (npm/husky/CI).

## Issues Encountered
- CI workflow exists (`.github/workflows/ci.yml`) — added the `lint:scopes` step beside the existing guards (not LOCAL-ONLY-only enforcement after all).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- When Plan 76-08 adds `admin.directory.user` to the GWS adapter via the typed-const spread, the guard continues to pass (scope traced). If 76-08 inlined the scope literal instead, the guard would fail — exactly the drift it protects against.

---
*Phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-*
*Completed: 2026-05-31*
