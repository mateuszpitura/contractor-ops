---
phase: 83-theme-a-us-region-infrastructure
plan: 02
subsystem: infra
tags: [better-auth, data-residency, multi-region, prisma, zod, tenant-routing, us-region]

# Dependency graph
requires:
  - phase: 82-foundation-add-on-flags-us-region
    provides: "SUPPORTED_REGIONS/DataRegion TS union incl US; getRegionalClient('US') resolves; REGION_ENV_MAP['US']=DATABASE_URL_US (optional, lazy-throw)"
  - phase: 83-01
    provides: "Postgres DataRegion enum widened {EU,ME,US}; Wave 0 RED scaffolds (org-creation-region.test, resolveDataRegionFromBilling contract)"
provides:
  - "Better Auth organizationHooks.beforeCreateOrganization — the single origin of dataRegion='US' at org creation (D-01 immutable)"
  - "resolveDataRegionFromBilling(billingCountry) pure helper (US billing -> US; EU/ME/absent -> EU), Zod-validated billing-country additionalFields input"
  - "OrgMeta.dataRegion typed DataRegion (was string) — US type-legal through the 5-min org-meta cache and the tenant hot path"
  - "All scattered narrow 'EU'|'ME' cast/fallback sites widened to the shared DataRegion type (no silent US drop into getRegionalClient)"
  - "tenant-region.test US-org -> getRegionalClient('US') routing assertion (GREEN)"
affects: [84-us-profile-fields, 85-w-form-intake, 86-tin-match-1099, 88-us-payment-rail, 90-employee-registry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Creation-time data-residency assignment via Better Auth organizationHooks.beforeCreateOrganization (org-create no longer flows through tRPC)"
    - "Input-only additionalFields (input:true, returned:false, not persisted) with Zod validator at the Better Auth boundary — derive a real column, strip the transient input"
    - "Shared DataRegion union as the single typing source for every region consumer; ?? 'EU' kept as the safe non-US default"

key-files:
  created:
    - .planning/milestones/v7.0-phases/83-theme-a-us-region-infrastructure/83-02-SUMMARY.md
  modified:
    - packages/auth/src/config.ts
    - packages/api/src/services/org-cache.ts
    - packages/api/src/services/org-definition-sync.ts
    - apps/api/src/routes/oauth.ts
    - packages/api/src/routers/portal/portal-shared.ts
    - packages/api/src/middleware/portal-auth.ts
    - packages/api/src/services/ksef-sync-orchestrator.ts
    - apps/api/src/routes/idp-deprovisioning.ts
    - packages/db/scripts/seed-dev.ts
    - packages/api/src/__tests__/tenant-region.test.ts

key-decisions:
  - "billingCountry is input-only (input:true, returned:false) and NEVER persisted — no Organization.billingCountry column; it is consumed in beforeCreateOrganization to derive the dataRegion enum (the single source of truth), avoiding an unplanned schema column (Rule 4 averted)"
  - "Better Auth 1.6.9 exposes organizationHooks.beforeCreateOrganization + schema.organization.additionalFields (validator.input = StandardSchemaV1/Zod), NOT the organizationCreation.beforeCreate name the plan/research cited — used the version-correct API"
  - "tenant.ts needed no literal edit: its widening is achieved structurally via OrgMeta.dataRegion: DataRegion (the hot path already used string/no narrow cast); US now flows through the cache untouched"
  - "seed-dev region types widened to DataRegion[] but the runtime --regions CLI allow-list stays EU/ME-only (no US seed org this phase, deferred from Phase 82)"

patterns-established:
  - "Pattern: derive-and-strip create input — accept an untrusted, Zod-validated, input-only field at the auth boundary, map it to a persistent enum, drop the transient field before the DB write"
  - "Pattern: Record<DataRegion>/DataRegion annotations as a structural lockstep so a new region is type-legal end-to-end with no hidden narrowing"

requirements-completed: [US-INFRA-01]

# Metrics
duration: 9min
completed: 2026-06-07
---

# Phase 83 Plan 02: US Region Routing (Creation → Resolution) Summary

**Better Auth `beforeCreateOrganization` hook assigns `dataRegion='US'` for US-billing orgs (immutable, single origin), and every scattered `'EU'|'ME'` cast site widened to the shared `DataRegion` type so a US org resolves the `us-east-1` Prisma client end-to-end.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-07T21:27:00Z
- **Completed:** 2026-06-07T21:36:00Z
- **Tasks:** 2
- **Files modified:** 10 (1 in Task 1, 9 in Task 2)

## Accomplishments
- US-INFRA-01 creation half: `resolveDataRegionFromBilling` + `organizationHooks.beforeCreateOrganization` make `dataRegion='US'` assignable exactly once, at creation, from a Zod-validated billing-country input; EU/ME/absent stays EU; no update/afterCreate path mutates it (D-01 immutable).
- US-INFRA-01 resolution half: `OrgMeta.dataRegion` is now `DataRegion`-typed, and every narrow `as 'EU' | 'ME'` cast / narrow `?? 'EU'` fallback across tenant cache, org-definition-sync, oauth, portal-shared, portal-auth, ksef-sync-orchestrator, idp-deprovisioning, and seed-dev was widened to the shared `DataRegion` union — `'US'` is type-legal into `getRegionalClient` with no silent drop.
- Turned the Plan-01 RED `org-creation-region.test.ts` GREEN (5/5) and extended `tenant-region.test.ts` with a US-org → `getRegionalClient('US')` routing assertion (7/7).

## Task Commits

Each task was committed atomically:

1. **Task 1: org-creation US data-region hook (D-01)** - `3437b01b` (feat) — RED→GREEN: the test imports the new `resolveDataRegionFromBilling` export; single feat commit (the helper + hook land together since the hook delegates to the helper).
2. **Task 2: widen dataRegion cast sites + US routing test** - `7c2157cf` (refactor)

**Plan metadata:** (this commit) `docs(83-02): complete ...`

## Files Created/Modified
- `packages/auth/src/config.ts` - `resolveDataRegionFromBilling` helper + `billingCountry` Zod schema; `schema.organization.additionalFields.billingCountry` (input-only, not persisted) + `organizationHooks.beforeCreateOrganization` deriving `dataRegion` and stripping the transient input.
- `packages/api/src/services/org-cache.ts` - `OrgMeta.dataRegion: DataRegion` (was `string`); `DataRegion` import.
- `packages/api/src/services/org-definition-sync.ts` - cron dep `getRegionalClient: (region: DataRegion)`; `region: DataRegion = c.organization.dataRegion ?? 'EU'` (was `as 'EU' | 'ME'`).
- `apps/api/src/routes/oauth.ts` - Jira first-connect `region: DataRegion = org.dataRegion ?? 'EU'` (was `as 'EU' | 'ME'`).
- `packages/api/src/routers/portal/portal-shared.ts` - `region: DataRegion` annotation on `withOrgRegionalDb`.
- `packages/api/src/middleware/portal-auth.ts` - `region: DataRegion` annotation on the portal tenant boundary.
- `packages/api/src/services/ksef-sync-orchestrator.ts` - `region: DataRegion` annotation.
- `apps/api/src/routes/idp-deprovisioning.ts` - `region: DataRegion` annotation.
- `packages/db/scripts/seed-dev.ts` - `DataRegion` import; region unions on `CliFlags.regions`, `OrgVolume.region`, `buildOrgs`/`pickRegion`/`push`, `makeFakers`, `pickRegionProfile`, `SeedSummary.region`, and the `regionUrls`/`clients`/`fetchSectionCounts` maps widened to `DataRegion` (runtime CLI parser stays EU/ME-only).
- `packages/api/src/__tests__/tenant-region.test.ts` - added the US → US-client routing assertion.

## Decisions Made
- **`billingCountry` is input-only, never a DB column.** The Prisma `Organization` model has no `billingCountry`; adding one would be an architectural change (Rule 4). Instead the field is declared `input: true, returned: false` with a Zod `validator.input`, validated at the Better Auth boundary, consumed in `beforeCreateOrganization` to derive the `dataRegion` enum, and stripped before the DB write. `dataRegion` (a real enum column) is the single persistent source of truth.
- **Version-correct Better Auth API.** The plan/research named the hook `organizationCreation.beforeCreate`; Better Auth 1.6.9 (in-tree) exposes `organizationHooks.beforeCreateOrganization` and `schema.organization.additionalFields` (with `validator.input: StandardSchemaV1`, which Zod satisfies). Used the real API surface verified in `node_modules/better-auth/dist/plugins/organization/types.d.mts`.
- **tenant.ts required no literal edit.** Its region resolution (`region = meta?.dataRegion ?? 'EU'`) already used `string`/no narrow cast; widening `OrgMeta.dataRegion` to `DataRegion` is what carries US through the hot path. Documented here so the absent diff in a listed file is not mistaken for a miss.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used the version-correct Better Auth hook/schema API**
- **Found during:** Task 1 (org-creation hook)
- **Issue:** The plan + 83-RESEARCH cited `organizationCreation: { beforeCreate }` and a generic `additionalFields` entry; that hook name does not exist in the in-tree Better Auth 1.6.9 — typecheck/runtime would fail.
- **Fix:** Wired `organizationHooks.beforeCreateOrganization` and `schema.organization.additionalFields.billingCountry` with a Zod `validator.input`, per the actual `types.d.mts`. Behavior matches the plan's intent exactly (US billing → `dataRegion:'US'`, immutable, Zod-validated boundary input).
- **Files modified:** packages/auth/src/config.ts
- **Verification:** org-creation-region test GREEN (5/5); `pnpm typecheck --filter @contractor-ops/auth` clean.
- **Committed in:** 3437b01b (Task 1 commit)

**2. [Rule 2 - Missing Critical] Made `billingCountry` input-only / non-persisted instead of adding a schema column**
- **Found during:** Task 1
- **Issue:** A naive `additionalFields` entry would make Better Auth attempt to persist `billingCountry` to a non-existent Organization column (DB write failure), and persisting raw client-supplied country is unnecessary data.
- **Fix:** Declared `input: true, returned: false` and stripped the field in the hook after deriving `dataRegion`; only the validated `dataRegion` enum is written.
- **Files modified:** packages/auth/src/config.ts
- **Verification:** auth typecheck + test GREEN; no Prisma schema change needed.
- **Committed in:** 3437b01b (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing-critical). Both are mechanical adaptations to the real Better Auth API and the existing Prisma schema; the plan's contract (`resolveDataRegionFromBilling` semantics, D-01 immutability, Zod-validated boundary) is honoured verbatim.
**Impact on plan:** No scope creep. No new packages. No schema migration (83-01 already widened the Postgres enum). `regional-storage.ts`, `validators/src/env.ts`, `.env.example`, and retention files were NOT touched (owned by 83-03 / 83-04).

## Issues Encountered
- None beyond the API-name reconciliation captured above. The cron caller of `runScheduledOrgDefinitionSync` passes the real `getRegionalClient: (region: string) => PrismaClient`, which remains assignable to the narrowed-param `(region: DataRegion) => unknown` dep slot (contravariant params) — confirmed via the full `@contractor-ops/api` + `@contractor-ops/api-server` typechecks.

## Verification Results
- `pnpm --filter @contractor-ops/auth test org-creation-region` — GREEN (5/5).
- `pnpm --filter @contractor-ops/api test tenant-region` — GREEN (7/7, incl. new US-routing assertion).
- `pnpm typecheck --filter @contractor-ops/api` — clean (14/14 tasks; transitively builds @contractor-ops/db with the seed-dev + region changes).
- `pnpm typecheck --filter @contractor-ops/api-server` — clean (oauth.ts + idp-deprovisioning.ts).
- `pnpm lint:region-leakage` — passes (no new default-client reads of region-scoped models).
- grep — no `as 'EU' | 'ME'` remains in any listed consumer file (the only surviving `'EU' | 'ME'` is the intentional EU/ME-only `--regions` CLI allow-list in seed-dev.ts; `regional-storage.ts` untouched per Plan 03 ownership).

## Known Stubs
None. `billingCountry` is intentionally input-only (not a stub); the data wiring (SPA passing the selection into `authClient.organization.create`) is the SPA's responsibility and out of this infra plan's scope — the boundary + mapping are fully implemented and tested.

## Next Phase Readiness
- US-INFRA-01 routing is complete: a US-billing org is assignable at creation (immutable) and resolves the `us-east-1` client at the tenant boundary. Replicas remain off by default (D-02 — `REPLICA_ENV_MAP['US']` inert).
- Ready for 83-03 (US R2 bucket: `regional-storage.ts` + `R2_BUCKET_NAME_US` env) and 83-04 (IRS retention), which run on the shared main tree with zero intended file overlap with this plan.
- Deferred (carry-forward): no US seed org in seed-dev (EU/ME-only CLI); `DATABASE_URL_US` + `R2_BUCKET_NAME_US` intentionally unset locally (lazy-throw on actual US access); per-region prod apply of the DataRegion enum (from 83-01) still deferred.

## Self-Check: PASSED

- FOUND: 83-02-SUMMARY.md
- FOUND: packages/auth/src/config.ts
- FOUND: packages/api/src/services/org-cache.ts
- FOUND commit: 3437b01b (Task 1)
- FOUND commit: 7c2157cf (Task 2)

---
*Phase: 83-theme-a-us-region-infrastructure*
*Completed: 2026-06-07*
