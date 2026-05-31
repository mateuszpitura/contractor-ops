---
phase: 72-f1-compliance-reminder-cascade-payment-block
plan: 08
subsystem: infra
tags: [cron, reminders, feature-flags, signoff-registry, metrics]

requires:
  - phase: 72-03
    provides: runComplianceReminderScan orchestrator
  - phase: 72-04
    provides: compliance-payment-block flag consumed by isPaymentBlockEnforced
provides:
  - COMPL-03 cron orchestrator wired into the reminders job (production-firing)
  - compliance-payment-block PENDING signoff-registry entry (flips the Wave 0 scaffold GREEN)
affects: []

tech-stack:
  added: []
  patterns:
    - "Piggyback the existing reminders cron job (no new schedule/handler); add the orchestrator as a Promise.all member"
    - "Crash-safe orchestrator integration (internal try/catch returns zeroes; cannot abort the shared tx)"

key-files:
  created: []
  modified:
    - apps/cron-worker/src/jobs/handlers/reminders/index.ts
    - apps/cron-worker/src/__tests__/reminders.test.ts
    - packages/feature-flags/src/signoff-registry-flags.json

key-decisions:
  - "runComplianceReminderScan added as the 5th Promise.all member in the reminders handler (the tree already had evaluateReminderRules/detectOverdueTasks/detectDrvClearanceExpiries/gcIdpProvenance from earlier phases). Reused the existing CRON_REMINDERS_SCHEDULE job, Sentry tag, and advisory lock — no new cron job."
  - "compliance-payment-block registered as PENDING (not APPROVED) — production stays OFF (would-block soft-warn) until legal review of the admin lockout copy; FLAG_SIGNOFF_BYPASS=local hard-blocks in dev. Standing Constraint: legal review DEFERRED post-deploy."
  - "compliance-payment-block-entry.test.ts (Wave 0 scaffold) required no edit — the registry entry alone flips it from RED to GREEN."

patterns-established: []

requirements-completed: [COMPL-03, COMPL-05]

duration: ~20 min
completed: 2026-05-31
---

# Phase 72 Plan 08: Cron Wiring + Feature-Flag Registry Entry Summary

**The COMPL-03 compliance-reminder cron orchestrator now fires on the existing `reminders` cron schedule (added crash-safely as a fifth Promise.all member with its own metrics gauges), and the `compliance-payment-block` feature flag is registered PENDING in the signoff registry — completing Phase 72 end-to-end.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-05-31
- **Tasks:** 5
- **Files modified:** 3

## Accomplishments
- `runComplianceReminderScan()` wired into `remindersHandler` (5th Promise.all member, inside the advisory-locked tx); crash-safe (helper never throws)
- New gauges `cron.reminders.compliance_reminder_fires` / `_digests`; handler details carry the counts
- `compliance-payment-block` PENDING entry in `signoff-registry-flags.json` (boot-gate validates it)
- reminders test extended with the orchestrator mock + count assertions (5/5 GREEN)
- Wave 0 `compliance-payment-block-entry` scaffold now GREEN (full feature-flags suite 65/65)
- cron-worker + feature-flags typecheck clean; biome clean (one pre-existing stale-suppression warning on the untouched evaluateReminderRules)

## Task Commits
1. **Cron wiring + flag entry + reminders test (Tasks 72-08-01..05)** - `b51802d8` (feat)

## Decisions Made
See key-decisions frontmatter.

## Deviations from Plan
None of substance. The handler already had a 4th orchestrator (Phase 76 gcIdpProvenance) so the compliance scan became the 5th member — the wiring pattern is exactly as the plan specified.

**Total deviations:** 0 (plan executed as written against the current tree).

## Issues Encountered
- Pre-existing biome `suppressions/unused` warning on `evaluateReminderRules` (a stale `biome-ignore` from an earlier phase — confirmed present on the unmodified HEAD). Not introduced here; left untouched (another phase's code, warn-level).

## User Setup Required

**Deferred manual post-deploy items (per VALIDATION.md / Standing Constraints):**
- Multi-region migration apply: `pnpm --filter @contractor-ops/db db:migrate:all` per region (Phase 72 migrations 20260531170000/170001/170002). Tracked as a STATE.md blocker.
- End-to-end cron tick → digest email observation in a seeded environment.
- Legal review of the admin lockout copy → flip `compliance-payment-block` PENDING → APPROVED.

## Next Phase Readiness
- Phase 72 implementation complete (8/8 plans). COMPL-03/05/06/07 covered end-to-end. Ready for phase verification.

---
*Phase: 72-f1-compliance-reminder-cascade-payment-block*
*Completed: 2026-05-31*
