---
phase: 83-theme-a-us-region-infrastructure
verified: 2026-06-08T00:10:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 83: US Region Infrastructure — Verification Report

**Phase Goal:** A new org with US billing is durably routed to us-east-1 data + storage with IRS retention enforced, so US tax data can be created safely.
**Verified:** 2026-06-08T00:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `DataRegion` Prisma enum includes `US` | VERIFIED | `enum DataRegion { EU ME US }` in `organization.prisma`; generated `enums.ts` exports `US: 'US'` |
| 2 | Generated Prisma enum matches `SUPPORTED_REGIONS` (no TS/DB drift) | VERIFIED | `region-lockstep.test.ts` asserts `new Set(Object.values(PrismaDataRegion)) == new Set(SUPPORTED_REGIONS)` — 5/5 GREEN |
| 3 | A US-billing org create writes `dataRegion='US'` via `organizationHooks.beforeCreateOrganization`; EU/ME/absent defaults to `EU`; field is immutable at creation-only | VERIFIED | `resolveDataRegionFromBilling` + hook in `packages/auth/src/config.ts`; `org-creation-region.test.ts` 5/5 GREEN; `billingCountry` is `input: true, returned: false` (never persisted) |
| 4 | Tenant middleware routes a US org to `getRegionalClient('US')` | VERIFIED | `OrgMeta.dataRegion: DataRegion` in `org-cache.ts`; `tenant-region.test.ts` US-routing assertion at line 118 — 7/7 GREEN |
| 5 | All `as 'EU' \| 'ME'` narrow-cast sites widened to `DataRegion` | VERIFIED | grep finds no `as 'EU' \| 'ME'` remaining in the 8 listed files (`org-definition-sync.ts`, `oauth.ts`, `portal-shared.ts`, `portal-auth.ts`, `ksef-sync-orchestrator.ts`, `idp-deprovisioning.ts`, `seed-dev.ts`, `regional-storage.ts`); `pnpm typecheck --filter @contractor-ops/api` clean |
| 6 | Cross-region read replicas off by default (D-02) | VERIFIED | `REPLICA_ENV_MAP['US'] = 'DATABASE_URL_US_RO'` in `replica.ts` — env var is unset locally; lazy fall-through to writer is the designed posture |
| 7 | `REGION_BUCKET_MAP` is `Record<DataRegion>` with US lazy-throw branch; `getRegionalBucket('US')` resolves when set, throws when unset | VERIFIED | `regional-storage.ts` typed `Record<DataRegion, ...>` with `US` branch throwing `"R2_BUCKET_NAME_US is not configured"`; `regional-storage.test.ts` 12/12 GREEN |
| 8 | `R2_BUCKET_NAME_US` is OPTIONAL (no default) in env schema + `.env.example` | VERIFIED | `env.ts` has `R2_BUCKET_NAME_US: z.string().min(1).optional()`; `.env.example` has `R2_BUCKET_NAME_US=` placeholder |
| 9 | Retention resolver (`RETENTION_YEARS`, `MODEL_RETENTION_TYPE` EMPTY, `getRetentionCutoff`) in `packages/db/src/retention-policy.ts` | VERIFIED | File exists (59 lines), exports all four symbols; exported from `index.ts`; `retention-policy.test.ts` 5/5 GREEN |
| 10 | All three deletion chokepoints consult `getRetentionCutoff`: soft-delete extension, data-purge cron, gdpr erasure | VERIFIED | `soft-delete.ts` imports and calls `getRetentionCutoff` in `$allModels` delete hook; `data-purge.ts` uses `cutoffFor(model, now, flatCutoff) = getRetentionCutoff(...) ?? flatCutoff` on all 4 model sweeps; `gdpr.ts` checks `MODEL_RETENTION_TYPE` per model; all three test suites GREEN |
| 11 | gdpr RODO erasure soft-deletes-with-exemption (NOT `deleteByOrgAndCount`) for retained models; `writeAuditLog` on `organization.erasure_retained_under_statute`; statutory citation surfaced; no over-claim of erasure | VERIFIED | `gdpr.ts` routes `isRetained('Invoice')` path through `invoicesRetained` count (soft-delete-with-exemption branch) + `retainedUnderStatute` map + `writeAuditLog` action `organization.erasure_retained_under_statute`; `gdpr.test.ts` 18/18 GREEN |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/prisma/schema/organization.prisma` | `enum DataRegion { EU ME US }` | VERIFIED | Contains `US` value; UPPER casing |
| `packages/db/src/generated/prisma/client/enums.ts` | `DataRegion` includes `US` | VERIFIED | `export const DataRegion = { EU: 'EU', ME: 'ME', US: 'US' }` |
| `packages/db/src/__tests__/region-lockstep.test.ts` | Prisma enum ↔ SUPPORTED_REGIONS assertion | VERIFIED | Test at line 48 (5/5 GREEN) |
| `packages/db/src/retention-policy.ts` | `RETENTION_YEARS` + `MODEL_RETENTION_TYPE` (empty) + `getRetentionCutoff` | VERIFIED | 59-line implementation; exports correct |
| `packages/auth/src/config.ts` | `organizationHooks.beforeCreateOrganization` + billing-country `additionalFields` | VERIFIED | Hook at line 525; `resolveDataRegionFromBilling` at line 76 |
| `packages/api/src/services/org-cache.ts` | `OrgMeta.dataRegion: DataRegion` | VERIFIED | Line 39: `dataRegion: DataRegion` |
| `packages/api/src/__tests__/tenant-region.test.ts` | US org → US client routing assertion | VERIFIED | Lines 118-136 (7/7 GREEN) |
| `packages/api/src/services/regional-storage.ts` | `REGION_BUCKET_MAP: Record<DataRegion>` with US lazy-throw | VERIFIED | Lines 33-41 |
| `packages/validators/src/env.ts` | `R2_BUCKET_NAME_US` optional | VERIFIED | Line 92: `z.string().min(1).optional()` |
| `.env.example` | `R2_BUCKET_NAME_US=` placeholder | VERIFIED | Line 136 |
| `apps/cron-worker/src/jobs/handlers/data-purge.ts` | `getRetentionCutoff` per-model cutoff on base-prisma hard-delete | VERIFIED | `cutoffFor` function + usage on all 4 model sweeps |
| `packages/api/src/routers/compliance/gdpr.ts` | Retention-exemption branch + statutory citation + `writeAuditLog` | VERIFIED | Lines 107-147, 293-327 |
| `packages/db/src/soft-delete.ts` | Retained-window hard-delete guard | VERIFIED | Lines 57-66; imports `getRetentionCutoff` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/auth/src/config.ts` `beforeCreateOrganization` | `Organization.dataRegion` | billing-country `additionalFields` → `resolveDataRegionFromBilling` | VERIFIED | Hook strips `billingCountry`, writes `dataRegion` |
| `packages/api/src/middleware/tenant.ts` | `getRegionalClient(region)` | `OrgMeta.dataRegion: DataRegion` hot path | VERIFIED | `OrgMeta.dataRegion` widened; no literal edit needed (no narrow cast was present); US flows through |
| `packages/api/src/services/regional-storage.ts` `getRegionalBucket` | `env.R2_BUCKET_NAME_US` | `REGION_BUCKET_MAP['US']` lazy resolver | VERIFIED | Confirmed at lines 37-40 |
| `apps/cron-worker/src/jobs/handlers/data-purge.ts` | `getRetentionCutoff (@contractor-ops/db)` | `cutoffFor` per-model before `deleteMany` | VERIFIED | Import at line 24; applied at lines 91, 138, 143, 148 |
| `packages/api/src/routers/compliance/gdpr.ts` | `softDeleteByOrgAndCount` + `writeAuditLog` | retained-model branch with statutory citation | VERIFIED | `isRetained` branch at line 142; `writeAuditLog` at line 318 action `organization.erasure_retained_under_statute` |
| `packages/db/src/soft-delete.ts` | `getRetentionCutoff` | retained-in-window guard in `$allModels` delete hook | VERIFIED | Import at line 3; guard at lines 59-66 |

---

### Data-Flow Trace (Level 4)

The three chokepoints do not render UI — they are server-side deletion/purge processes. Level 4 traces data flow from model-map to actual guard execution.

| Chokepoint | Data Variable | Source | Produces Real Data | Status |
|-----------|---------------|--------|--------------------|--------|
| `soft-delete.ts` retained guard | `getRetentionCutoff(model, now, retentionOverride)` | `MODEL_RETENTION_TYPE` (production EMPTY; tests inject Invoice fixture) | Guard activates when map has entry; passthrough otherwise — correct for D-06 | FLOWING (conditional on registry — by design) |
| `data-purge.ts` `cutoffFor` | `getRetentionCutoff(model, now) ?? flatCutoff` | `MODEL_RETENTION_TYPE` (EMPTY production) | Returns `flatCutoff` for all current production models; retained path proven by test injection | FLOWING |
| `gdpr.ts` `isRetained` | `MODEL_RETENTION_TYPE[model] != null` | Same resolver | Returns `false` for all current production models; `retainedUnderStatute` populated when non-empty | FLOWING |

Note: `MODEL_RETENTION_TYPE` ships EMPTY per D-06 (intentional — no tax tables yet). Production behaviour at all three chokepoints is identical to pre-Phase-83 for current models. Phase 86 tax models opt in by adding entries. This is a known-acceptable deferred item, not a stub.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Prisma DataRegion enum includes US | `grep -A5 'enum DataRegion' packages/db/prisma/schema/organization.prisma` | `EU ME US` present | PASS |
| Generated client carries US | `grep -A5 'DataRegion' packages/db/src/generated/prisma/client/enums.ts` | `US: 'US'` present | PASS |
| region-lockstep test | `pnpm --filter @contractor-ops/db test region-lockstep` | 5/5 passed | PASS |
| retention-policy test | `pnpm --filter @contractor-ops/db test retention-policy` | 5/5 passed | PASS |
| org-creation-region test | `pnpm --filter @contractor-ops/auth test org-creation-region` | 5/5 passed | PASS |
| tenant-region test (US routing) | `pnpm --filter @contractor-ops/api test tenant-region` | 7/7 passed | PASS |
| regional-storage test (US bucket) | `pnpm --filter @contractor-ops/api test regional-storage` | 12/12 passed | PASS |
| soft-delete test (retained guard) | `pnpm --filter @contractor-ops/db test soft-delete` | 19/19 passed | PASS |
| data-purge test (cannot-delete-in-window) | `pnpm --filter @contractor-ops/cron-worker test data-purge` | 5/5 passed | PASS |
| gdpr test (retention-exemption branch) | `pnpm --filter @contractor-ops/api test gdpr` | 18/18 passed | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| US-INFRA-01 | 83-01, 83-02 | US-billing org routed to us-east-1 DB; cross-region replicas off by default | SATISFIED | Prisma enum includes US; `resolveDataRegionFromBilling` + `beforeCreateOrganization` hook; tenant routes to `getRegionalClient('US')`; all cast sites widened; replica US entry inert; tests GREEN |
| US-INFRA-02 | 83-03 | US-specific R2 storage bucket for tax-form archives | SATISFIED | `REGION_BUCKET_MAP: Record<DataRegion>` with US lazy-throw; `R2_BUCKET_NAME_US` optional in env schema + `.env.example`; test verifies set/unset/unsupported behaviors |
| US-INFRA-03 | 83-04 | IRS-mandated retention via soft-delete + scheduled archive (4yr 1099-NEC, 7yr backup-withholding) | SATISFIED | `retention-policy.ts` resolver exists; all three chokepoints wired; no in-window hard-delete possible; gdpr uses soft-delete-with-exemption + `writeAuditLog`; all tests GREEN |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX markers found in plan-owned files | — | — |
| — | — | No `console.*` found in plan-owned files | — | — |

Pre-existing unrelated offenders noted in SUMMARYs (csp-report.ts lint:logs; UserPinnedView lint:schema; check:no-process-env baseline) are out of scope per the SCOPE BOUNDARY rule and the known-acceptable list supplied with the verification request.

---

### Human Verification Required

**None** for automated behaviors. The two manual items from `83-VALIDATION.md` are infra-provisioning / production-migration tasks, not code correctness:

1. **Real us-east-1 Neon DB + US R2 bucket provisioning** — requires operator to provision infrastructure and set `DATABASE_URL_US` / `R2_BUCKET_NAME_US`. The routing and storage code is verified correct; the infra does not exist yet (LOCAL-ONLY posture).

2. **Per-region production migration apply** (`ALTER TYPE DataRegion ADD VALUE 'US'` on EU/ME prod DBs) — `prisma migrate dev` is blocked by pre-existing migration-history drift; already applied to dev DB; prod apply deferred. Not a code correctness issue.

Neither item is a BLOCKER — both are accepted deferred ops items documented in `deferred-items.md`.

---

### Gaps Summary

No gaps. All 11 must-have truths verified against real code + passing tests. Phase goal achieved.

---

### Deferred Items (Not Gaps)

Per the known-acceptable list and plan decisions:

| Item | Addressed In | Evidence |
|------|-------------|---------|
| Per-region PRODUCTION enum apply (`ALTER TYPE 'US'` on EU/ME prod) | Ops task, LOCAL-ONLY | Applied to dev DB; prod apply is a deployment step |
| `MODEL_RETENTION_TYPE` EMPTY in production (D-06) | Phase 86 | Phase 86 registers tax models; guard proven via Invoice fixture |
| EU-pinned data-purge cross-region gap (Pitfall 6) | Tracked threat T-83-04-05, accepted | Pre-existing for ME; deferred region fan-out in ops backlog |
| US R2 bucket provisioning | Ops task, LOCAL-ONLY | `R2_BUCKET_NAME_US` optional; lazy-throw until provisioned |
| Statutory-citation legal verification | Pre-production gate | Annotated in code; needs jurisdiction legal/tax-adviser sign-off before prod deploy |

---

_Verified: 2026-06-08T00:10:00Z_
_Verifier: Claude (gsd-verifier)_
