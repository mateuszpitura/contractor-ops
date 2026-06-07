---
phase: 82-v7-0-foundation-add-on-billing-flag-registry-us-region-enabl
plan: 02
subsystem: multi-region-db-routing
tags: [us-region, feature-flags, region-lockstep, env-schema, FOUND7-03]
requirements: [FOUND7-03]
dependency_graph:
  requires:
    - "82-01 (RED scaffolds: region-lockstep.test.ts, v7-flags-registered.test.ts regionSchema assertion, feature-flag.test.ts)"
  provides:
    - "us-east-1 as a recognized third region across the five lockstep sites (SUPPORTED_REGIONS, DataRegion, regionSchema, REGION_ENV_MAP, REPLICA_ENV_MAP)"
    - "buildLazyBag US branch (no silent EU coercion) — data-residency safe"
    - "DATABASE_URL_US / DATABASE_URL_US_RO optional env vars"
    - "'payroll' flag category in flagCategorySchema (consumed by 82-03)"
  affects:
    - "82-03 (payroll.* flags register against the 'payroll' category added here)"
    - "82-04 (seed-dev.ts add-on grant — region-independent, not touched here)"
    - "Phase 83 US-INFRA (provisions DATABASE_URL_US; US seed-org path deferred)"
tech_stack:
  added: []
  patterns:
    - "Record<DataRegion,string> compile-time lockstep (region.ts + replica.ts)"
    - "Optional regional env var with lazy-throw-on-access (D-06)"
    - "Explicit US branch before fail-closed unknown->EU coercion"
key_files:
  created:
    - ".planning/milestones/v7.0-phases/82-.../deferred-items.md"
  modified:
    - "packages/db/src/region.ts"
    - "packages/db/src/replica.ts"
    - "packages/feature-flags/src/schemas.ts"
    - "packages/api/src/middleware/feature-flag.ts"
    - "packages/api/src/middleware/__tests__/feature-flag.test.ts"
    - "packages/validators/src/env.ts"
    - ".env.example"
    - "packages/db/scripts/migrate-all-regions.ts"
    - "packages/db/src/__tests__/region.test.ts"
decisions:
  - "regionSchema widened to EU/ME/US (5th lockstep place); jurisdictionSchema left EU/ME/ANY (US flags use jurisdiction:'ANY')"
  - "'payroll' category added here (this plan owns schemas.ts) so 82-03 needs no second writer to the file"
  - "DATABASE_URL_US OPTIONAL (D-06) — app boots clean locally; getRegionalClient('US') lazy-throws only on access"
  - "migrate-all-regions REGION_ENV_VARS US entry added manually (plain array, tsc does not force it; skip-on-missing safe)"
  - "seed-dev.ts US seed-org path NOT touched — deferred to Phase 83 per D-06/A5; owned by 82-04 for the region-independent add-on grant"
metrics:
  duration: "~9m"
  tasks_completed: 3
  files_changed: 9
  completed_date: "2026-06-07"
---

# Phase 82 Plan 02: US Region Enablement Summary

Enabled `us-east-1` as the third supported region across the five-way lockstep — a `region=US` request now resolves through `SUPPORTED_REGIONS` → `DataRegion` → `regionSchema` → `REGION_ENV_MAP` / `REPLICA_ENV_MAP` and `buildLazyBag` without a runtime throw or silent EU-coercion, with `DATABASE_URL_US` kept OPTIONAL so the app boots clean locally (FOUND7-03 / SC#3). Also added the `'payroll'` flag category so 82-03 registers payroll adapters without a second writer to `schemas.ts`.

## What Was Built

- **Task 1 — DB region lockstep (`a3fd886f`):** `region.ts` `SUPPORTED_REGIONS` gains `'US'` (the `DataRegion` union auto-propagates), `REGION_ENV_MAP['US']='DATABASE_URL_US'`; `replica.ts` `REPLICA_ENV_MAP['US']='DATABASE_URL_US_RO'`. Both maps are `Record<DataRegion,string>`, so tsc force-failed until each gained a US entry — the compile-time lockstep. `getRegionalClient`/`preWarmRegionalClients` left unmodified (their lazy-throw / skip-on-missing IS the D-06 behavior).
- **Task 2 — flags schema + middleware + env (`55a0c0a8`):** `schemas.ts` `regionSchema = z.enum(['EU','ME','US'])` (the hidden 5th lockstep place that lets the US bag pass downstream Zod) + `'payroll'` added to `flagCategorySchema` (D-09). `feature-flag.ts` `buildLazyBag` gains an explicit `else if (ctx.region === 'US')` branch BEFORE the unknown→EU fail-closed `else` (T-82-02-01: US must NOT silently coerce to EU). `validators/src/env.ts` gains `DATABASE_URL_US` + `DATABASE_URL_US_RO` as `.optional()` (mirrors the `_RO` pattern, D-06). `.env.example` documents both as optional/local-skip. Added a US-passthrough test to `feature-flag.test.ts` asserting no EU coercion.
- **Task 3 — migrate adjacent + green the lockstep test (`090572c1`):** `migrate-all-regions.ts` `REGION_ENV_VARS` gains `'DATABASE_URL_US'` (plain array — added manually, D-07; `migrateRegion` skips-on-missing). With all five sources now carrying US, the 82-01 `region-lockstep.test.ts` and `region.test.ts` go GREEN.

## Verification Results

- `pnpm typecheck` — all 17 tasks across db / feature-flags / api / validators successful (the `Record<DataRegion,string>` compile-time lockstep is satisfied). CI-canonical.
- `pnpm --filter @contractor-ops/db test region-lockstep` — GREEN (4 passed): SUPPORTED_REGIONS / REGION_ENV_MAP / REPLICA_ENV_MAP all hold `{EU,ME,US}`; `getRegionalClient('US')` is NOT an "Unsupported data region" throw (lazy missing-env only).
- `pnpm --filter @contractor-ops/db test region` — GREEN (11 passed): includes the updated EU/ME/US assertions.
- `pnpm --filter @contractor-ops/feature-flags exec vitest run v7-flags-registered -t "regionSchema lockstep"` — GREEN: `regionSchema.options` = `{EU,ME,US}` (the 5th source). (The V7_FLAG_KEYS / FLAGS / signoff cohort in the same file stays RED — that is 82-03's deliverable, not this plan's.)
- `pnpm --filter @contractor-ops/api test feature-flag` (middleware) — GREEN: ME, EU, unknown→EU, and the new US-passthrough cases all pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Stale test assertion] Updated `region.test.ts` EU/ME-only assertions**
- **Found during:** Task 3
- **Issue:** `region.test.ts` asserted `SUPPORTED_REGIONS` equals exactly `['EU','ME']` and that the unsupported-region error read `Supported: EU, ME`. Both assertions encoded the old two-region contract and broke once US was deliberately added (SC#3).
- **Fix:** Updated both assertions to `['EU','ME','US']` and `Supported: EU, ME, US`. The `preWarmRegionalClients` test (1 client warmed when only EU env set) still holds unchanged — US env is also unset, so it skips US too.
- **Files modified:** `packages/db/src/__tests__/region.test.ts`
- **Commit:** `090572c1`

**2. [Rule 2 - Missing critical test] Added US-passthrough test to `feature-flag.test.ts`**
- **Found during:** Task 2
- **Issue:** The buildLazyBag US branch is the security-load-bearing edit (T-82-02-01, data-residency). The existing test file covered ME / EU / unknown→EU but had no US case, so the no-EU-coercion guarantee was untested.
- **Fix:** Added a `region: 'US'` passthrough test mirroring the ME case, asserting `lazyFlagBag` is called with `region: 'US'` (not coerced to EU).
- **Files modified:** `packages/api/src/middleware/__tests__/feature-flag.test.ts`
- **Commit:** `55a0c0a8`

## Out-of-Scope (Deferred, NOT fixed)

Logged to `deferred-items.md`. Both pre-existing, unrelated to this plan's files:

- `packages/api/src/routers/__tests__/feature-flags.test.ts` fails to collect (0 tests) — its `vi.mock("@contractor-ops/db")` is missing a `prismaRaw` export that a transitively-imported compliance service now requires. Last touched by `ac66ff76` (before this plan); imports none of the files 82-02 modified.
- `pnpm check:no-process-env` reports ~25 pre-existing offender lines (158+ occurrences) across `apps/public-api/**` etc. None in files 82-02 modified — this plan's env access is via the Zod schema (correct, not flagged).

## Threat Model Outcome

- **T-82-02-01 (data-residency, Info Disclosure):** mitigated — explicit US branch BEFORE the unknown→EU `else`; covered by the new US-passthrough test.
- **T-82-02-02 (fail-open on missing DATABASE_URL_US):** preserved — `getRegionalClient` left unmodified; lazy-throws loudly on US access with no env (region-lockstep test asserts the missing-env throw, not an EU fallback).
- No new threat surface introduced (no new endpoints, auth paths, or schema-at-trust-boundary changes).

## Known Stubs

None. `DATABASE_URL_US` being unset locally is the designed optional state (D-06), not a stub.

## Self-Check: PASSED

- Files created/modified exist (verified via Edit/Write success + git commits).
- Commits exist: `a3fd886f`, `55a0c0a8`, `090572c1` (verified in `git log`).
- region-lockstep + region + feature-flag middleware tests GREEN; typecheck clean.
