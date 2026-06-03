---
phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-
plan: 02
subsystem: database
tags: [prisma, postgres, gulf, saudization, uae-free-zone, feature-flags, locked-phrases, multi-region]

# Dependency graph
requires:
  - phase: 79-01
    provides: RED test scaffolds (C1-C10) + shared ME-region Gulf fixture factory + RTL logical-property guard
provides:
  - 4 Gulf Prisma models (FreeZoneAssignment per-contractor, SaudizationConfig per-org, SaudiHeadcount per-org, UaeFreeZone global lookup) with organizationId-first tenant scoping + ME-region routing doc-comments
  - NitaqatBand + UaeFreeZoneCode enums (UPPER_SNAKE; no CRITICAL added to Severity)
  - Additive columns ContractorAssignment.isSaudi/nationality/qiwaContractAuthenticated + Contract.activityIsicCodes (all nullable/empty-default)
  - LOCKED_AE_PHRASES (free-zone authority legal names) + LOCKED_SA_PHRASES (Nitaqat band labels + Qiwa terms) statutory-constant registries + index re-export + locked-phrases-guard coverage
  - Two PENDING Gulf feature flags (gulf-free-zone-tracking, gulf-saudization-dashboard) + UaeFreeZone global-lookup lint:schema allowlist entry
  - Regenerated Prisma client exposing all 4 models + 2 enums for downstream waves to type-check against
affects: [79-03, 79-04, gulf free-zone service, saudization dashboard, gulf routers, arabic-rtl-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ME-region routing as a doc-comment (// REGION: ME) not a schema @attribute (Pitfall 19)"
    - "Per-contractor uniqueness via @@unique([organizationId, contractorId]) (D-01)"
    - "Global-lookup model (no organizationId) registered in FOUND6-01 lint:schema allowlist instead of carrying a synthetic tenant column"
    - "Statutory band/authority labels live as code constants (legal/ae.ts, legal/sa.ts) guarded out of messages/*.json"
    - "GENERATE-ONLY schema landing: db:generate for type resolution; DB-mutating apply deferred post-deploy under LOCAL-ONLY"

key-files:
  created:
    - packages/db/prisma/schema/gulf.prisma
    - packages/validators/src/legal/ae.ts
    - packages/validators/src/legal/sa.ts
  modified:
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/contract.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/validators/src/index.ts
    - packages/validators/src/__tests__/locked-phrases-guard.test.ts
    - packages/feature-flags/src/signoff-registry-flags.json
    - packages/feature-flags/src/signoff-registry-flags.ts
    - packages/feature-flags/src/flags-core.ts
    - packages/feature-flags/src/schema-guard/global-lookup-allowlist.ts

key-decisions:
  - "GENERATE ONLY, DEFER APPLY (Task 4, user-confirmed): ran db:generate (no DB mutation) for downstream type resolution; single-region db:migrate:dev AND multi-region db:migrate:all (EU+ME) both deferred post-deploy under LOCAL-ONLY constraint"
  - "FreeZoneAssignment is per-contractor (D-01) with @@unique([organizationId, contractorId])"
  - "NitaqatBand + UaeFreeZoneCode enums are UPPER_SNAKE; codebase enum-casing standard takes precedence over plan templates (D-17); no CRITICAL added to Severity (D-03)"
  - "Statutory identifiers only in LOCKED_AE/SA_PHRASES (D-14); split into separate legal/ae.ts + legal/sa.ts (D-15)"
  - "Uncoded contract = empty activityIsicCodes array -> permitted-activity check SKIPS (D-08, Open Q5 resolution)"
  - "Gulf feature flags land PENDING (legal-sensitive ME namespaces); flip to APPROVED is a post-deploy commit referencing the legal ticket (Phase 70 D-10)"

patterns-established:
  - "ME-region routing doc-comment convention for Gulf models (never default prisma/prismaRaw)"
  - "Generate-only schema landing with deferred multi-region apply as a recurring LOCAL-ONLY precedent (Phase 70/73/74/76 lineage)"

requirements-completed: [GULF-01, GULF-04, GULF-05, GULF-09, GULF-11]

# Metrics
duration: 14min
completed: 2026-06-03
---

# Phase 79 Plan 02: Gulf Data + Statutory-Constant Foundation Summary

**4 ME-region Gulf Prisma models (FreeZone/Saudization/Headcount/UaeFreeZone) + NitaqatBand/UaeFreeZoneCode enums + additive contractor/contract columns + AE/SA locked-phrase registries + 2 PENDING Gulf flags, landed generate-only with both single- and multi-region applies deferred post-deploy.**

## Performance

- **Duration:** ~14 min (Task 4 continuation; Tasks 1-3 by prior executor)
- **Started:** 2026-06-03T10:24:14+02:00 (first task commit)
- **Completed:** 2026-06-03T10:40:00+02:00
- **Tasks:** 4 (Tasks 1-3 committed by prior executor; Task 4 completed generate-only this session)
- **Files modified:** 13 across packages/db, packages/validators, packages/feature-flags

## Accomplishments

- 4 tenant-scoped Gulf models created in `gulf.prisma`, each with `id`+`organizationId`-first ordering, `@@index([organizationId])`, and a `// REGION: ME` routing doc-comment; `UaeFreeZone` is the one global-lookup model (no organizationId, allowlisted).
- `NitaqatBand` (6 bands) + `UaeFreeZoneCode` (10 zones + MAINLAND) enums in UPPER_SNAKE; zero CRITICAL added to `Severity`.
- Additive columns landed: `ContractorAssignment.isSaudi/nationality/qiwaContractAuthenticated` (nullable) + `Contract.activityIsicCodes` (String[] empty-default).
- `legal/ae.ts` + `legal/sa.ts` statutory-constant registries (`LOCKED_AE_PHRASES`, `LOCKED_SA_PHRASES`, `RESERVED_AE/SA_LEGAL_KEYS`, key types), re-exported from validators index and covered by `locked-phrases-guard.test.ts`.
- Two Gulf flags (`gulf-free-zone-tracking`, `gulf-saudization-dashboard`) registered PENDING; `UaeFreeZone` added to the FOUND6-01 global-lookup allowlist.
- **Task 4 (generate-only):** `db:generate` run — Prisma client now exposes all 4 Gulf models + both enums + the 4 additive columns; db/validators/feature-flags/api typecheck clean against the regenerated client.

## Task Commits

Tasks 1-3 committed by the prior executor; Task 4 completed generate-only this session.

1. **Task 1: Gulf Prisma models + enums + additive columns** - `3117ab7d` (feat)
2. **Task 2: AE/SA locked-phrase registries + index export + guard** - `8130fbc0` (feat)
3. **Task 3: Gulf feature flags PENDING + UaeFreeZone lint:schema allowlist** - `c8b8543e` (feat)
4. **Task 4: Generate-only schema landing (no DB mutation) + deferred-items log** - `934b98be` (docs, initial deferred log) + `9839ca52` (docs, generate-only decision split)

**Plan metadata:** committed alongside this SUMMARY (docs: complete plan).

_Task 4 produced no source diff — `db:generate` regenerates the (gitignored) Prisma client only; the migration apply is deferred, so no migration SQL file was generated._

## Files Created/Modified

- `packages/db/prisma/schema/gulf.prisma` - 4 Gulf models + NitaqatBand + UaeFreeZoneCode enums
- `packages/db/prisma/schema/contractor.prisma` - ContractorAssignment additive columns + FreeZoneAssignment back-relation
- `packages/db/prisma/schema/contract.prisma` - Contract.activityIsicCodes
- `packages/db/prisma/schema/organization.prisma` - SaudizationConfig/SaudiHeadcount back-relations
- `packages/validators/src/legal/ae.ts` - UAE free-zone authority locked legal-name constants
- `packages/validators/src/legal/sa.ts` - Nitaqat band labels + Qiwa-auth locked terms
- `packages/validators/src/index.ts` - re-export of AE/SA locked-phrase registries
- `packages/validators/src/__tests__/locked-phrases-guard.test.ts` - AE/SA reserved-key spread + mirror assertions
- `packages/feature-flags/src/signoff-registry-flags.{json,ts}` - two PENDING Gulf flags
- `packages/feature-flags/src/flags-core.ts` - flag-key registration
- `packages/feature-flags/src/schema-guard/global-lookup-allowlist.ts` - UaeFreeZone allowlist entry

## Decisions Made

- **GENERATE ONLY, DEFER APPLY (user-confirmed at the [BLOCKING] migrate gate):** Ran only `pnpm --filter @contractor-ops/db db:generate` (regenerates the Prisma client from schema — NO database mutation) so downstream waves type-check against the new Gulf models. No `db:migrate:dev`/`db:migrate:all`/`db push` was run. Both the single-region migration generate+apply and the multi-region (EU+ME) apply are recorded in `deferred-items.md` as deferred post-deploy items under the LOCAL-ONLY Standing Constraint (Phase 70/73/74/76 precedent), with migration name `phase79_gulf_free_zone_saudization` and the additive-only DDL summary (CREATE TABLE x4 + CREATE TYPE x2 + ADD COLUMN x4, zero DROP/RENAME).
- Remaining decisions followed the plan as specified (D-01, D-03, D-05, D-08, D-14, D-15, D-17).

## Deviations from Plan

None - plan executed as written. The only divergence is the user-directed Task 4 disposition (GENERATE ONLY instead of running the DB-mutating migrate), which is an explicit checkpoint decision, not an auto-fix deviation. The plan itself anticipated this fallback in Task 4's `how-to-verify` note ("if db:migrate:dev is blocked... fall back to db:generate for type resolution and record the apply as deferred").

## Issues Encountered

- The local `db:migrate:dev`/`db push` path is blocked by the pre-existing `Contractor.search_vector` GENERATED column (STATE.md Phase 73 precedent). The generate-only decision sidesteps this entirely — `db:generate` does not touch the database. Recorded in `deferred-items.md`.

## Deferred Items

Recorded in `.planning/phases/79-.../deferred-items.md`:

- **(a) Single-region migration generate + apply** — `pnpm --filter @contractor-ops/db db:migrate:dev` (name `phase79_gulf_free_zone_saudization`). NOT run; migration SQL file not generated. Deferred post-deploy.
- **(b) Multi-region apply (EU + ME)** — `pnpm --filter @contractor-ops/db db:migrate:all` against `$DATABASE_URL_EU` then `$DATABASE_URL_ME`. NOT run. Deferred post-deploy under LOCAL-ONLY; coordinate with the deferred Phase 72/75/76 additive migrations at deploy time.

Pre-existing debt (NOT caused by 79-02, also in deferred-items.md): drifted `locked-phrases-guard` Phase-64 count assertion; `UserPinnedView` lint:schema offence (Phase 76); `boot-gate.test.ts` stale synthetic-key assumption (Phase 73); `ManualOverrideCategory` lower_snake enum offenders (Phase 76-78 IdP). The Phase 79 new enums (NitaqatBand, UaeFreeZoneCode) are UPPER_SNAKE and do NOT appear in the offender list.

## User Setup Required

None - no external service configuration required. The deferred migration apply (single + multi-region) is a post-deploy operational step, not a setup step for downstream waves (which type-check against the regenerated client).

## Next Phase Readiness

- Prisma client regenerated and exposing all 4 Gulf models + 2 enums + 4 additive columns; db/validators/feature-flags/api typecheck CLEAN. Downstream Waves 2-4 (free-zone service, routers, dashboard, RTL UI) can build and type-check against the live schema.
- LOCKED_AE/SA_PHRASES + guard coverage in place for statutory band/authority labels.
- Two Gulf flags are PENDING (FOUND6-04 boot gate satisfied); flip to APPROVED is a post-deploy legal-ticket commit.
- **Blocker for prod only:** the single + multi-region migration apply must run post-deploy before any Gulf data is persisted. Not a blocker for downstream local development/type-checking.

---
*Phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-*
*Completed: 2026-06-03*
