---
phase: 91-theme-b-akta-osobowe-personnel-file
plan: 05
subsystem: retention
tags: [retention, personnel-file, akta-osobowe, personalakte, i9, soft-delete, data-purge, cron]

# Dependency graph
requires:
  - phase: 91-01
    provides: personnel-retention.test.ts RED scaffold (locked per-jurisdiction retention math)
  - phase: 91-02
    provides: PersonnelFile / PersonnelFileDocument Prisma models + PersonnelFileSection enum
  - phase: 91-03
    provides: per-jurisdiction section+rule registry (getPersonnelRetentionRules) + the 8 akta year tokens on RETENTION_YEARS
provides:
  - getPersonnelRetentionCutoff event-anchored resolver on the shared retention primitive (HIRE_DATE|TERMINATION_DATE|DOCUMENT_DATE + US I-9 max() + indefinite-while-active)
  - PersonnelFile + PersonnelFileDocument wired into the soft-delete guard (always soft-delete) and the data-purge cron (per-row anchor-driven exclusion)
  - Flat Document sweep made akta-hold-aware (a Document held by an active personnel window survives the 90-day sweep)
affects: [91-06, retention-resolver, gdpr-erasure, data-purge-cron]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Event-anchored retention resolver over the shared RETENTION_YEARS map (per-rule anchor + max() combinator + indefinite-while-active null cutoff)"
    - "Years read only from RETENTION_YEARS in production (single source, D-03); rule.years is a test-fixture-only override for unregistered tokens"
    - "Both deletion chokepoints route personnel rows: unconditional soft-delete at the ORM layer, windowed hard-delete in the cron via collect-ids-then-deleteMany"
    - "Fail-closed: an unknown jurisdiction / unclassified section / missing anchor holds the row (never purge)"

key-files:
  created:
    - packages/db/src/personnel-retention.ts
  modified:
    - packages/db/src/retention-policy.ts
    - packages/db/src/index.ts
    - packages/db/src/soft-delete.ts
    - apps/cron-worker/src/jobs/handlers/data-purge.ts
    - apps/cron-worker/package.json

key-decisions:
  - "Resolver homed in retention-policy.ts (not a standalone personnel-retention.ts module) — the 91-01 RED scaffold imports it from retention-policy.ts and its own comment states the resolver 'lands here rather than in a parallel module'; this also removes an import cycle. personnel-retention.ts is the personnel-facing re-export facade."
  - "Flat Document sweep excludes akta-held Documents — the retention hold lives on PersonnelFileDocument but the bytes live on Document, so without this a held file's bytes would be destroyed by the flat 90-day sweep (threat T-91-05-01 mitigation)."
  - "cron-worker gains a direct @contractor-ops/compliance-policy workspace dependency to resolve section rules by jurisdiction."

requirements-completed: [AKTA-02]

# Metrics
duration: ~17min
completed: 2026-07-01
---

# Phase 91 Plan 05: AKTA-02 Retention Engine Summary

**Event-anchored personnel-file retention resolver on the shared RETENTION_YEARS primitive (per-rule HIRE_DATE|TERMINATION_DATE|DOCUMENT_DATE anchor, US I-9 max(hire+3y, termination+1y), indefinite-while-active), wired into the soft-delete guard and the data-purge cron so personnel files only ever hard-delete past their per-row statutory window; turns personnel-retention.test.ts GREEN (11/11).**

## Performance

- **Duration:** ~17 min active (fresh worktree; most wall-clock in `pnpm install` + dist builds)
- **Started:** 2026-07-01T09:48Z
- **Completed:** 2026-07-01T10:05Z
- **Tasks:** 2 (committed as 3 atomic commits)
- **Files:** 6 (1 created, 5 modified)

## Accomplishments

- Built `getPersonnelRetentionCutoff(rules, dates) -> { erasable, retainUntil, citation }` on the shared retention primitive: resolves each rule's anchor date (HIRE_DATE/TERMINATION_DATE/DOCUMENT_DATE), computes `anchor + RETENTION_YEARS[recordType]`, and combines rules with `max()` so US I-9 keeps the later of hire+3y or termination+1y (8 CFR 274a.2).
- Indefinite-while-active honored: any rule whose required anchor is absent (an active employee has no termination date) makes the whole section indefinite — `retainUntil` null, never erasable (fail-closed).
- Verified the 8 akta year tokens are already registered on `RETENTION_YEARS` (added by 91-03) — not duplicated.
- Soft-delete chokepoint: `PersonnelFile` + `PersonnelFileDocument` added to `softDeleteModels`, so a delete at the ORM layer always converts to a soft delete (the windowed hard-delete is the cron's job, D-05).
- data-purge cron: per-row anchor-driven exclusion — collects erasable ids via the resolver and only hard-deletes those; children (`PersonnelFileDocument`) purge before parents (`PersonnelFile`); a file is purgeable only once all its documents are gone; a Document held by an active akta section is excluded from the flat 90-day Document sweep (R2 + DB).
- `personnel-retention.test.ts` GREEN 11/11; full db suite 190 passed / 0 regressions.

## Task Commits

1. **Task 1 — event-anchored resolver + export** — `ec7bc68ea` (feat)
2. **Task 2 (a) — relocate resolver onto the shared primitive (cycle-free)** — `498a045ac` (refactor)
3. **Task 2 (b) — route personnel rows through both deletion chokepoints** — `80ad13be6` (feat)

## Files Created/Modified

- `packages/db/src/retention-policy.ts` — added the `getPersonnelRetentionCutoff` resolver + its types (`RetentionAnchor`, `PersonnelRetentionRuleInput`, `PersonnelRetentionDates`, `PersonnelRetentionResult`) next to `RETENTION_YEARS` (single source).
- `packages/db/src/personnel-retention.ts` (new) — personnel-facing re-export facade for the resolver + types (one-way import from retention-policy.ts; no cycle).
- `packages/db/src/index.ts` — public exports of `getPersonnelRetentionCutoff` + the four retention types.
- `packages/db/src/soft-delete.ts` — `PersonnelFile` + `PersonnelFileDocument` in `softDeleteModels`.
- `apps/cron-worker/src/jobs/handlers/data-purge.ts` — akta-hold-aware flat Document sweep + PersonnelFileDocument (children) then PersonnelFile (parents) sweeps driven by the resolver; personnel purge metrics.
- `apps/cron-worker/package.json` (+ `pnpm-lock.yaml`) — direct `@contractor-ops/compliance-policy` workspace dependency.

## Decisions Made

- **Resolver on retention-policy.ts, facade in personnel-retention.ts.** The authoritative 91-01 RED scaffold does `import { getPersonnelRetentionCutoff } from '../retention-policy.js'` and its header states the resolver "lands here rather than in a parallel module." Homing the resolver there (a) satisfies the test import, (b) keeps years single-sourced from the same file that defines `RETENTION_YEARS`, and (c) removes the retention-policy ⇄ personnel-retention import cycle that a re-export-from-a-back-importing-module would create. `personnel-retention.ts` remains as the plan's named artifact — a thin re-export facade so personnel callers still import by name.
- **Years source + fixture fallback.** Production `PersonnelRetentionRule` (compliance-policy) carries no `years`, so the resolver reads `RETENTION_YEARS[recordType]` (single source, D-03). The test fixtures carry an explicit `years`, and the PL fixture uses an unregistered token (`pl-personnelfile-general`); the resolver falls back to `rule.years` only when the token is absent from the map, which never happens for registered production tokens.
- **File-level vs document-level windows in the cron.** DOCUMENT_DATE rules (DE accident records) are per-document and enforced on `PersonnelFileDocument`; the parent-file window uses only lifecycle-anchored (hire/termination) rules, so a file with no document date is not held forever.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Resolver homed in retention-policy.ts instead of personnel-retention.ts**
- **Found during:** Task 1 verification (full db suite) + Task 2 wiring.
- **Issue:** The plan's artifact places `getPersonnelRetentionCutoff` in `personnel-retention.ts` importing `RETENTION_YEARS` from `retention-policy.ts`, while the RED scaffold imports the resolver *from* `retention-policy.ts`. That triangle (retention-policy re-exports the resolver ⇄ personnel-retention imports RETENTION_YEARS) is a circular import.
- **Fix:** Defined the resolver in `retention-policy.ts` (where `RETENTION_YEARS` lives; matches the scaffold's stated intent) and made `personnel-retention.ts` a re-export facade. No behavior change; `RETENTION_YEARS[` now appears in retention-policy.ts rather than personnel-retention.ts.
- **Files:** `packages/db/src/retention-policy.ts`, `packages/db/src/personnel-retention.ts`
- **Commit:** `498a045ac`

**2. [Rule 3 - Blocking] cron-worker missing a direct compliance-policy dependency**
- **Found during:** Task 2 (data-purge needs `getPersonnelRetentionRules` / `getPersonnelSections` / `mapCountryCodeToJurisdiction`).
- **Issue:** cron-worker imported `@contractor-ops/compliance-policy` symbols with no direct workspace dependency.
- **Fix:** Added `"@contractor-ops/compliance-policy": "workspace:*"` to `apps/cron-worker/package.json` (internal workspace link — NOT a registry install).
- **Files:** `apps/cron-worker/package.json`, `pnpm-lock.yaml`
- **Commit:** `80ad13be6`

**3. [Rule 2 - Critical / threat T-91-05-01] Flat Document sweep made akta-hold-aware**
- **Found during:** Task 2 (data-purge design).
- **Issue:** The akta hold lives on `PersonnelFileDocument`, but the document bytes live on `Document`, which the flat 90-day Document sweep hard-deletes on `deletedAt` alone. Without a guard, a Document under an active personnel window would be destroyed by the flat sweep.
- **Fix:** Before the flat sweep, resolve each candidate Document's personnel retention and exclude held ones from both R2 cleanup and the DB delete. Mitigates the cron→tenant-data trust-boundary threat T-91-05-01.
- **Files:** `apps/cron-worker/src/jobs/handlers/data-purge.ts`
- **Commit:** `80ad13be6`

**Total:** 3 auto-fixed (2 Rule 3 blocking, 1 Rule 2 critical). No architectural (Rule 4) decisions.

## Issues Encountered

- **Fresh worktree had no `node_modules`.** Ran `pnpm install`; the `postinstall` `turbo build` aborts on the pre-existing `@contractor-ops/classification` build error (its test files import non-existent `../rule-set.js` / `../scoring.js`). Built `@contractor-ops/db` and `@contractor-ops/integrations` directly to validate typechecks (same workaround as 91-03/91-04). Logged, out of scope (see `deferred-items.md`).
- **db consumed via built `dist`, not `src`.** Rebuilt db dist so cron-worker resolves the new `getPersonnelRetentionCutoff` export.
- **Transient mis-run against the main checkout.** An early verification `cd`'d to the shared checkout (no worktree changes) and reported false failures; re-run inside the worktree is clean. No code impact.

## Deferred Issues

- **Pre-existing `@contractor-ops/classification` build failure cascades into `cron-worker` typecheck** (NOT this plan): `classification` has no `dist` (missing `rule-set.ts`/`scoring.ts` source), so `packages/api` classification-consuming files (`pdf-templates/ir35-sds.tsx`, `drv-defense-bundle.tsx`, `classification-shared.ts`, `classification-document-keys.ts` missing `US_DETERMINATION_LETTER`, plus implicit-`any` `q`/`ar`/`id` params) fail to resolve `@contractor-ops/classification`. These are the exact offenders in `deferred-items.md` (91-03/91-04). **Every reported cron-worker typecheck error is in `packages/api` classification land; zero are in `apps/cron-worker/src/`.** My db + cron-worker changes typecheck clean.
- **`packages/validators/src/legal/de.{js,d.ts}` build-artifact drift** — reformatted by the validators postinstall build in this fresh worktree; environmental noise, left unstaged (same as 91-03).

## Verification

- `pnpm --filter @contractor-ops/db test personnel-retention.test.ts` — GREEN 11/11 (PL/DE/UK/US, US I-9 max() both directions, active-employee indefinite, any-rule-indefinite).
- `pnpm --filter @contractor-ops/db test` — 190 passed / 6 skipped / 4 todo, 27 files (soft-delete + retention-policy suites unbroken).
- `pnpm --filter @contractor-ops/db typecheck` — clean.
- `pnpm --filter @contractor-ops/cron-worker typecheck` — only the pre-existing classification cascade in `packages/api`; no errors in `apps/cron-worker/src/`.

## Threat Flags

None — the only new surface (the data-purge personnel sweeps) is in the plan's `<threat_model>` (T-91-05-01) and is mitigated (fail-closed resolver + held-document exclusion).

## Known Stubs

None — the resolver and both chokepoints are fully wired and exercised by the GREEN test; no placeholder data paths.

## Next Phase Readiness

- **91-06 (GDPR/RODO erasure):** can call `getPersonnelRetentionCutoff` per section to produce per-section erasure dispositions with statutory citations; the citation is already surfaced by the resolver.
- **Doc-follows-code:** the personnel-file domain wiki synthesis is batched into the phase's dedicated wiki plan (mirrors 89-06 / 91-03/91-04 deferral). New/changed source files here are not referenced by any wiki page `verify_with`, so `check:wiki-brain` is not tripped.

## Self-Check: PASSED

- `packages/db/src/personnel-retention.ts` — FOUND
- Commit `ec7bc68ea` (Task 1 feat) — FOUND
- Commit `498a045ac` (Task 2 refactor) — FOUND
- Commit `80ad13be6` (Task 2 feat) — FOUND
- `personnel-retention.test.ts` — GREEN 11/11; full db suite 190 passed / 0 regressions

---
*Phase: 91-theme-b-akta-osobowe-personnel-file*
*Completed: 2026-07-01*
