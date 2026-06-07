---
phase: 82-v7-0-foundation-add-on-billing-flag-registry-us-region-enabl
verified: 2026-06-07T21:35:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 82: Foundation — Add-On Billing, Flag Registry, US Region Enablement Verification Report

**Phase Goal:** The shared billing, feature-flag, and region primitives that gate every revenue-bearing and US-data surface exist before any theme work begins.
**Verified:** 2026-06-07T21:35:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC#1 (FOUND7-01): `requireAddOn('workforce'|'us-cross-border')` returns a structured `ADD_ON_REQUIRED` FORBIDDEN error for an org lacking the add-on and proceeds for one holding it; composes AFTER `requireTier('STARTER')`; `Subscription.addOns` exists in billing.prisma; `ADD_ON_REQUIRED` branch in public-api error-handler; owner-gated audit-logged cache-invalidating `grantAddOn` mutation exists | VERIFIED | `packages/api/src/middleware/add-on.ts` implements `requireAddOn` cloning tier.ts shape; `workforceProcedure`/`usCrossBorderProcedure` chain `requireTier('STARTER') -> requireAddOn`; billing.prisma line 17 `addOns String[] @default([])`; error-handler.ts line 59 `ADD_ON_REQUIRED` branch; billing.ts line 371 `grantAddOn` with `writeAuditLog` + `invalidate(CacheKeys.subscription(orgId))`; 6/6 add-on tests GREEN; 22/22 error-handler tests GREEN; 24/24 billing tests GREEN |
| 2 | SC#2 (FOUND7-02): App boots with all 19 v7.0 flags registered PENDING; `assertFlagSignoffsOrExit()` is CALLED at boot in apps/api, apps/public-api, AND apps/cron-worker; exits(1) on missing gated v7.0 flag; `FLAG_SIGNOFF_BYPASS=local` downgrades to warn | VERIFIED | All three entrypoints import and call `assertFlagSignoffsOrExit()` (apps/api:8/47, public-api:9/78, cron-worker:6/43); 19 PENDING entries in signoff-registry-flags.json confirmed; `V7_FLAG_KEYS` exports exactly 19 entries in flags-core.ts; 42/42 v7-flags tests GREEN; 7/8 boot-gate tests GREEN (1 pre-existing synthetic-key failure — known-acceptable, pre-dates Phase 82) |
| 3 | SC#3 (FOUND7-03): `region=US` resolves through SUPPORTED_REGIONS, DataRegion, DATABASE_URL_US, and buildLazyBag without a runtime throw or silent EU-coercion; 5-way lockstep (SUPPORTED_REGIONS / regionSchema.options / REGION_ENV_MAP / REPLICA_ENV_MAP / migrate-all-regions) all include US; lockstep test asserts all sources in sync; `buildLazyBag` has explicit US branch | VERIFIED | region.ts line 8 `SUPPORTED_REGIONS = ['EU','ME','US']` + line 20 `US:'DATABASE_URL_US'`; replica.ts line 77 `US:'DATABASE_URL_US_RO'`; schemas.ts line 24 `regionSchema = z.enum(['EU','ME','US'])`; feature-flag.ts lines 31-35 explicit `else if (ctx.region === 'US')` BEFORE unknown→EU fallback; migrate-all-regions.ts line 43 `REGION_ENV_VARS` includes `'DATABASE_URL_US'`; 4/4 region-lockstep tests GREEN; 11/11 region tests GREEN; 7/7 feature-flag middleware tests GREEN (US-passthrough case) |
| 4 | SC#4: `IRIS-TCC-ENROLLMENT.md` exists in the phase dir, records ~45-day lead + concrete start date, cross-links Phase 86 (US-FORM-05) | VERIFIED | File exists at `.planning/milestones/v7.0-phases/82-.../IRIS-TCC-ENROLLMENT.md`; "45" present (lead time + table row); "Phase 86" and "US-FORM-05" present; `Started: 2026-06-07`, `Earliest ready: 2026-07-22`; LOCAL-ONLY annotation present |

**Score: 4/4 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api/src/middleware/add-on.ts` | `requireAddOn` factory + workforceProcedure/usCrossBorderProcedure | VERIFIED | EXISTS + SUBSTANTIVE + WIRED: 71 lines; implements `requireAddOn`, exports convenience procedures; imported and called in billing tests |
| `packages/api/src/constants/add-ons.ts` | `ADD_ON_KEYS = ['workforce','us-cross-border']` | VERIFIED | EXISTS + SUBSTANTIVE + WIRED: imports used in add-on.ts, billing.ts |
| `packages/db/prisma/schema/billing.prisma` | `Subscription.addOns String[] @default([])` | VERIFIED | EXISTS: line 17 confirmed; client regenerated; live dev DB column present |
| `packages/api/src/routers/finance/billing.ts` | owner-gated audit-logged cache-invalidating `grantAddOn` mutation | VERIFIED | EXISTS + SUBSTANTIVE + WIRED: lines 371-420; `adminProcedure`, `writeAuditLog`, `invalidate(CacheKeys.subscription)` all present; 6 grantAddOn tests GREEN |
| `apps/public-api/src/lib/error-handler.ts` | `ADD_ON_REQUIRED` branch in extractErrorDetails | VERIFIED | EXISTS + WIRED: line 59 `if (parsed.type === 'ADD_ON_REQUIRED')` returns `{code:'ADD_ON_REQUIRED', ...}`; rides FORBIDDEN→403 map; 22 tests GREEN |
| `packages/feature-flags/src/flags-core.ts` | 19 dot-namespaced v7.0 FLAGS + exported `V7_FLAG_KEYS` cohort | VERIFIED | EXISTS + SUBSTANTIVE: V7_FLAG_KEYS lines 399-420, exactly 19 entries; `as const satisfies readonly FlagKey[]` |
| `packages/feature-flags/src/signoff-registry-flags.json` | 19 PENDING signoff entries keyed identically to FLAGS | VERIFIED | EXISTS: Python count confirms 19 v7.0 PENDING entries; all match V7_FLAG_KEYS exactly |
| `packages/feature-flags/src/signoff-registry-flags.ts` | v7.0 gated namespace prefixes in GATED_FLAG_NAMESPACE_PREFIXES | VERIFIED | EXISTS: 10 prefixes added (module.us-, module.workforce-, module.iris-, module.public-api, module.outbound-, integration.personio-, integration.bamboohr-, integration.marketplace-, payments.ach-, payroll.) |
| `apps/api/src/index.ts` | `assertFlagSignoffsOrExit()` call at boot | VERIFIED | EXISTS + WIRED: import line 8, call line 47 (in main(), before buildServer) |
| `apps/public-api/src/index.ts` | `assertFlagSignoffsOrExit()` call at boot | VERIFIED | EXISTS + WIRED: import line 9, call line 78 (after required-env loop, before preWarmRegionalClients) |
| `apps/cron-worker/src/index.ts` | `assertFlagSignoffsOrExit()` call at boot | VERIFIED | EXISTS + WIRED: import line 6, call line 43 (in main(), before scheduling jobs) |
| `packages/db/src/region.ts` | SUPPORTED_REGIONS incl. US + REGION_ENV_MAP['US'] | VERIFIED | EXISTS + SUBSTANTIVE: line 8 `['EU','ME','US'] as const`, line 20 `US:'DATABASE_URL_US'` |
| `packages/db/src/replica.ts` | REPLICA_ENV_MAP['US']='DATABASE_URL_US_RO' | VERIFIED | EXISTS + SUBSTANTIVE: line 77 `US:'DATABASE_URL_US_RO'` |
| `packages/feature-flags/src/schemas.ts` | `regionSchema = z.enum(['EU','ME','US'])` + `'payroll'` in flagCategorySchema | VERIFIED | EXISTS: line 24 `z.enum(['EU','ME','US'])`; payroll category confirmed present |
| `packages/api/src/middleware/feature-flag.ts` | `buildLazyBag` US branch — no EU coercion | VERIFIED | EXISTS + WIRED: explicit `else if (ctx.region === 'US') region = 'US'` before unknown→EU; US-passthrough test GREEN |
| `packages/validators/src/env.ts` | `DATABASE_URL_US` optional | VERIFIED | EXISTS: line 38 `DATABASE_URL_US: z.string().min(1).optional()` |
| `.env.example` | `DATABASE_URL_US` documented | VERIFIED | EXISTS: lines 72+84 with optional/empty values |
| `packages/db/scripts/migrate-all-regions.ts` | REGION_ENV_VARS includes DATABASE_URL_US | VERIFIED | EXISTS: line 43 `REGION_ENV_VARS = ['DATABASE_URL_EU','DATABASE_URL_ME','DATABASE_URL_US']`; skip-on-missing safe |
| `IRIS-TCC-ENROLLMENT.md` | SC#4 IRIS TCC enrollment ops doc | VERIFIED | EXISTS: "45" (×multiple), "Phase 86", "US-FORM-05", "Started: 2026-06-07", "Earliest ready: 2026-07-22" |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/api/src/middleware/add-on.ts requireAddOn` | `getSubscription(orgId).addOns` | same Redis-cached read as requireTier | WIRED | `getSubscription` imported and called; `addOns` read from returned subscription object |
| `packages/api/src/routers/finance/billing.ts grantAddOn` | `CacheKeys.subscription(orgId)` | `invalidate(CacheKeys.subscription(...))` after DB write | WIRED | `await invalidate(CacheKeys.subscription(ctx.organizationId))` present post-transaction |
| `apps/{api,public-api,cron-worker}/src/index.ts` | `assertFlagSignoffsOrExit()` | boot-time call after env load, before serving | WIRED | grep confirms call in all three files |
| `GATED_FLAG_NAMESPACE_PREFIXES` | the 19 v7.0 FLAGS keys | `isGatedFlag` prefix match | WIRED | 10 v7.0 prefixes in GATED_FLAG_NAMESPACE_PREFIXES covering all 19 keys |
| `packages/db/src/region.ts SUPPORTED_REGIONS` | `REGION_ENV_MAP / REPLICA_ENV_MAP` | `Record<DataRegion,string>` compile-time lockstep | WIRED | Both maps are `Record<DataRegion,string>`; adding US to union forced both map entries |
| `packages/api/src/middleware/feature-flag.ts buildLazyBag` | `packages/feature-flags/src/schemas.ts regionSchema` | US bag passes downstream Zod validation | WIRED | regionSchema includes US; explicit US branch produces US-region bag |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `requireAddOn` middleware | `currentAddOns` | `getSubscription(orgId)` → Redis cache → DB `Subscription.addOns` | Yes — DB column present, client regenerated | FLOWING |
| `grantAddOn` mutation | `nextAddOns` | DB read + merge → `tx.subscription.update` | Yes — transactional DB write | FLOWING |
| `buildLazyBag` US branch | `region: 'US'` bag | `ctx.region === 'US'` from tenant middleware | Yes — non-coerced US region returned | FLOWING |
| `assertFlagSignoffsOrExit()` at boot | PENDING signoff entries | `signoff-registry-flags.json` (19 entries) | Yes — all 19 present, gate returns true | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `requireAddOn` deny/allow + chain-order | `pnpm --filter @contractor-ops/api test add-on` | 6/6 passed | PASS |
| REST ADD_ON_REQUIRED → 403 | `pnpm --filter @contractor-ops/public-api test error-handler` | 22/22 passed | PASS |
| grantAddOn owner-gate + audit + cache invalidation | `pnpm --filter @contractor-ops/api test billing` | 24/24 passed (incl. 6 new grantAddOn cases) | PASS |
| 19 v7.0 flags in FLAGS + signoff registry | `pnpm --filter @contractor-ops/feature-flags test v7-flags` | 42/42 passed | PASS |
| Boot-gate exit-on-missing + bypass + v7.0-cohort cases | `pnpm --filter @contractor-ops/feature-flags test boot-gate` | 7/8 passed (1 pre-existing synthetic-key failure — known-acceptable, pre-dates Phase 82) | PASS |
| 5-way region lockstep incl. US | `pnpm --filter @contractor-ops/db test region-lockstep` | 4/4 passed | PASS |
| getRegionalClient US no-throw | `pnpm --filter @contractor-ops/db test region` | 11/11 passed | PASS |
| buildLazyBag US no-EU-coercion | `pnpm --filter @contractor-ops/api test feature-flag` | 7/7 middleware tests passed (1 pre-existing router test fails to collect — known-acceptable, pre-dates Phase 82) | PASS |
| IRIS-TCC-ENROLLMENT.md doc-presence | `test -f + grep '45' + grep 'US-FORM-05\|Phase 86'` | PASS | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| FOUND7-01 | 82-04 | `requireAddOn` middleware + ADD_ON_KEYS + grantAddOn mutation + REST error mapping | SATISFIED | `add-on.ts`, `constants/add-ons.ts`, `billing.ts grantAddOn`, `error-handler.ts ADD_ON_REQUIRED` branch all present and tested GREEN |
| FOUND7-02 | 82-03 | 19 v7.0 flags PENDING + boot-gate wired in all three apps | SATISFIED | `flags-core.ts` V7_FLAG_KEYS (19), `signoff-registry-flags.json` (19 PENDING), `assertFlagSignoffsOrExit()` called in api/public-api/cron-worker |
| FOUND7-03 | 82-02 | US region lockstep (5 sites) + buildLazyBag US branch + DATABASE_URL_US optional | SATISFIED | region.ts, replica.ts, schemas.ts, feature-flag.ts, migrate-all-regions.ts all carry US; env.ts optional; lockstep test GREEN |

---

### Known-Acceptable Pre-Existing Issues (NOT counted as gaps)

Per explicit guidance from the verification prompt:

1. **`boot-gate.test.ts` "synthetic gated key" case is RED (1/8):** The test at line 82 asserts `getFlagSignoff('compliance-portal-self-service') === undefined`, but that key received a PENDING entry in Phase 73 (`6fc2b8f3`). This pre-exists Phase 82 and is unrelated to the 19 v7.0 keys (all Phase-82 v7.0-cohort cases are GREEN at 7/8). Documented in deferred-items.md.

2. **`prisma migrate dev` blocked by pre-existing migration-history drift:** `Subscription.addOns` was applied via idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + `prisma generate`. Column verified present in live dev DB via `information_schema`; generated Prisma client carries `addOns`. Per-region production apply is a deferred post-merge item.

3. **`pnpm lint:logs` pre-existing offense in `apps/api/src/routes/csp-report.ts`:** This file was not touched by Phase 82. Phase 82 additions are lint-clean.

4. **`packages/api/src/routers/__tests__/feature-flags.test.ts` fails to collect (0 tests):** Pre-existing `prismaRaw` mock issue from `ac66ff76`, before Phase 82. The Phase 82 `feature-flag.test.ts` (middleware, SC#3 US-passthrough) passes 7/7.

---

### Anti-Patterns Found

No blockers or warnings. All files modified by Phase 82 scanned clean:

- Zero `TBD`/`FIXME`/`XXX` markers in source files
- Zero `console.*` in production source files
- No stubs: `requireAddOn` is fully implemented, `grantAddOn` is fully implemented, all three app entrypoints call the gate
- No hollow props or disconnected data flows

---

### Human Verification Required

None. Phase 82 is pure middleware/infra — all four success criteria have automated verification via vitest and the existing test suite. No user-facing UI shipped; no manual flows to verify.

---

## Gaps Summary

No gaps. All four success criteria are verified in the actual codebase:

- SC#1 (FOUND7-01): `requireAddOn` middleware, `Subscription.addOns`, `grantAddOn` mutation, and REST error branch are all present, wired, and tested GREEN.
- SC#2 (FOUND7-02): 19 v7.0 flags registered PENDING; `assertFlagSignoffsOrExit()` wired into all three app entrypoints — the load-bearing fix that was previously UNWIRED.
- SC#3 (FOUND7-03): 5-way region lockstep confirmed; `buildLazyBag` has explicit US branch (no silent EU coercion); all lockstep tests GREEN.
- SC#4: `IRIS-TCC-ENROLLMENT.md` exists, contains "45", cross-links Phase 86 / US-FORM-05, records `Started: 2026-06-07`.

---

_Verified: 2026-06-07T21:35:00Z_
_Verifier: Claude (gsd-verifier)_
