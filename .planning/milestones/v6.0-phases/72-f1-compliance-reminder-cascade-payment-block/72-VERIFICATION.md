---
phase: 72-f1-compliance-reminder-cascade-payment-block
status: human_needed
verified: 2026-05-31
requirements: [COMPL-03, COMPL-05, COMPL-06, COMPL-07]
must_haves_verified: 4
must_haves_total: 4
automated_checks: passed
---

# Phase 72 Verification

**Goal:** Contractors and admins receive timely expiry reminders without notification
fatigue; admins cannot accidentally pay a contractor whose CRITICAL document is expired,
regardless of whether they came in through the payment-run wizard or the auto-`READY`
path from approvals.

Verified inline (the gsd-verifier agent is unavailable in this background runtime). All
automated gates pass; remaining items are deferred manual UAT per VALIDATION.md.

## Automated checks — PASSED

- `pnpm typecheck` (workspace-wide, CI-canonical tsc): **43/43 tasks**, exit 0.
- `pnpm --filter @contractor-ops/db db:check-drift`: committed Prisma client in sync.
- `gsd-sdk query verify.schema-drift 72`: `drift_detected: false`.
- biome: clean across all Phase 72 production source (only pre-existing warns remain).
- Per-package Phase 72 tests GREEN: db 10, api 79 (6 service files incl. legacy
  approval-engine backward-compat), web-vite 6, cron-worker 5, feature-flags 65,
  lint-guards 3 — well above the ≥30 cumulative target.

## Requirement traceability

### COMPL-03 — Reminder cascade engine — VERIFIED
- `compliance-reminder-scan.ts` exports `runComplianceReminderScan` (band state machine
  90/60/30/15/7/EXPIRED, two-pass per-recipient daily digest throttle, optimistic-
  concurrency vs renewal-reset, top-level crash-safe try/catch).
- Wired into the `reminders` cron handler as a Promise.all member; emits
  `cron.reminders.compliance_reminder_*` gauges.
- Anti-fatigue: ONE digest per (recipient, jurisdictionDate) — the explicit v1.0 lesson fix.

### COMPL-05 — Payment-run hard-block — VERIFIED
- `assertContractorPaymentEligibility` single canonical guard; wired into BOTH payment-
  write entry points (`payment.create`, `payment.lockAndExport`). CI `payment-gate-guard`
  reports **0 offences** (twin-write enforced). Flag-OFF would-block soft-warn + AuditLog.
- `PaymentBlockModal` surfaces the D-10 cause payload with per-contractor deep links.
- `compliance-payment-block` registered PENDING (production OFF until legal review).

### COMPL-06 — PENDING_COMPLIANCE approval state — VERIFIED
- Plug-in operator registry + `complianceCritical` operator; `advanceFlow` holds invoice
  approvals in `PENDING_COMPLIANCE` at the final step instead of auto-APPROVE (closes the
  "auto-READY path" half of the goal).
- `onComplianceItemSatisfied` recovery (GIN JSONB containment) resumes held flows to
  PENDING (never auto-APPROVE) on satisfy; `approval.resumeFromCompliance` manual escape
  hatch (rejects when still blocked).

### COMPL-07 — PaymentRunComplianceCheck audit row — VERIFIED
- `PaymentRunComplianceCheck` table + `buildSnapshotForContractor` (full BLOCKING set,
  replay-ready D-17 snapshot). PASS rows written atomic with the PaymentExport row.
- TOCTOU re-assertion inside the export tx (D-09); FAIL-verdict rows (paymentExportId=null)
  recorded in a separate tx after rollback (D-19).

## human_verification (deferred manual UAT — per VALIDATION.md / Standing Constraints)

1. **Multi-region migration apply** — run `pnpm --filter @contractor-ops/db db:migrate:all`
   per region (migrations 20260531170000/170001/170002). The shared dev DB is also behind
   on phase75/phase76 (concurrent session owns those). Tracked as a STATE.md blocker.
   expected: each region's schema diff matches the three migrations.
2. **End-to-end cron tick → digest email** — `curl` the reminders cron in a seeded env;
   observe ONE digest email per recipient referencing the seeded contractor's expiring item.
3. **FLAG_SIGNOFF_BYPASS=local hard-block UX** — boot dev with the bypass; confirm the
   payment wizard renders the block modal on a contractor with a BLOCKING+EXPIRED item.
4. **Legal review of admin lockout copy** — flip `compliance-payment-block` PENDING →
   APPROVED post-review (DEFERRED, LOCAL-ONLY Standing Constraint — does NOT block the phase).

## Notes
- Two pre-existing cross-session test-collection failures (Phase 76 getIdpAuditLogger
  mock gap; Phase 75 classification-recompute insertedCount drift) are documented in the
  plan SUMMARYs + REVIEW.md and flagged for those phases' owners. Neither is introduced
  by Phase 72; the Phase 72 service tests pass in isolation.
