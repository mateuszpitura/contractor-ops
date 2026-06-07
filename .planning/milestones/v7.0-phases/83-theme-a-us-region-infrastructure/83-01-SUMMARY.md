---
phase: 83-theme-a-us-region-infrastructure
plan: 01
subsystem: database
tags: [prisma, postgres, enum, data-region, retention, better-auth, vitest, tdd]

# Dependency graph
requires:
  - phase: 82-region-primitives
    provides: "SUPPORTED_REGIONS TS tuple widened to ['EU','ME','US']; getRegionalClient('US') resolves; db-push/ALTER migration-drift fallback precedent"
provides:
  - "Postgres enum DataRegion widened to { EU ME US } (additive ALTER applied to dev DB; client regenerated) — dataRegion='US' now persists without invalid-enum throw"
  - "region-lockstep test asserts Prisma DataRegion enum == SUPPORTED_REGIONS (closes the Phase-82 drift gap, Pitfall 1)"
  - "Wave 0 RED scaffold for the retention resolver (packages/db/src/retention-policy.ts) — consumed by Plan 04"
  - "Wave 0 RED scaffold for the org-creation US-assignment hook (resolveDataRegionFromBilling) — consumed by Plan 02"
affects: [83-02-us-db-routing, 83-04-irs-retention, 86-tax-forms]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive Postgres enum widen via ALTER TYPE ... ADD VALUE IF NOT EXISTS (db-push fallback; migrate dev drift-blocked)"
    - "Structural lockstep guard: assert generated $Enums.DataRegion == SUPPORTED_REGIONS so the TS tuple and Postgres enum can never drift again"
    - "Nyquist Wave 0 RED scaffolds pin downstream contracts before their implementations exist"

key-files:
  created:
    - packages/db/src/__tests__/retention-policy.test.ts
    - packages/auth/src/__tests__/org-creation-region.test.ts
  modified:
    - packages/db/prisma/schema/organization.prisma
    - packages/db/src/__tests__/region-lockstep.test.ts
    - packages/db/src/generated/prisma/client/enums.ts
    - packages/db/src/generated/prisma/client/internal/class.ts

key-decisions:
  - "Applied US enum value via idempotent ALTER TYPE ... ADD VALUE IF NOT EXISTS against DATABASE_URL_EU (dev DB only); migrate dev stays blocked by Phase-82 drift"
  - "Lockstep assertion is GREEN immediately because the enum widen (Task 1) precedes it — the correct sequence for a drift-guard (not a RED-first feature)"
  - "RED scaffolds import not-yet-existing modules (../retention-policy.js) / helpers (resolveDataRegionFromBilling) so they fail until Plans 04/02 land — intended Wave 0 state"

patterns-established:
  - "Additive enum migration: schema edit + ALTER TYPE ADD VALUE IF NOT EXISTS + prisma generate; per-region prod apply recorded as deferred"
  - "Enum drift guard: Set(Object.values(PrismaEnum)) deep-equals Set(TsTuple) in the package that owns both"

requirements-completed: [US-INFRA-01, US-INFRA-03]

# Metrics
duration: ~18min
completed: 2026-06-07
---

# Phase 83 Plan 01: US Region Schema Foundation + Wave 0 Scaffolds Summary

**Widened the Postgres `DataRegion` enum to `{ EU ME US }` (the genuinely-missing Phase-82 piece — `dataRegion='US'` threw at the DB), added the Prisma-enum lockstep guard that closes the drift gap forever, and laid the two RED test scaffolds Plans 02/04 will turn green.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-07 (session)
- **Completed:** 2026-06-07
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `enum DataRegion { EU ME }` → `{ EU ME US }` in `organization.prisma`; additive `ALTER TYPE "DataRegion" ADD VALUE IF NOT EXISTS 'US'` applied to the live dev DB (verified: `pg_enum` now lists EU/ME/US); Prisma client regenerated (generated `DataRegion` carries `US`). `dataRegion='US'` can now be persisted without an invalid-enum throw.
- Extended `region-lockstep.test.ts` with the 6th lockstep place Phase 82 skipped: `new Set(Object.values(PrismaDataRegion))` deep-equals `new Set(SUPPORTED_REGIONS)`. GREEN (5/5 tests pass) — fails CI on any future TS↔DB drift (Pitfall 1 closed).
- Created two Nyquist Wave 0 RED scaffolds pinning downstream contracts: `retention-policy.test.ts` (resolver: `resolveRetentionYears` 1099-NEC→4 / backup-withholding→7, `getRetentionCutoff` window/null, empty `MODEL_RETENTION_TYPE` per D-06) and `org-creation-region.test.ts` (`resolveDataRegionFromBilling`: US→US, EU/ME/absent→EU, immutability intent D-01).

## Task Commits

Each task was committed atomically:

1. **Task 1: [BLOCKING] Add US to the Prisma DataRegion enum + apply to dev DB + regenerate client** - `31932a2b` (feat)
2. **Task 2: Extend region-lockstep test with Prisma-enum ↔ SUPPORTED_REGIONS assertion** - `af0f599b` (test)
3. **Task 3: Write RED scaffolds — retention-policy resolver test + org-creation US-assignment hook test** - `2ae67c17` (test)

_Note: Task 2 (tdd) is a single GREEN commit by design — the enum widen in Task 1 precedes the assertion, so this drift-guard is GREEN on landing rather than RED-first. Task 3 scaffolds are intentionally RED (Wave 0)._

## Files Created/Modified
- `packages/db/prisma/schema/organization.prisma` - `enum DataRegion` widened to include `US` (UPPER; passes enum-casing audit)
- `packages/db/src/generated/prisma/client/enums.ts` - regenerated `DataRegion` now `{ EU, ME, US }`
- `packages/db/src/generated/prisma/client/internal/class.ts` - regenerated inline schema carries the widened enum
- `packages/db/src/__tests__/region-lockstep.test.ts` - added Prisma-enum ↔ `SUPPORTED_REGIONS` lockstep assertion (GREEN)
- `packages/db/src/__tests__/retention-policy.test.ts` - NEW Wave 0 RED scaffold pinning the D-04/D-07 retention resolver contract (Plan 04)
- `packages/auth/src/__tests__/org-creation-region.test.ts` - NEW Wave 0 RED scaffold pinning the D-01 `organizationCreation.beforeCreate` US-assignment mapping (Plan 02)

## Decisions Made
- **Enum applied via idempotent ALTER, dev DB only.** `migrate dev` is blocked by pre-existing migration-history drift (Phase-82 precedent); used `ALTER TYPE "DataRegion" ADD VALUE IF NOT EXISTS 'US'` against `$DATABASE_URL_EU` then `pnpm --filter @contractor-ops/db db:generate`. `ALTER TYPE ... ADD VALUE` runs as its own statement (cannot be inside a tx; the new value cannot be used in the same tx that adds it).
- **Lockstep guard is GREEN on landing, not RED-first.** A drift-guard for an already-applied change is correctly GREEN once Task 1 widens the enum; making it RED-first would have required reverting Task 1. Sequence: widen enum → assert lockstep.
- **RED scaffolds import not-yet-existing surface.** `retention-policy.test.ts` imports `../retention-policy.js` (Plan 04); `org-creation-region.test.ts` imports `resolveDataRegionFromBilling` from `../config.js` (Plan 02). Both fail today by design (Nyquist Wave 0).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1 verify command referenced a non-existent `.js` artifact**
- **Found during:** Task 1 ([BLOCKING] enum widen)
- **Issue:** The plan's `<automated>` verify ran `node -e "...require('./src/generated/prisma/client/enums.js')..."`, but the db package generates only `enums.ts` at that path (the `.js` lives under `dist/` via the package export map), so the require threw `MODULE_NOT_FOUND`.
- **Fix:** Verified the same contract directly against the generated `enums.ts` — `export const DataRegion` now lists `EU, ME, US`. The substantive done-criterion (generated `DataRegion` includes `US`) is satisfied; only the verify command's file extension was wrong.
- **Files modified:** none (verification-command issue, not a code change)
- **Verification:** `grep -A5 "export const DataRegion" src/generated/prisma/client/enums.ts` shows `US: 'US'`; dev DB `pg_enum` lists EU/ME/US.
- **Committed in:** n/a (no code change; verification adjustment only)

---

**Total deviations:** 1 auto-fixed (1 bug — incorrect verify command, cosmetic)
**Impact on plan:** No scope creep; the enum widen, lockstep assertion, and both scaffolds all match the plan exactly. The only adjustment was verifying the generated enum against the file that actually exists.

## Issues Encountered
- `pnpm --filter @contractor-ops/db prisma generate` failed (no `prisma` script); the package's generate script is `db:generate` — used that. Resolved, client regenerated cleanly.
- Per-wave lint guards (`db:audit-enum-casing`, `lint:schema`) report **pre-existing** failures in unrelated files (`idp-deprovisioning.prisma` lowercase `ManualOverrideCategory` values from Phase 76/77; `UserPinnedView` missing `organizationId` in `auth.prisma`). Both are out of scope per the SCOPE BOUNDARY rule and are logged in `deferred-items.md`. The Phase-83 `DataRegion`/`US` value is **not** flagged — it is UPPER and passes the casing audit.

## Deferred Items
See `83-theme-a-us-region-infrastructure/deferred-items.md`:
- **Per-region PRODUCTION enum apply** of `ALTER TYPE "DataRegion" ADD VALUE 'US'` (EU then ME, then US once provisioned) — LOCAL-ONLY posture; applied to dev DB only this plan. Not hard-blocking.
- Two pre-existing, unrelated lint failures (out of scope).

## User Setup Required
None - no external service configuration required for this plan (US DB/bucket are optional + lazy-throw; no new env added in 83-01).

## Next Phase Readiness
- **Plan 02 (US DB routing):** can now write `dataRegion: 'US'` to Postgres; the `org-creation-region.test.ts` RED scaffold pins the `resolveDataRegionFromBilling` mapping to implement in `packages/auth/src/config.ts`.
- **Plan 04 (IRS retention):** the `retention-policy.test.ts` RED scaffold pins the resolver contract to build at `packages/db/src/retention-policy.ts`.
- **No blockers.** Dev DB enum accepts US; client regenerated; lockstep guard live.

## Self-Check: PASSED

- Files verified: `83-01-SUMMARY.md`, `packages/db/src/__tests__/retention-policy.test.ts`, `packages/auth/src/__tests__/org-creation-region.test.ts` — all FOUND.
- Commits verified: `31932a2b` (Task 1), `af0f599b` (Task 2), `2ae67c17` (Task 3) — all FOUND.

---
*Phase: 83-theme-a-us-region-infrastructure*
*Completed: 2026-06-07*
