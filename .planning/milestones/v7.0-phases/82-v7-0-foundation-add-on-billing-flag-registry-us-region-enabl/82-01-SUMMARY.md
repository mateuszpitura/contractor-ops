---
phase: 82
plan: 01
subsystem: foundation-validation-scaffold
tags: [tdd-red, wave-0, add-on-billing, feature-flags, us-region, iris-tcc]
requires: []
provides:
  - "RED test scaffolds for FOUND7-01 (add-on + REST error-handler), FOUND7-02 (v7 flags + boot-gate), FOUND7-03 (US region lockstep)"
  - "IRIS-TCC-ENROLLMENT.md ops doc (SC#4 / D-08) — started ~45-day TCC calendar dependency"
affects:
  - "82-02 (US region + regionSchema US) turns region-lockstep + v7-flags regionSchema cases GREEN"
  - "82-03 (V7_FLAG_KEYS + 19 FLAGS + signoff entries + gated prefixes) turns v7-flags + boot-gate cases GREEN"
  - "82-04 (requireAddOn middleware + error-handler ADD_ON_REQUIRED branch) turns add-on + error-handler cases GREEN"
tech-stack:
  added: []
  patterns:
    - "TDD RED-first: failing test scaffolds encode downstream contracts before implementation"
    - "Compile-time + cross-package region lockstep (Record<DataRegion,string> + regionSchema split across packages)"
key-files:
  created:
    - packages/api/src/middleware/__tests__/add-on.test.ts
    - packages/db/src/__tests__/region-lockstep.test.ts
    - packages/feature-flags/src/__tests__/v7-flags-registered.test.ts
    - .planning/milestones/v7.0-phases/82-v7-0-foundation-add-on-billing-flag-registry-us-region-enabl/IRIS-TCC-ENROLLMENT.md
  modified:
    - apps/public-api/src/lib/__tests__/error-handler.test.ts
    - packages/feature-flags/src/__tests__/boot-gate.test.ts
decisions:
  - "error-handler.test.ts already existed → extended with an ADD_ON_REQUIRED describe block rather than recreated (matches the boot-gate 'extend' pattern in the plan)"
  - "5-way region lockstep split: db-reachable sources (SUPPORTED_REGIONS + getRegionalClient/getReplicaClient) asserted in packages/db; regionSchema.options (5th source) asserted in feature-flags — no new package dependency edge introduced (avoids Rule-4 architectural change)"
  - "boot-gate v7.0 cohort cases drive the gate via V7_FLAG_KEYS + helpers (isGatedFlag/getFlagSignoff) rather than mutating the typed FLAGS const — preserves the typed-constant principle the existing suite documents"
metrics:
  duration: ~10m
  completed: 2026-06-07
---

# Phase 82 Plan 01: Wave 0 Test Scaffolds + IRIS TCC Ops Doc Summary

Created the five RED test scaffolds enumerated in 82-VALIDATION.md (one new + four new/extended) so 82-02/03/04 each have an automated verify to sample against, plus the IRIS TCC enrollment ops doc recording the ~45-day lead as a started calendar dependency (SC#4 / D-08). No production code implemented — RED is the intended Wave 0 state.

## What Was Built

### Task 1 — IRIS TCC enrollment ops doc (SC#4)
`IRIS-TCC-ENROLLMENT.md` records: why a NEW IRIS A2A TCC is required (FIRE decommissions 2026-12-31, FIRE TCC does not carry over, TY2026 returns filed early 2027 must use IRIS XML A2A); the ~45-day lead time (literal "45"); a concrete `Started: 2026-06-07` with `Earliest ready: 2026-07-22` framed as a started calendar dependency; the real-world IRS e-Services steps (ID.me identity verification, Responsible Official designation, IRIS Application for TCC); and an explicit cross-link to Phase 86 (US-FORM-05). Annotated LOCAL-ONLY (real-world founder ops action; no app code files anything until Phase 86; no in-app onboarding task seeded — no product theater per D-08).

Verify: `test -f … && grep -q '45' … && grep -qi 'US-FORM-05|Phase 86' …` → PASS.

### Task 2 — add-on + error-handler RED stubs (SC#1)
- `add-on.test.ts` (new): asserts `ADD_ON_KEYS = ['workforce','us-cross-border']`; `requireAddOn('workforce')` deny → `TRPCError FORBIDDEN` with `{ type:'ADD_ON_REQUIRED', requiredAddOn, currentAddOns }`; allow path passes through; `workforceProcedure`/`usCrossBorderProcedure` compose `requireTier('STARTER')` BEFORE `requireAddOn` (D-11 chain order, asserted via TIER_REQUIRED-first then ADD_ON_REQUIRED). Mirrors `tier.test.ts` mocking (`getSubscription`, `@contractor-ops/db`, cache, logger, sentry). RED: `Cannot find module '../add-on'`.
- `error-handler.test.ts` (extended): new `ADD_ON_REQUIRED` describe block — `extractErrorDetails` should return `code:'ADD_ON_REQUIRED'` and ride FORBIDDEN→403. RED on the code-extraction case (branch absent → raw fall-through); the 403-status case already holds (FORBIDDEN→403 map is unconditional). 21 existing tests stay GREEN.

### Task 3 — region-lockstep + v7-flags + boot-gate RED stubs (SC#2/SC#3)
- `region-lockstep.test.ts` (new, packages/db): `SUPPORTED_REGIONS` set == {EU,ME,US}; `getRegionalClient('US')` / `getReplicaClient('US')` must NOT throw "Unsupported data region" (lazy missing-env only). RED: US absent → "Unsupported data region: US".
- `v7-flags-registered.test.ts` (new, feature-flags): `V7_FLAG_KEYS` length 19, matches canonical D-09 set, all dot-namespaced; each key present in `FLAGS` ∧ `getFlagSignoff(key) !== undefined`; `regionSchema.options` == {EU,ME,US} (5th lockstep source). RED: `V7_FLAG_KEYS` not exported + keys/entries/US absent.
- `boot-gate.test.ts` (extended): v7.0 cohort gated + has-entry; gated-cohort-missing trips `process.exit(1)`; `FLAG_SIGNOFF_BYPASS=local` downgrades to warn. RED: `V7_FLAG_KEYS` undefined. 4 existing tests stay GREEN.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] error-handler.test.ts already existed → extended, not created**
- **Found during:** Task 2
- **Issue:** The plan's `files_modified` + Task 2 action said "Create … error-handler.test.ts", but a comprehensive suite already exists (TRPC_TO_HTTP map, TIER_REQUIRED, Zod, plain-Error).
- **Fix:** Extended it with an `ADD_ON_REQUIRED` describe block (the SC#1 REST-mapping scaffold), matching the plan's own "extend boot-gate.test.ts" pattern. No existing assertions touched.
- **Files modified:** apps/public-api/src/lib/__tests__/error-handler.test.ts
- **Commit:** b1d35a0a

**2. [Rule 3 - Blocking] 5-way region lockstep split across two packages (no new dependency)**
- **Found during:** Task 3
- **Issue:** The plan's region-lockstep behavior names four sources incl. `regionSchema.options`, but `regionSchema` lives in `@contractor-ops/feature-flags` and `packages/db` has no dependency edge to it (adding one would be a Rule-4 architectural change the plan does not authorize).
- **Fix:** Asserted db-reachable sources (`SUPPORTED_REGIONS` + `getRegionalClient`/`getReplicaClient` accept US, covering `REGION_ENV_MAP`/`REPLICA_ENV_MAP` whose `Record<DataRegion,string>` typing is the compile-time lockstep) in `packages/db/region-lockstep.test.ts`; asserted the `regionSchema.options` 5th source in `feature-flags/v7-flags-registered.test.ts`. Both documented inline.
- **Files modified:** packages/db/src/__tests__/region-lockstep.test.ts, packages/feature-flags/src/__tests__/v7-flags-registered.test.ts
- **Commit:** 8470ab50

## TDD Gate Compliance

Tasks 2 and 3 are `tdd="true"` RED scaffolds with no implementation by design (the GREEN phase is owned by 82-02/03/04). Per `<plan_intent>`, RED is the accepted Wave-0 end state for these stubs, so there is no `feat(...)` GREEN commit in this plan — the RED `test(...)` commits (b1d35a0a, 8470ab50) are the intended terminal state. This is a deliberate cross-plan TDD cycle, not a missing GREEN gate.

## Verification Results

| File | Command | Result | RED reason (Wave 0) |
|------|---------|--------|---------------------|
| IRIS-TCC-ENROLLMENT.md | `test -f && grep '45' && grep 'US-FORM-05\|Phase 86'` | PASS | n/a (doc) |
| add-on.test.ts | `pnpm --filter @contractor-ops/api test add-on` | RED (collects) | `Cannot find module '../add-on'` (82-04) |
| error-handler.test.ts | `pnpm --filter @contractor-ops/public-api test error-handler` | 21 GREEN / 1 RED | ADD_ON_REQUIRED branch absent (82-04) |
| region-lockstep.test.ts | `pnpm --filter @contractor-ops/db test region-lockstep` | RED (collects) | US not in SUPPORTED_REGIONS (82-02) |
| v7-flags-registered.test.ts | `pnpm --filter @contractor-ops/feature-flags test v7-flags` | RED (collects) | V7_FLAG_KEYS/FLAGS/signoff/regionSchema US absent (82-02/03) |
| boot-gate.test.ts | `pnpm --filter @contractor-ops/feature-flags test boot-gate` | 4 GREEN / 4 RED | V7_FLAG_KEYS undefined (82-03) |

No production source modified — diff is test files + the ops doc only.

## Known Stubs

None that block the plan's goal. All five test files are intentional RED scaffolds (Wave 0 contract encoding); the IRIS doc is the complete SC#4 artifact. The RED state is the documented intent — 82-02/03/04 turn each GREEN.

## Commits

- `dbb6037c` — docs(82-01): author IRIS TCC enrollment ops doc (SC#4 / D-08)
- `b1d35a0a` — test(82-01): scaffold add-on + error-handler RED stubs (SC#1 Wave 0)
- `8470ab50` — test(82-01): scaffold region-lockstep + v7-flags + boot-gate RED stubs (SC#2/SC#3 Wave 0)

## Self-Check: PASSED

All 7 artifacts (5 test files + IRIS doc + SUMMARY) exist on disk; all 3 task commits (dbb6037c, b1d35a0a, 8470ab50) present in git history.
