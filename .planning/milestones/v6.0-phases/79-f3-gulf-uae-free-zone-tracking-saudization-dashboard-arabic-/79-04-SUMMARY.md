---
phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-
plan: 04
subsystem: api
tags: [gulf, saudization, nitaqat, isic, noc, permitted-activity, compliance, deterministic-derivation]

# Dependency graph
requires:
  - phase: 79-01
    provides: RED test scaffolds (C5/C6/C7) + gulf-fixtures factory
  - phase: 79-02
    provides: Gulf Prisma models/enums (NitaqatBand, SaudiHeadcount, SaudizationConfig, Contract.activityIsicCodes, ContractorAssignment.isSaudi/qiwaContractAuthenticated) — generate-only, types available
provides:
  - checkPermittedActivityScope (permitted-activity-check.ts) — deterministic ISIC set-overlap + auto-NOC WARNING ContractorComplianceItem, skip-on-uncoded, non-gating
  - computeSaudizationDashboard (saudization-dashboard.ts) — rate-from-manual derivation + Qiwa gap count + Iqama roll-up + quarterly-reentry flag + subordinate platform breakdown; band read-through (never computed)
  - projectOffboardingTrajectory (saudization-dashboard.ts) — ephemeral SaudiHeadcount-1 recompute, advisory + non-authoritative, no persistence/gating
  - NitaqatBand type re-export from @contractor-ops/db index
affects: [79-05 contract-create wiring, 79-06 gulf routers, 79-07 offboarding trajectory banner UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural-client + writeAuditLog service pattern mirrored from free-zone-compliance.ts (composes inside contract-create $transaction)"
    - "Pure params-in/result-out derivation mirroring computeComplianceHealth (no DB client, no writes, no throws)"
    - "NOC item carries documentType OTHER (no NOC enum value; disambiguated by name + policyRuleId) — avoids a schema migration in a pure-logic plan"

key-files:
  created:
    - packages/api/src/services/permitted-activity-check.ts
    - packages/api/src/services/saudization-dashboard.ts
  modified:
    - packages/api/src/__tests__/permitted-activity-noc.test.ts
    - packages/api/src/__tests__/saudization-derivation.test.ts
    - packages/db/src/index.ts

key-decisions:
  - "NOC documentType = OTHER (DocumentType enum has no NOC member; Plan 02 landed generate-only so no new enum/migration in this pure-logic plan); NOC identified by name + policyRuleId uae.permitted_activity_noc@v1"
  - "Permitted-activity check skips symmetrically — empty contract codes OR empty permitted codes → { skipped: true } (D-08 has nothing deterministic to compare either way)"
  - "Nationalisation rate computed ONLY from manual SaudiHeadcount; null when no headcount recorded (no platform fallback) (D-10/Pitfall 7)"
  - "Band is read-through from SaudizationConfig; zero band-derivation code path exists (Pitfall 8)"
  - "projectOffboardingTrajectory returns advisory:true + authoritative:false, surfaces currentBand only, never a projectedBand (D-12)"
  - "Exported NitaqatBand type from @contractor-ops/db index (curated re-export pattern) so the api package can type the band read-through (Rule 3 blocking-issue fix)"

requirements-completed: [GULF-03, GULF-05, GULF-06, GULF-07]

# Metrics
duration: 10min
completed: 2026-06-03
---

# Phase 79 Plan 04: Permitted-Activity Scope Check + Saudization Dashboard Derivation Summary

**Deterministic ISIC-overlap scope check with auto-NOC (GULF-03) and pure Saudization dashboard derivation + ephemeral offboarding trajectory (GULF-05/06/07) — rate from manual headcount only, band never auto-computed, trajectory advisory-only; C5/C6/C7 GREEN, no engine changes.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2 (both TDD: RED test commit → GREEN implementation commit)
- **Files:** 2 created, 3 modified

## Accomplishments

### Task 1 — Permitted-activity ISIC scope check + auto-NOC (C5, GULF-03)
- `checkPermittedActivityScope(client, ctx)` in `permitted-activity-check.ts`:
  - Empty contract codes OR empty permitted codes → `{ skipped: true }` (D-08, symmetric skip — nothing deterministic to compare).
  - Exact set-membership overlap (D-06, no fuzzy/prefix logic) → overlap present returns `{ mismatch: false }`.
  - Zero overlap → creates a `WARNING` NOC `ContractorComplianceItem` scoped to the `contractId` (status `MISSING`) and returns `{ mismatch: true, nocItemCreated: true }`. **Non-blocking** — never throws, so the contract-create path (Plan 05) proceeds (D-07).
  - System-side auto-creation is audited via `writeAuditLog` (`gulf.permitted_activity.noc.create`) on the same structural client + Pino `info` (D-17). Mirrors `free-zone-compliance.ts`.

### Task 2 — Saudization dashboard derivation + offboarding trajectory (C6/C7, GULF-05/06/07)
- `computeSaudizationDashboard(params)` — pure derivation mirroring `computeComplianceHealth`:
  - `nationalisationRate = saudiHeadcount / totalHeadcount` from the **manual** `SaudiHeadcount` only; `null` when no headcount recorded — the platform contractor list NEVER drives the rate (D-10/Pitfall 7).
  - `band` is **read-through** from `SaudizationConfig` — no band-derivation code path exists (Pitfall 8); `null` when never recorded.
  - `quarterlyReentryDue` (band older than ~90 days), `qiwaGapCount` (contracts WHERE `qiwaContractAuthenticated=false`, D-11 visibility-only), `iqamaRollup` (total/expired/expiringSoon bucketed from reused ksa.iqama F1 expiry data), and a subordinate `platformDerived` contractor breakdown returned side-by-side.
- `projectOffboardingTrajectory(params)` — live ephemeral recompute (D-12): projects `SaudiHeadcount` minus one (Saudi count drops only if the leaver is Saudi); returns `{ currentRate, projectedRate, currentBand, advisory: true, authoritative: false }`. No persistence, no gating, no throw, surfaces only the recorded `currentBand` (never a projected band).

## Task Commits

1. **Task 1 RED** — `d9fa15be` `test(79-04): assert permitted-activity ISIC scope check + auto-NOC (C5)`
2. **Task 1 GREEN** — `7bb17122` `feat(79-04): implement permitted-activity ISIC scope check + auto-NOC (C5, GULF-03)`
3. **Task 2 RED** — `aaca1458` `test(79-04): assert saudization rate-from-manual + ephemeral trajectory (C6/C7)`
4. **Task 2 GREEN** — `c8c8f332` `feat(79-04): saudization dashboard derivation + offboarding trajectory (C6/C7, GULF-05/06/07)`

## Verification

- `pnpm --filter @contractor-ops/api exec vitest run src/__tests__/permitted-activity-noc.test.ts src/__tests__/saudization-derivation.test.ts` → **2 files, 16 tests passed** (6 permitted-activity + 10 saudization).
- `pnpm typecheck --filter=@contractor-ops/db --filter=@contractor-ops/api` → CLEAN.
- `pnpm lint:silent-catch` → CLEAN (no silent catch in 3000 scanned files).
- Acceptance greps:
  - `skipped: true|length === 0` in permitted-activity-check.ts = 3 (≥1 ✓, D-08)
  - `WARNING` in permitted-activity-check.ts = 2 (≥1 ✓, D-07)
  - `saudiHeadcount|totalHeadcount` in saudization-dashboard.ts = 15 (≥1 ✓, D-10)
  - `computeBand|deriveBand|inferBand|autoBand` in saudization-dashboard.ts = 0 (==0 ✓, Pitfall 8)
  - `authoritative: false|advisory` in saudization-dashboard.ts = 7 (≥1 ✓, D-12)
- No `classification-engine` / classification path files touched.

## Decisions Made

- **NOC documentType = `OTHER`.** The `DocumentType` enum carries no NOC member, and Plan 02 landed its schema generate-only (DB apply deferred). Adding a `NOC_*` enum value here would require a schema migration + regen — out of scope for a pure-logic plan. The NOC item is unambiguously identified by `name` ("No-Objection Certificate (NOC) — activity scope") + `policyRuleId` (`uae.permitted_activity_noc@v1`). The plan's `read_first` explicitly sanctioned this fallback ("else use an existing generic doc type and note it"). When a future schema wave adds a `NOC_NO_OBJECTION_CERTIFICATE` enum value, `NOC_DOCUMENT_TYPE` is a single exported constant to swap.
- **Symmetric skip.** A contractor with no recorded permitted codes is treated the same as an uncoded contract — `{ skipped: true }` — because there is nothing deterministic to compare in either direction (D-08 intent).
- **NitaqatBand type re-export** added to the `@contractor-ops/db` index curated `export type` block (joining `ContractType`/`TaxIdType`/`ValidationStatus`) so the api package can strongly type the read-through band.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Export `NitaqatBand` type from `@contractor-ops/db` index**
- **Found during:** Task 2 (typecheck)
- **Issue:** `saudization-dashboard.ts` needs the `NitaqatBand` type to type the read-through band, but the db package `index.ts` only re-exported a curated subset of generated enum types (`ContractType`, `TaxIdType`, `ValidationStatus`) — `NitaqatBand` was not exposed, so `import type { NitaqatBand } from '@contractor-ops/db'` failed typecheck (TS2305).
- **Fix:** Added `NitaqatBand` to the existing curated `export type { ... } from './generated/prisma/client/client.js'` block (one line; `client.js` already `export * from "./enums.js"`). Follows the established curated re-export pattern; no new export surface invented.
- **Files modified:** `packages/db/src/index.ts`
- **Commit:** `c8c8f332`

No other deviations — both service files mirror the in-tree `free-zone-compliance.ts` / `computeComplianceHealth` patterns as the plan directed.

## Known Stubs

None. Both services are fully implemented deterministic logic. They are intentionally **not yet wired** into the contract-create path (Plan 05) or the gulf routers (Plan 06) — that wiring is explicitly scoped to downstream waves per the plan ("This service is invoked from the contract-create path, wired in Plan 05"). This is a planned integration boundary, not a stub.

## Threat Surface Scan

No new security-relevant surface introduced beyond the plan's `<threat_model>`. Both functions are pure/structural (no network, no auth path, no direct schema mutation at a trust boundary). The threat register's `mitigate` dispositions are satisfied:
- T-79-04-01 (band-as-authoritative): `projectOffboardingTrajectory` returns `authoritative:false` + `advisory:true`, asserts no band — C7 tests assert this.
- T-79-04-02 (rate from platform): rate computed from manual `SaudiHeadcount` only; null without manual numbers — C6 tests assert the platform list does not drive it.
- T-79-04-03 (over-flagging uncoded): symmetric skip-on-uncoded — C5 uncoded test asserts it.
- T-79-04-SC (package installs): none added.

## Self-Check: PASSED

- Files verified present: `permitted-activity-check.ts`, `saudization-dashboard.ts`, both test files, `packages/db/src/index.ts`.
- Commits verified present: `d9fa15be`, `7bb17122`, `aaca1458`, `c8c8f332`.

---
*Phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-*
*Completed: 2026-06-03*
