---
phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-
plan: 03
subsystem: api
tags: [compliance-policy, payment-block, multi-region, prisma, cron, free-zone, uae, gulf, region-leakage-lint]

# Dependency graph
requires:
  - phase: 79-01
    provides: RED test scaffolds (C1/C2/C3/C4) + gulf-fixtures factory (makeFreeZoneAssignment/makeFreeZoneComplianceItem/makeMeOrg)
  - phase: 79-02
    provides: 4 Gulf Prisma models + UaeFreeZoneCode/NitaqatBand enums + regenerated client (generate-only; DB apply deferred)
provides:
  - "uae.free_zone_license bumped WARNING@v1 → BLOCKING@v2 with appliesIf:()=>false (classification path never materialises free-zone — Pitfall 2)"
  - "free-zone-compliance.ts service: writeFreeZoneComplianceItem (zone!=='MAINLAND' gate D-04, isExpired-derived PENDING/EXPIRED status, writeAuditLog D-17) + reEvaluateFreeZoneStatus"
  - "Supersession isolation: supersedeAndMaterialise excludes uae.free_zone* rows from the WAIVE scope (Pitfall 2)"
  - "Region-aware compliance reminder cron: runComplianceReminderScan fans out over SUPPORTED_REGIONS via getRegionalClient; runComplianceReminderScanForClient threads a regional client; region-prefixed dedup keys (Pitfall 18)"
  - "GULF-11 region-leakage lint (packages/db/scripts/lint-region-leakage.ts) wired into lint:ci"
  - "C1/C2/C3/C4/C8 RED scaffolds turned GREEN"
affects: [79-04, gulf free-zone router, saudization dashboard, free-zone form UI, payment-block flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Out-of-band compliance-item write from a domain service (free-zone), keyed off FreeZoneAssignment NOT the classification policy resolution (Pitfall 2)"
    - "Zone narrowing (D-04) lives in the service write, not in policy appliesIf (EngagementContext has no zone discriminator — Pitfall 3)"
    - "TZ-aware status derivation at write/re-evaluate time via isExpired (no new PENDING→EXPIRED sweep)"
    - "Cron region fan-out: loop SUPPORTED_REGIONS + getRegionalClient(region) in try/catch, thread the regional client through the worker, region-prefix dedup keys (Pitfall 18)"
    - "Supersession exclusion filter (policyRuleId NOT startsWith 'uae.free_zone') to protect out-of-band rows from unrelated recompute WAIVE"
    - "Region-leakage lint: grep API/cron source for default-client (prisma./prismaRaw.) reads of region-routed models; allow ctx.db + threaded regional clients (Pitfall 19)"

key-files:
  created:
    - packages/api/src/services/free-zone-compliance.ts
    - packages/db/scripts/lint-region-leakage.ts
  modified:
    - packages/compliance-policy/src/policies/uae.ts
    - packages/api/src/services/compliance-supersession.ts
    - packages/api/src/services/compliance-reminder-scan.ts
    - packages/api/src/services/__tests__/compliance-reminder-scan.test.ts
    - packages/api/src/__tests__/free-zone-payment-block.test.ts
    - packages/api/src/__tests__/free-zone-mainland-exclusion.test.ts
    - packages/api/src/__tests__/free-zone-supersession-isolation.test.ts
    - packages/api/src/__tests__/reminder-region-fanout.test.ts
    - packages/validators/src/legal/compliance-uae.ts
    - packages/validators/src/legal/signoff-registry.json
    - packages/db/package.json
    - package.json

key-decisions:
  - "POLICY_RULE_SET_VERSION NOT bumped: it is locked to v${pkg.version} (=v6.0.0) by version.test.ts and is the milestone-wide snapshot const, not the per-rule rotation mechanism. The @v2 suffix on the policyRuleId IS the rotation (parsePolicyRuleId/POLICY_RULE_ID_RE already accept @v2). Bumping the const would break version.test.ts + change the ClassificationAssessment snapshot version — out of scope for a single-rule severity bump (Rule 4 boundary — flagged, not actioned)."
  - "appliesIf:()=>false on @v2 (D-04/Pitfall 2): the classification path must NEVER materialise free-zone (EngagementContext has no zone field → would arm BLOCKING for Mainland). The row is written out-of-band from free-zone-compliance.ts where the zone!=='MAINLAND' gate lives."
  - "Status derived at write time via isExpired (Open Q2): no codebase sweep flips PENDING→EXPIRED, so the service computes status on write and reEvaluateFreeZoneStatus is exposed for the cron fan-out to transition Gulf items."
  - "Region fan-out keeps a signature-compatible public entry (runComplianceReminderScan()) so the cron handler call site is untouched; the per-region worker runComplianceReminderScanForClient takes the regional client + region label."

patterns-established:
  - "Out-of-band compliance-item materialisation guarded against supersession WAIVE via a policyRuleId NOT-startsWith exclusion"
  - "Region-leakage CI lint as the GULF-11 enforcement mechanism (comment-stripped grep of default-client model reads)"

requirements-completed: [GULF-02, GULF-11]

# Metrics
duration: 35min
completed: 2026-06-03
---

# Phase 79 Plan 03: Free-Zone License Expiry → F1 Cascade + Payment Hard-Block Summary

**Free-zone license expiry now flows into the existing F1 reminder cascade + payment hard-block: the policy rule is BLOCKING @v2, the compliance item is written out-of-band from the FreeZoneAssignment service with a Mainland gate + supersession isolation, the reminder cron fans out across SUPPORTED_REGIONS so ME items enter the cascade, and a GULF-11 region-leakage lint guards the 4 Gulf models.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-03T08:46:00Z
- **Completed:** 2026-06-03T09:02:52Z
- **Tasks:** 3 (+ 1 Rule-1 auto-fix)
- **Files modified:** 12 (2 created, 10 modified)

## Accomplishments

- **C1/C2/C4 (money gate):** `uae.free_zone_license` bumped `WARNING@v1 → BLOCKING@v2` with `appliesIf:()=>false`; new `free-zone-compliance.ts` writes the `ContractorComplianceItem` out-of-band from the `FreeZoneAssignment` service with the `zone!=='MAINLAND'` gate (D-04), `isExpired`-derived `PENDING`/`EXPIRED` status, and a `writeAuditLog` (D-17). An EXPIRED free-zone item hard-blocks payment through the unchanged `assertContractorPaymentEligibility` gate; Mainland writes no item.
- **Supersession isolation (Pitfall 2):** `supersedeAndMaterialise` now excludes `uae.free_zone*` rows from the non-WAIVED findMany scope, so an unrelated classification recompute can never orphan the free-zone payment-block row.
- **C3 (Pitfall 18):** `runComplianceReminderScan` fans out over `SUPPORTED_REGIONS`, resolving a regional client per region via `getRegionalClient`; the per-region worker `runComplianceReminderScanForClient` threads that client through the two-pass scan (no module-level `prismaRaw` close-over). ME-region BLOCKING free-zone items now enter the 90/60/30/15/7 cascade; unconfigured regions skip with a Pino warn; band + digest dedup keys are region-prefixed.
- **C8 (Pitfall 19):** New `lint-region-leakage.ts` greps `packages/api/src` + `apps/cron-worker/src` for default-client (`prisma.`/`prismaRaw.`) reads of the 4 Gulf models and fails on any; wired into `lint:ci`. Exit 0 on the clean tree; a seeded read exits 1 (verified, scratch removed).
- All 4 targeted RED scaffolds (C1/C2/C3/C4) GREEN (14 tests); existing reminder-scan (15 tests) + compliance-policy (34) + supersession suites unaffected by the GREEN work.

## Task Commits

Each task committed atomically:

1. **Task 1: Policy bump @v2 + free-zone-compliance service (C1/C2/C4)** — `0c77b058` (feat)
2. **Task 2: Reminder-cron region fan-out (C3, Pitfall 18)** — `2295f3eb` (feat)
3. **Task 3: GULF-11 region-leakage lint (C8, Pitfall 19)** — `0fe3d8e0` (feat)
4. **Rule-1 auto-fix: rotate UAE free-zone locked-name + signoff key to @v2** — `da2ab007` (fix)

**Plan metadata:** committed alongside this SUMMARY (docs: complete plan).

## Files Created/Modified

- `packages/compliance-policy/src/policies/uae.ts` — free-zone rule `WARNING@v1 → BLOCKING@v2`, `appliesIf:()=>false`
- `packages/api/src/services/free-zone-compliance.ts` *(new)* — `writeFreeZoneComplianceItem` (Mainland gate, isExpired status, audit log) + `reEvaluateFreeZoneStatus`
- `packages/api/src/services/compliance-supersession.ts` — exclude `uae.free_zone*` from the WAIVE scope
- `packages/api/src/services/compliance-reminder-scan.ts` — region fan-out + `runComplianceReminderScanForClient` + region-prefixed dedup keys
- `packages/api/src/services/__tests__/compliance-reminder-scan.test.ts` — db-mock now exposes `SUPPORTED_REGIONS`/`getRegionalClient` (single-region) so existing assertions hold
- `packages/api/src/__tests__/free-zone-payment-block.test.ts` / `free-zone-mainland-exclusion.test.ts` / `free-zone-supersession-isolation.test.ts` / `reminder-region-fanout.test.ts` — GREEN assertions (were `describe.todo` scaffolds)
- `packages/validators/src/legal/compliance-uae.ts` + `signoff-registry.json` — locked-name + signoff key `@v1 → @v2` (Rule 1)
- `packages/db/scripts/lint-region-leakage.ts` *(new)* + `packages/db/package.json` + `package.json` — GULF-11 lint registered into `lint:ci`

## Decisions Made

- **POLICY_RULE_SET_VERSION NOT bumped (Rule-4 boundary, flagged not actioned).** The plan's action text said "bump POLICY_RULE_SET_VERSION", but that const is locked to `v${pkg.version}` (=`v6.0.0`) by `version.test.ts` and is snapshotted onto `ClassificationAssessment` as the milestone-wide rule-set version. It is NOT the per-rule rotation mechanism — the `@v2` suffix on the `policyRuleId` is (the registry regex + `parsePolicyRuleId` already accept `@v2`, and the gate/cascade/tests key off `uae.free_zone_license@v2`). Bumping the milestone const would (a) break `version.test.ts` and (b) require a `compliance-policy` package semver bump with cross-cutting snapshot impact — disproportionate to a single-rule severity change. The `@v2` rotation alone satisfies every must-have and turns all targeted tests GREEN.
- **`appliesIf:()=>false`** keeps the classification path from ever materialising the free-zone item (Pitfall 2); the Mainland narrowing (D-04) lives in the service write (Pitfall 3).
- **Status derived via `isExpired` at write/re-evaluate time** (Open Q2) — no new background sweep.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rotated UAE free-zone locked-name + signoff key to `@v2`**
- **Found during:** Post-Task-3 verification (`compl-doc-names-parity.test.ts`)
- **Issue:** Bumping the rule to `uae.free_zone_license@v2` orphaned the `@v1`-keyed `LOCKED_COMPL_NAMES_UAE` entry and the `COMPL_DOCNAME_uae_free_zone_license_v1` signoff entry. The parity guard requires every REGISTERED policyRuleId to have both → 2 failing assertions caused directly by the version bump.
- **Fix:** Renamed both keys `@v1 → @v2` (net-zero count; locale phrases + PENDING status unchanged).
- **Files modified:** `packages/validators/src/legal/compliance-uae.ts`, `packages/validators/src/legal/signoff-registry.json`
- **Verification:** `compl-doc-names-parity.test.ts` 22/22 GREEN; validators + api typecheck clean.
- **Committed in:** `da2ab007`

---

**Total deviations:** 1 auto-fixed (1 Rule-1 bug, directly caused by the planned `@v2` bump).
**Impact on plan:** The fix was a required consequence of the bump (parity guard correctness). No scope creep. The POLICY_RULE_SET_VERSION decision is a documented Rule-4 boundary (not a code change).

## Issues Encountered

- **Pre-existing classification-supersession count drift (NOT caused by 79-03).** `classification-supersession.test.ts` asserts `inserted===4` (UK) / `insertedCount===1` (DE); actual is `5` / `2` because Phase 75 added `uk.ip_assignment@v1` and a 4th DE rule. `resolvePolicyRules` filters by jurisdiction, so my UAE-only edit cannot change these counts — this is the documented "v6.0 standards audit pending" drift. Logged in `deferred-items.md`. (My free-zone supersession exclusion does NOT alter the UK/DE WAIVE outcome — those rows are not `uae.free_zone*`.)
- **Pre-existing `locked-phrases-guard.test.ts:587` count drift (NOT caused by 79-03).** `getAllPending()` expects `29`, actual `48` (registry growth across phases). My `@v1→@v2` rename is net-zero on the count. Already in `deferred-items.md`.
- Vitest filename filtering via `pnpm test -- <pattern>` runs the WHOLE suite; scoped runs must use `pnpm exec vitest run <exact-path>` from the package dir. All targeted verifications used the scoped form.

## User Setup Required

None — no external service configuration required. The free-zone `ContractorComplianceItem` writes against the regenerated Prisma client types; the live DB migration apply for the Gulf models remains deferred post-deploy (79-02 decision) and is a prerequisite only for persisting real Gulf data, not for type-checking or this wave's unit tests.

## Next Phase Readiness

- The money gate (GULF-02) is wired: free-zone expiry → BLOCKING @v2 → `assertContractorPaymentEligibility` hard-block; Mainland excluded; ME items enter the cascade; supersession isolated; cross-region leakage lint-guarded. C1/C2/C3/C4/C8 GREEN.
- `writeFreeZoneComplianceItem` is ready to be called from the 79-04 free-zone CRUD router (on assignment create/update/migrate) with a tenant-scoped `ctx.db` client; `reEvaluateFreeZoneStatus` is available for any cron path that needs the PENDING→EXPIRED transition.
- The GULF-11 region-leakage lint is in `lint:ci` and will fail CI if any future router/service reads the 4 Gulf models via the default client.
- **Blocker for prod only:** the deferred Gulf migration apply (79-02) must run post-deploy before any free-zone item references a real `FreeZoneAssignment` row.

## Self-Check: PASSED

- Files verified present: `free-zone-compliance.ts`, `lint-region-leakage.ts`, `79-03-SUMMARY.md`
- Commits verified present: `0c77b058`, `2295f3eb`, `0fe3d8e0`, `da2ab007`

---
*Phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-*
*Completed: 2026-06-03*
