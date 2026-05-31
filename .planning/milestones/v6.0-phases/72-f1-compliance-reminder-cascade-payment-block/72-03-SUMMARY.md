---
phase: 72-f1-compliance-reminder-cascade-payment-block
plan: 03
subsystem: api
tags: [cron, compliance, reminders, notifications, date-fns, optimistic-concurrency, dedup]

requires:
  - phase: 72-02
    provides: ContractorComplianceReminderState table + ReminderBand enum the orchestrator reads/writes
provides:
  - runComplianceReminderScan band-state-machine cron orchestrator (COMPL-03)
  - onComplianceItemExpiresAtChanged renewal-reset listener (D-06)
  - cron-dedup.ts canonical helper home in @contractor-ops/api
  - daysUntilExpiryInTz/jurisdictionDate TZ helpers in @contractor-ops/compliance-policy
  - compliance.expiry_digest notification type
affects: [72-08]

tech-stack:
  added: []
  patterns:
    - "Two-pass cron (collect per-recipient → ONE dedup-gated digest) — fixes v1.0 reminder fatigue"
    - "Optimistic-concurrency (version column) guards cron writes vs renewal-reset listener"
    - "Cross-package helper home: API owns cron-dedup, cron-worker re-exports (API cannot depend on apps/*)"

key-files:
  created:
    - packages/api/src/services/compliance-reminder-scan.ts
    - packages/api/src/services/cron-dedup.ts
  modified:
    - packages/api/src/services/__tests__/compliance-reminder-scan.test.ts
    - packages/api/package.json
    - packages/compliance-policy/src/expiry.ts
    - packages/compliance-policy/src/index.ts
    - packages/validators/src/notification.ts
    - apps/cron-worker/src/jobs/handlers/reminders/shared.ts

key-decisions:
  - "TZ day-math (daysUntilExpiryInTz/jurisdictionDate) lives in @contractor-ops/compliance-policy (owns date-fns/@date-fns/tz; Phase 71 D-07) — API imports it instead of adding the deps to the API package."
  - "Recipients use the existing contractor:read RBAC gate — resolveRbacRecipients is typed to ContractorPermission and there is no compliance:read in that union; compliance reads are gated behind contractor:read in this RBAC model (same gate the economic-dependency twin uses)."
  - "Contractor-self recipient dropped: Contractor has no userId/User link (portal auth via PortalSession), and dispatch() only takes platform user IDs. Direct contractor-email reminders are Phase 73 portal scope. Phase 72 dispatches the admin digest only."
  - "Added compliance.expiry_digest to NOTIFICATION_TYPES (validators) — required for dispatch() to typecheck; not listed in the plan's files_modified but a necessary cross-package dependency."
  - "Extracted persistBandFire + collectPendingFires + dispatchDigests helpers to keep both functions under the biome cognitive-complexity-15 threshold (0 warnings)."

patterns-established:
  - "Compliance reminder cascade is the band-state-machine twin of economic-dependency-scan, minus the 30-day re-fire cadence (bands ARE the cadence)"

requirements-completed: [COMPL-03]

duration: ~35 min
completed: 2026-05-31
---

# Phase 72 Plan 03: Compliance Reminder Cascade Cron Orchestrator Summary

**`runComplianceReminderScan` — a two-pass band-state-machine cron (90/60/30/15/7 + EXPIRED) that classifies BLOCKING compliance-item expiry, fires per-band dedup-gated transitions with optimistic-concurrency against the renewal-reset listener, and dispatches exactly ONE digest notification per recipient per jurisdiction-day.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-05-31
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Band classifier `bandFor` + `bandIndex` with exhaustive boundary coverage
- Two-pass orchestrator: Pass 1 per-band dedup + per-recipient grouping, Pass 2 ONE digest per recipient/day
- `onComplianceItemExpiresAtChanged` renewal-reset listener — resets to NONE, version bump, `compliance.reminder.reset` AuditLog
- `cron-dedup.ts` moved into the API package; cron-worker `shared.ts` re-exports it (single source of truth)
- TZ helpers added to `@contractor-ops/compliance-policy`; `compliance.expiry_digest` notification type added
- 13 GREEN unit tests (4 originally-RED + 9 hardening: filtering, resilience, dispatch-failure, top-level-catch)
- api + cron-worker typecheck clean; cron-worker reminders test still passes (re-export verified); biome 0 warnings

## Task Commits
1. **Orchestrator + cron-dedup + re-export + exports + notification type + GREEN tests (Tasks 72-03-01..03)** - `ebb29c6b` (feat)

## Files Created/Modified
- `packages/api/src/services/compliance-reminder-scan.ts` - orchestrator + listener + pure helpers
- `packages/api/src/services/cron-dedup.ts` - canonical DB-unique-index dedup helper
- `packages/api/src/services/__tests__/compliance-reminder-scan.test.ts` - 13 GREEN tests
- `packages/api/package.json` - ./services/cron-dedup + ./services/compliance-reminder-scan exports
- `packages/compliance-policy/src/expiry.ts` + `index.ts` - daysUntilExpiryInTz, jurisdictionDate
- `packages/validators/src/notification.ts` - compliance.expiry_digest type
- `apps/cron-worker/src/jobs/handlers/reminders/shared.ts` - re-export from API cron-dedup

## Decisions Made
See key-decisions frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] compliance.expiry_digest notification type**
- Found during: Task 72-03-01. dispatch()'s `type` is constrained to NOTIFICATION_TYPES; the plan's `compliance.expiry_digest` wasn't registered → typecheck failure.
- Fix: added the type to `packages/validators/src/notification.ts`.
- Committed in: `ebb29c6b`.

**2. [Rule 1 - Bug] date-fns not an API dependency**
- Found during: Task 72-03-01. Plan imported `@date-fns/tz`/`date-fns` directly in the API package, which doesn't depend on them.
- Fix: moved TZ math into `@contractor-ops/compliance-policy/expiry` (which owns the deps) and imported from there — also the plan's stated TZ source-of-truth.
- Committed in: `ebb29c6b`.

**3. [Rule 1 - Bug] resolveRbacRecipients permission type + Contractor.userId**
- Found during: Task 72-03-01. `resolveRbacRecipients` only accepts ContractorPermission (`contractor:read`/`contractor:update`), not `compliance:read`; and `Contractor` has no `userId` field.
- Fix: used `contractor:read`; dropped the contractor-self recipient (not a platform User; portal email is Phase 73).
- Committed in: `ebb29c6b`.

**4. [Rule 3 - Blocking] stale @contractor-ops/db dist exposed via build output**
- Found during: Task 72-03-01 typecheck — `prisma.contractorComplianceReminderState` not on the delegate type.
- Fix: rebuilt the db package (`dist/` is what the API resolves) so the regenerated client's new delegates are visible. (db dist was committed under 72-02's generated-client commit.)
- Committed in: covered by `aa89135b` (db build output) / verified here.

---

**Total deviations:** 4 auto-fixed (1 missing-critical, 2 bug, 1 blocking). Plus a quality refactor (helper extraction) to clear cognitive-complexity warnings.
**Impact on plan:** Orchestrator behaviour is exactly as the plan specified; deviations were integration corrections against the real workspace types. No scope creep.

## Issues Encountered
- A pre-existing unrelated test-collection failure (`getIdpAuditLogger` not exported on a logger mock in Phase 76's `deprovisioning.ts`/`user.test.ts`) surfaces when running the API suite by broad `--testNamePattern`. Not introduced here — verified my test file passes in isolation (13/13). Flagged for the Phase 76 owner.

## User Setup Required
None.

## Next Phase Readiness
- COMPL-03 engine is implemented and GREEN. Cron wiring into the reminders handler is Plan 72-08 (Wave 5). Wave 2 sibling 72-04 (payment-block helper) follows next.

---
*Phase: 72-f1-compliance-reminder-cascade-payment-block*
*Completed: 2026-05-31*
