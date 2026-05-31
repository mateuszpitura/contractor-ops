---
phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-
plan: 01
subsystem: testing
tags: [vitest, idp-saga, deprovisioning, signoff-registry, scaffolds, nyquist]

requires:
  - phase: 70
    provides: signoff-registry-flags (idp-deprovisioning gated namespace), IDP_AUDIT_ALLOWED_FIELDS, lint-guards package
  - phase: 71
    provides: "@date-fns/tz pin (D-07) reused verbatim by idp-saga cooldown"
provides:
  - "@contractor-ops/idp-saga workspace package (types + stubs for cooldown, run-status, provenance, gc)"
  - "19 RED/todo test scaffolds across idp-saga, integrations, api, logger, lint-guards, web-vite, cron-worker"
  - "idp-deprovisioning PENDING signoff registry entry (boot-time contract)"
affects: [76-02, 76-03, 76-04, 76-05, 76-06, 76-07, 76-08, 76-09, 76-10]

tech-stack:
  added: ["@contractor-ops/idp-saga package", "@date-fns/tz@^1.2.0 (idp-saga dep, converged with Phase 71)"]
  patterns: ["Wave 0 Nyquist RED-baseline scaffolds", "pure-helper package mirroring @contractor-ops/compliance-policy"]

key-files:
  created:
    - packages/idp-saga/package.json
    - packages/idp-saga/tsconfig.json
    - packages/idp-saga/vitest.config.ts
    - packages/idp-saga/src/{index,types,cooldown,run-status,provenance,gc}.ts
    - packages/idp-saga/src/__tests__/{cooldown,run-status,provenance,gc}.test.ts
    - packages/integrations/src/__tests__/deprovisionable-contract.test.ts
    - packages/integrations/src/adapters/__tests__/google-workspace-deprovision.test.ts
    - packages/integrations/src/adapters/__tests__/google-workspace-webhook-provenance.test.ts
    - packages/api/src/__tests__/deprovisioning-{start,retry,step-runner,eligibility}.test.ts
    - packages/api/src/__tests__/google-workspace-oauth-callback.test.ts
    - packages/logger/src/__tests__/idp-audit-logger-fields.test.ts
    - packages/lint-guards/src/scopes-guard/__tests__/run-guard.test.ts
    - apps/web-vite/src/components/integrations/__tests__/google-workspace-reconnect-banner-write-access.test.tsx
    - apps/web-vite/src/__tests__/no-reactivate-button.test.tsx
    - apps/cron-worker/src/__tests__/gc-provenance.test.ts
  modified:
    - packages/feature-flags/src/signoff-registry-flags.json

key-decisions:
  - "Mirrored @contractor-ops/compliance-policy (Phase 71 sibling) for package shape — extends tsconfig.node.json, moduleResolution Bundler, extensionless imports, noEmit"
  - "Pinned @date-fns/tz@^1.2.0 (the already-installed Phase 71 version) instead of the plan's stale ^1.4.1 — single-library convergence + avoids 7-day release-age block"
  - "Preserved all existing signoff-registry-flags.json entries (Phase 71/74) — the plan's '{} empty file' assumption was stale; added idp-deprovisioning as a new key"
  - "Adapted all apps/web → apps/web-vite paths; placed GC-provenance test under apps/cron-worker (cron migrated out of apps/web)"
  - "no-reactivate grep excludes __tests__ (shipped-UI scope) — confirms zero Reactivate-contractor matches in production source + locale messages"

patterns-established:
  - "Wave 0 RED baseline: 10 expectation-failures (cooldown 4 + run-status 6) + 32 it.todo + 8 logger RED + 1 GREEN grep + 2 GREEN signoff"

requirements-completed: [IDP-02, IDP-08, IDP-09, IDP-10, IDP-11, IDP-13, IDP-14, IDP-15]

duration: 9 min
completed: 2026-05-31
---

# Phase 76 Plan 01: Wave 0 RED Scaffolds + idp-saga Package Summary

**New `@contractor-ops/idp-saga` ESM package (typed stubs for cooldown/run-status/provenance/gc) plus 19 failing-test scaffolds across 7 packages and the `idp-deprovisioning` PENDING signoff entry — a deterministic RED baseline mapping 1:1 to Phase 76's 8 success criteria.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-31T14:32:51Z
- **Completed:** 2026-05-31T14:41:30Z
- **Tasks:** 8
- **Files created:** 25 (+ 1 modified)

## Accomplishments
- `@contractor-ops/idp-saga` workspace package compiles (typecheck green) with conservative stubs for `canStartDeprovisioning`, `deriveRunStatus`, `provenanceLookup`, `insertProvenance`, `gcExpiredProvenance` + full type surface.
- 19 test scaffolds: 10 expectation-failures (idp-saga cooldown 4 + run-status 6) + 8 logger allow-list RED + 32 `it.todo` across integrations/api/lint-guards/web-vite/cron + 1 GREEN no-reactivate grep + 2 GREEN signoff-entry assertions.
- `idp-deprovisioning` PENDING signoff entry shipped (existing Phase 71/74 entries preserved).
- Monorepo-wide `pnpm typecheck` exits 0 (43/43 tasks).

## Task Commits

1. **76-01-01..03: package skeleton + types + stubs** — `0587e6d3` (feat)
2. **76-01-04: idp-saga RED test scaffolds** — `938afab7` (test)
3. **76-01-05: integration/saga test scaffolds** — `1d0e84c5` (test)
4. **76-01-06: idp-deprovisioning signoff entry + test** — `165f12be` (feat)
5. **76-01-07: supporting-package scaffolds** — `3606f2ed` (test)

## Files Created/Modified
See frontmatter `key-files`. New package `packages/idp-saga/` (9 source/config files + 4 tests); 14 test scaffolds across existing packages; 1 JSON entry.

## Decisions Made
See frontmatter `key-decisions`. Most material: path adaptation for the post-migration tree (`apps/web` deleted → `apps/web-vite`; cron → `apps/cron-worker`), `@date-fns/tz` version convergence, and preserving the non-empty signoff registry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] no-reactivate grep self-matched the test file**
- **Found during:** Task 76-01-07 verification
- **Issue:** Plan's grep scanned `src` which includes the test's own forbidden-phrase strings → test failed against itself (plan assumed it would be GREEN).
- **Fix:** Added `--exclude-dir=__tests__` so the guard scans shipped UI source + locale messages only (the true SC#7 intent).
- **Files modified:** apps/web-vite/src/__tests__/no-reactivate-button.test.tsx
- **Verification:** `pnpm --filter @contractor-ops/web-vite test no-reactivate-button` → 1 passed + 2 todo. Confirmed zero real Reactivate-contractor matches in production source.
- **Committed in:** `3606f2ed`

**2. [Rule 3 - Path drift] Stale apps/web + flat-router paths adapted to current tree**
- **Found during:** Tasks 76-01-05 / 76-01-07
- **Issue:** Plan authored pre-migration referenced deleted `apps/web/...` and `apps/web/src/app/api/cron/reminders/...`.
- **Fix:** `apps/web` → `apps/web-vite`; GC-provenance test placed under `apps/cron-worker/src/__tests__/` (cron migrated). Package config mirrored the real `compliance-policy` sibling (tsconfig.node.json, Bundler resolution, `@date-fns/tz@^1.2.0`).
- **Verification:** All scaffolds run under their packages' vitest include globs; monorepo typecheck 43/43.
- **Committed in:** package + scaffold commits above

---

**Total deviations:** 2 auto-fixed (1 bug, 1 path-drift adaptation)
**Impact on plan:** Path adaptation was mandatory post-migration; no scope creep. RED baseline matches the plan's intended shape exactly.

## Issues Encountered
- **Pre-existing CI-guard failures (NOT introduced by this plan):** `pnpm lint:schema` fails on `auth.prisma:111 UserPinnedView` (from Phase 75 commit `ab3e396c`) and `pnpm lint:logs` fails on a `csp-report` body log. Plan 76-01 touched neither schema nor any log statement. Left untouched per the scope-boundary deviation rule. `pnpm i18n:parity` passes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 0 RED baseline established. Wave 1 (76-02 schema, 76-03 interface/scopes) can flip its tests GREEN.
- `@contractor-ops/idp-saga` types are importable by downstream packages.

---
*Phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-*
*Completed: 2026-05-31*
