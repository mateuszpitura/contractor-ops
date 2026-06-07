---
phase: 82-v7-0-foundation-add-on-billing-flag-registry-us-region-enabl
plan: 04
subsystem: add-on-entitlement
tags: [add-on-billing, requireAddOn, tier-middleware-clone, audit-log, cache-invalidation, FOUND7-01]
requirements: [FOUND7-01]
dependency_graph:
  requires:
    - "82-01 (RED scaffolds: add-on.test.ts; error-handler.test.ts ADD_ON_REQUIRED block)"
    - "82-02 (region work — independent; add-on grant is region-agnostic)"
  provides:
    - "Subscription.addOns String[] @default([]) column (live dev DB + generated client)"
    - "requireAddOn(addOn) tRPC middleware (clones tier.ts) → structured ADD_ON_REQUIRED FORBIDDEN"
    - "ADD_ON_KEYS=['workforce','us-cross-border'] single source of truth (packages/api/src/constants/add-ons.ts)"
    - "workforceProcedure / usCrossBorderProcedure (tenant → requireTier('STARTER') → requireAddOn)"
    - "owner-gated audit-logged cache-invalidating billing.grantAddOn mutation"
    - "public-api error-handler ADD_ON_REQUIRED → 403 JSON branch"
    - "dev seed grant (QA-default org carries both add-ons)"
  affects:
    - "Theme B (Workforce surfaces) gate via workforceProcedure"
    - "Theme A (US Cross-Border surfaces) gate via usCrossBorderProcedure"
    - "Future Stripe add-on SKU / checkout / webhook-entitlement-sync (DEFERRED — this ships the primitive, not the purchase flow)"
tech_stack:
  added: []
  patterns:
    - "Structured tRPC error as JSON-in-message with a `type` discriminator (clones TIER_REQUIRED)"
    - "Middleware clone (requireAddOn from requireTier) — tier.ts stays single-responsibility"
    - "Owner-gate via existing adminProcedure (= organization:update) + writeAuditLog(tx)"
    - "Redis-cache invalidation on non-Stripe billing write (Pitfall 3)"
    - "Lowercase wire-key TS const over a Prisma enum (avoids UPPER_SNAKE + display-map ceremony)"
key_files:
  created:
    - "packages/api/src/constants/add-ons.ts"
    - "packages/api/src/middleware/add-on.ts"
    - ".planning/milestones/v7.0-phases/82-.../82-04-SUMMARY.md"
  modified:
    - "packages/db/prisma/schema/billing.prisma"
    - "packages/db/src/generated/prisma/client/** (regenerated — Subscription.addOns)"
    - "apps/public-api/src/lib/error-handler.ts"
    - "packages/api/src/routers/finance/billing.ts"
    - "packages/api/src/routers/__tests__/billing.test.ts"
    - "packages/db/scripts/seed-dev.ts"
    - ".planning/milestones/v7.0-phases/82-.../deferred-items.md"
decisions:
  - "Subscription.addOns applied to the live dev DB via scoped idempotent ALTER (db push fallback) because pre-existing migration-history drift blocks `prisma migrate dev`; client regenerated via `prisma generate`. Per-region production apply deferred."
  - "Add-on keys = lowercase TS string-literal-union const (ADD_ON_KEYS), NOT a Prisma enum (D Claude's-Discretion + Pitfall 7) — a 2-value set does not justify the audit-enum-casing ceremony."
  - "seed-dev.ts grants the wire keys as literals (not by importing ADD_ON_KEYS) to avoid creating a db→api dependency edge; runtime single-source-of-truth stays in packages/api."
  - "grantAddOn gated by the existing adminProcedure alias (the file's owner-gating convention; = requirePermission({organization:['update']})), resolved via authApi.hasPermission."
  - "billing.test.ts switched from importing the full appRouter to mounting billingRouter on a minimal standalone router, fixing a PRE-EXISTING RED collection (appRouter chain pulls compliance-reminder-scan prismaRaw + idp getIdpAuditLogger at module load)."
metrics:
  duration: "~14m"
  tasks_completed: 3
  files_changed: 8
  completed_date: "2026-06-07"
---

# Phase 82 Plan 04: Add-On Entitlement Primitive Summary

Shipped the FOUND7-01 add-on entitlement primitive: a `requireAddOn(addOn)` tRPC middleware that clones `requireTier`, reads entitlement from a new additive `Subscription.addOns String[]` column via the same Redis-cached `getSubscription`, and rejects with a structured `ADD_ON_REQUIRED` FORBIDDEN error; plus an owner-gated, audit-logged, cache-invalidating `grantAddOn` admin mutation, a public-api `ADD_ON_REQUIRED → 403` error-handler branch, and a dev seed grant. This is the entitlement primitive that gates Workforce (Theme B) and US Cross-Border (Theme A) surfaces — the real Stripe add-on SKU / checkout / webhook-sync is DEFERRED per D-03.

## What Was Built

- **Task 1 — `Subscription.addOns` column + client regen (`98879a3f`):** Added `addOns String[] @default([])` to the `Subscription` model in `billing.prisma` (additive, non-breaking — existing rows default to empty). Because `prisma migrate dev` cannot run on this tree (pre-existing migration-history drift — see Deviations), the additive column was applied to the live dev DB via a scoped idempotent `ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "addOns" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]` (equivalent to a single-column `prisma db push`, the plan-sanctioned fallback), and the Prisma client was regenerated via `prisma generate`. Verified live: `information_schema` reports `addOns` (data_type ARRAY); db typecheck GREEN with the regenerated client. The per-region PRODUCTION apply (`db:migrate:all` EU then ME) is recorded deferred.
- **Task 2 — `requireAddOn` middleware + `ADD_ON_KEYS` + REST branch (`dd4f8036`):** `constants/add-ons.ts` exports `ADD_ON_KEYS = ['workforce','us-cross-border'] as const` + `AddOnKey` (single source of truth). `middleware/add-on.ts` clones `tier.ts` 1:1: `requireAddOn(addOn)` reads `getSubscription(orgId)` (addOns rides along on the cached object, D-01), denies on `!currentAddOns.includes(addOn)` with `TRPCError` FORBIDDEN message `JSON.stringify({type:'ADD_ON_REQUIRED', requiredAddOn, currentAddOns})` (D-02 exact shape), else `next`. `workforceProcedure`/`usCrossBorderProcedure` compose `tenantProcedure → requireTier('STARTER') → requireAddOn(...)` (D-11 STARTER floor). `error-handler.ts` gains an `ADD_ON_REQUIRED` branch immediately after `TIER_REQUIRED`, riding the existing FORBIDDEN→403 map. `tier.ts` untouched.
- **Task 3 — `grantAddOn` mutation + seed grant (`0a3c94c0`):** `billing.ts` `grantAddOn` uses the existing `adminProcedure` (= `organization:update` RBAC), Zod input `z.enum(ADD_ON_KEYS)`, reads the Subscription, merges+dedupes into `nextAddOns`, updates the row and writes `writeAuditLog({action:'subscription.addon.granted', resourceType:'ORGANIZATION', resourceId:orgId, oldValues, newValues, tx})` in one transaction (AuditEntityType has no SUBSCRIPTION value → ORGANIZATION, A3), then — load-bearing (Pitfall 3) — `invalidate(CacheKeys.subscription(orgId))` so `requireAddOn` sees the grant immediately rather than denying for up to the 15-min cache TTL. `seed-dev.ts` grants both add-ons to the QA-default org's subscription. Extended `billing.test.ts` with 6 grantAddOn cases (owner-gate deny, z.enum boundary, deduped write, no-duplicate, audit ORGANIZATION shape, cache-invalidate no-stale-deny, NOT_FOUND).

## Verification Results

- `pnpm --filter @contractor-ops/api test add-on` → **6/6 GREEN** (ADD_ON_KEYS tuple, deny JSON shape, allow path, D-11 chain-order: requireTier(STARTER) fires before requireAddOn).
- `pnpm --filter @contractor-ops/public-api test error-handler` → **22/22 GREEN** (incl. the 82-01 RED ADD_ON_REQUIRED block now green: code 'ADD_ON_REQUIRED', message mentions the add-on, 403).
- `pnpm --filter @contractor-ops/api` billing.test.ts → **24/24 GREEN** (18 pre-existing + 6 new grantAddOn).
- `pnpm typecheck` api / public-api / db → **clean** (regenerated client carries `addOns` — false-positive guard satisfied).
- `pnpm lint:schema` → my `Subscription.addOns` addition is clean (the sole failure is a pre-existing `UserPinnedView` offender, unrelated). `pnpm lint:audit-log` → **clean** (no direct `auditLog.create`; grant routes through `writeAuditLog`). `pnpm lint:logs` → my additions clean (sole failure is pre-existing `csp-report.ts`, untouched).
- Live dev DB: `Subscription.addOns` column present (verified via information_schema). `tier.ts` UNMODIFIED (clone, not edit).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Schema applied via scoped ALTER (db push fallback) instead of `migrate dev`**
- **Found during:** Task 1.
- **Issue:** `pnpm --filter @contractor-ops/db db:migrate:dev` fails on a fresh shadow DB — pre-existing migration `20260428000000_phase_73_...` errors `42P01 relation "ContractorComplianceItem" does not exist` (broken historical ordering for clean shadow replay); `prisma db push` additionally reports unrelated `WaivedReasonCategory` enum drift needing `--accept-data-loss`; 9 historical migrations show "not yet applied" vs a live DB that already carries the schema (migration-table vs live-DB drift). None of this is caused by `Subscription.addOns`.
- **Fix:** Applied ONLY the additive `addOns` column to the live dev DB via idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (the plan explicitly sanctioned `prisma db push` as the local fallback; this is the column-scoped equivalent that leaves the unrelated enum drift untouched), then `prisma generate`. Live dev DB + generated client both carry `addOns`.
- **Files modified:** packages/db/prisma/schema/billing.prisma, packages/db/src/generated/prisma/client/**.
- **Commit:** 98879a3f.

**2. [Rule 3 - Blocking] Fixed pre-existing RED collection of billing.test.ts**
- **Found during:** Task 3 (could not prove grantAddOn tests pass).
- **Issue:** The committed-baseline `billing.test.ts` already failed to collect (0 tests): importing the full `appRouter` from `root.ts` pulls unrelated module-load side-effects the test's mocks did not satisfy — `compliance-reminder-scan.ts` captures `prismaRaw` into a module-level `__deps` const at import time, and `integrations/deprovisioning` calls `getIdpAuditLogger()` at module load.
- **Fix:** Added `prismaRaw`/`SUPPORTED_REGIONS` to the test's `@contractor-ops/db` mock and mounted `billingRouter` on a minimal standalone `router({ billing: billingRouter })` instead of importing `appRouter` — isolating billing from the unrelated chain. All 24 billing tests now run GREEN. Scoped to the test file; no production-code change.
- **Files modified:** packages/api/src/routers/__tests__/billing.test.ts.
- **Commit:** 0a3c94c0.

**3. [Rule 3 - Blocking] seed-dev grants wire-key literals (not an `ADD_ON_KEYS` import)**
- **Found during:** Task 3.
- **Issue:** The plan said "using `ADD_ON_KEYS`", but that const lives in `packages/api`; `packages/db` has no dependency on `packages/api` and importing it would create a db→api layering violation (a reverse dependency edge).
- **Fix:** Seeded the lowercase wire keys as literals `['workforce','us-cross-border']` in seed-dev (a dev fixture), keeping `ADD_ON_KEYS` as the runtime single source of truth in packages/api. A comment documents the deliberate choice.
- **Files modified:** packages/db/scripts/seed-dev.ts.
- **Commit:** 0a3c94c0.

### Out-of-scope discoveries (logged to deferred-items.md, NOT fixed)
- Pre-existing migration-history drift (phase-73 shadow ordering, `WaivedReasonCategory` enum, 9 unapplied-vs-live migrations) — owner action to reconcile with `prisma migrate resolve`.
- `lint:schema` `UserPinnedView` offender (auth.prisma:114) and `lint:logs` `csp-report.ts:86` offender — both pre-existing, untouched.

## Threat Model Coverage

All five STRIDE mitigations from the plan's threat register are satisfied: T-82-04-01 (BFLA — grantAddOn owner-gated via adminProcedure, deny-test asserts a non-permitted actor cannot self-grant), T-82-04-02 (IDOR — entitlement keyed by session `ctx.organizationId`; Subscription NOT added to globalModels), T-82-04-03 (stale-grant — cache invalidation test), T-82-04-04 (repudiation — writeAuditLog with old/new addOns + actor), T-82-04-05 (supply chain — no package installs, only an additive migration).

## Deferred (post-merge)

- **Per-region PRODUCTION migration apply:** `pnpm db:migrate:all` (EU then ME) once a proper migration file is generated. Additive + `@default([])` → existing rows safe.
- **Real Stripe add-on SKU purchase flow** (price IDs / checkout / webhook entitlement-sync) — DEFERRED per D-03; this plan ships the entitlement primitive + admin/seed grant only.

## Self-Check: PASSED

- Created files exist: `packages/api/src/constants/add-ons.ts`, `packages/api/src/middleware/add-on.ts`, `82-04-SUMMARY.md` — all FOUND.
- Commits exist: `98879a3f` (Task 1), `dd4f8036` (Task 2), `0a3c94c0` (Task 3) — all FOUND.
- No stubs / placeholders / TODOs in source files.
- Live dev DB `Subscription.addOns` column verified present (information_schema, data_type ARRAY).
