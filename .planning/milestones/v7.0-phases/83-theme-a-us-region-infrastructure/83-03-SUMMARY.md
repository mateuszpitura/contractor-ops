---
phase: 83-theme-a-us-region-infrastructure
plan: 03
subsystem: infra
tags: [r2, s3, regional-storage, data-residency, env-schema, zod, prisma-enum, us-region]

# Dependency graph
requires:
  - phase: 83-01
    provides: Postgres DataRegion enum widened to { EU ME US } + SUPPORTED_REGIONS US-aware (TS DataRegion union includes US)
  - phase: 82-02
    provides: DATABASE_URL_US optional/lazy-throw posture mirrored here for R2_BUCKET_NAME_US
provides:
  - REGION_BUCKET_MAP widened from Record<'EU'|'ME'> to Record<DataRegion> (compile-time lockstep — a missing US entry now fails tsc)
  - US branch in getRegionalBucket that lazy-throws when R2_BUCKET_NAME_US is unset and resolves it when set (D-03 one US regional bucket for all US-org files incl. tax archives)
  - R2_BUCKET_NAME_US optional env var (no default) in packages/validators env schema + .env.example
affects: [84-us-profile-fields, 85-w-form-intake, 86-1099-iris, 87-1042-s]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Record<DataRegion> structural lockstep — widening the shared region union forces a matching bucket resolver at compile time (same mechanism Phase 82 used for REGION_ENV_MAP)"
    - "Optional env + lazy-throw-on-access — US bucket need not exist for local boot/tests; only actual US-org file access fails until provisioned (mirrors DATABASE_URL_US)"

key-files:
  created:
    - .planning/milestones/v7.0-phases/83-theme-a-us-region-infrastructure/83-03-SUMMARY.md
  modified:
    - packages/api/src/services/regional-storage.ts
    - packages/validators/src/env.ts
    - .env.example
    - packages/api/src/services/__tests__/regional-storage.test.ts

key-decisions:
  - "ONE US regional bucket holds all US-org files incl. tax archives (D-03) — NOT a separate dedicated tax bucket or routing branch"
  - "R2_BUCKET_NAME_US is OPTIONAL with no default (z.string().min(1).optional()) — app boots clean locally; lazy-throw only on US-org file access (DATABASE_URL_US posture)"
  - "DATA_HOSTING_REGION env (env.ts:301, EU/ME enum) left unchanged — deployment knob, not per-org routing path (Pitfall 5 / A3, deferred per D-08)"

patterns-established:
  - "Record<DataRegion> bucket map: compile-time lockstep guarantees a US resolver exists"
  - "Lazy-throw env gate: EU/ME have defaults (never throw); US optional → explicit throw matching getRegionalBucket's throw-on-unsupported"

requirements-completed: [US-INFRA-02]

# Metrics
duration: 4min
completed: 2026-06-07
---

# Phase 83 Plan 03: US Regional R2 Bucket Summary

**US-region R2 bucket wired via Record<DataRegion> lockstep with optional R2_BUCKET_NAME_US env that lazy-throws on access until provisioned (US-INFRA-02 data residency).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-07T23:38:00Z
- **Completed:** 2026-06-07T23:42:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments
- Widened `REGION_BUCKET_MAP` from `Record<'EU'|'ME', ...>` to `Record<DataRegion, ...>` — adding the `US` entry is now a tsc requirement (compile-time lockstep), and the `region as 'EU' | 'ME'` cast in `getRegionalBucket` widened to `region as DataRegion`.
- Added the `US` resolver branch: returns `R2_BUCKET_NAME_US` when set, throws `"R2_BUCKET_NAME_US is not configured for US-region storage"` when unset (lazy gate — app boots clean without it).
- Added `R2_BUCKET_NAME_US: z.string().min(1).optional()` (no default) to the `r2Schema` in `packages/validators/src/env.ts` and `R2_BUCKET_NAME_US=` to `.env.example`, mirroring the `DATABASE_URL_US` optional/lazy posture from Phase 82.
- Extended `regional-storage.test.ts`: US resolves when set, lazy-throws when unset, unsupported region still throws (12 tests GREEN, EU/ME unchanged).

## Task Commits

Each task was committed atomically (TDD cycle):

1. **Task 1 RED: failing test for US regional bucket resolution** - `1924a795` (test)
2. **Task 1 GREEN: US regional R2 bucket** - `9fadca8d` (feat)

No REFACTOR commit — implementation was minimal and clean as written.

**Plan metadata:** committed separately with SUMMARY + STATE + ROADMAP.

## Files Created/Modified
- `packages/api/src/services/regional-storage.ts` - `REGION_BUCKET_MAP` widened to `Record<DataRegion>` + US lazy-throw branch; cast widened to `DataRegion`; `DataRegion` type imported from `@contractor-ops/db`.
- `packages/validators/src/env.ts` - `R2_BUCKET_NAME_US` optional (no default) added to `r2Schema`.
- `.env.example` - `R2_BUCKET_NAME_US=` placeholder in the regional R2 bucket section.
- `packages/api/src/services/__tests__/regional-storage.test.ts` - mocked bucket env made mutable; US set/unset + unsupported-region assertions.

## Decisions Made
- ONE US regional bucket for all US-org files incl. tax archives (D-03) — no separate tax bucket.
- `R2_BUCKET_NAME_US` OPTIONAL, no default — lazy-throw only on US-org file access (DATABASE_URL_US posture).
- `DATA_HOSTING_REGION` left unchanged (out of scope per Pitfall 5 / D-08; deployment knob, not the per-org routing path).
- Used `z.string().min(1).optional()` (not bare `.optional()`) to match the `DATABASE_URL_US` shape and reject an empty-string env value at the boundary.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None during planned work. Two repo-wide gate scripts (`pnpm lint:schema`, `pnpm check:no-process-env`) report PRE-EXISTING failures unrelated to this plan:
- `lint:schema` — `UserPinnedView` model in `auth.prisma` missing `organizationId` (not a file this plan owns).
- `check:no-process-env` — ~170 `process.env` hits in landing/cron-worker/public-api sentry/posthog files (none in this plan's files).
Per Standing Project Constraints ("Fix only your own additions, not pre-existing unrelated offenders"), these are out of scope. Verified via grep that none of the four plan-owned files are offenders. Logged to `deferred-items.md`.

## User Setup Required
None for local-only Phase 83 — `R2_BUCKET_NAME_US` is optional; the app boots and tests clean without it. The operator must provision the US R2 bucket and set `R2_BUCKET_NAME_US` at US go-live (recorded as a deferred ops item; LOCAL-ONLY, not hard-blocking).

## Next Phase Readiness
- US-INFRA-02 complete: US-org file/tax-archive storage resolves to the US-region R2 bucket via `getRegionalBucket(org.dataRegion)`.
- Plan 83-04 (IRS retention) is independent of this plan's files; no shared edits.
- Threat T-83-03-01 (US-org file residency): mitigated — US files route to `R2_BUCKET_NAME_US`, no cross-region fallthrough (lazy-throw, not silent EU coercion). T-83-03-02 (missing US bucket): accepted by-design (LOCAL-ONLY lazy posture). T-83-03-03 (bucket-name input): mitigated — Zod-validated in env schema.

## Self-Check: PASSED

- All 4 plan-owned files present on disk + SUMMARY.md created.
- Both task commits present in git (`1924a795` test, `9fadca8d` feat).
- `R2_BUCKET_NAME_US` present in both `packages/validators/src/env.ts` and `.env.example`.
- `pnpm typecheck --filter @contractor-ops/api` GREEN (Record<DataRegion> lockstep).
- `pnpm --filter @contractor-ops/api test regional-storage` GREEN (12 passed).

---
*Phase: 83-theme-a-us-region-infrastructure*
*Completed: 2026-06-07*
