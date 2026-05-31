---
status: partial
phase: 72-f1-compliance-reminder-cascade-payment-block
source: [72-VERIFICATION.md]
started: 2026-05-31
updated: 2026-05-31
---

## Current Test

[awaiting human testing — all items are DEFERRED post-deploy per Standing Constraints]

## Tests

### 1. Multi-region migration apply
expected: `pnpm --filter @contractor-ops/db db:migrate:all` applies migrations
20260531170000/170001/170002_phase72_* to every region (EU + ME); each region's schema
diff matches. Note: the shared dev DB also needs phase75/phase76 applied first (owned by
a concurrent session).
result: [pending — DEFERRED ops step]

### 2. End-to-end cron tick → digest email
expected: hitting the `reminders` cron in a seeded environment fires ONE digest email per
recipient referencing the seeded contractor's expiring compliance item (no per-document spam).
result: [pending — production email infra mocked in unit tests]

### 3. FLAG_SIGNOFF_BYPASS=local hard-block UX
expected: with `FLAG_SIGNOFF_BYPASS=local`, the payment-run wizard renders the block modal
(per-contractor deep links) when a selected contractor has a BLOCKING+EXPIRED item; keyboard
nav reaches the accordion + close; RTL verified for `ar`.
result: [pending]

### 4. Legal review of admin lockout copy
expected: legal entity verifies the admin payment-block lockout copy; flip
`compliance-payment-block` PENDING → APPROVED post-review.
result: [pending — DEFERRED post-deploy, LOCAL-ONLY Standing Constraint; does NOT block the phase]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
