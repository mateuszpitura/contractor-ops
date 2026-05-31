---
phase: 72-f1-compliance-reminder-cascade-payment-block
status: clean
depth: standard
reviewed: 2026-05-31
findings_critical: 0
findings_warning: 0
findings_info: 2
---

# Phase 72 Code Review

Inline review (the gsd-code-reviewer agent is unavailable in this background runtime;
the orchestrator performed a standard-depth review directly). Scope: the 27 Phase 72
production source files (tests, generated client, locale JSON, and .planning excluded).

## Summary

**Status: clean.** No Critical or Warning findings. Two Info-level advisories, both
pre-existing or intentional. All phase production code passes `pnpm typecheck`
(43/43 workspace tasks), `biome check`, and the per-package test suites.

## Security review (focus areas)

- **Tenant isolation — compliance-payment-gate**: the eligibility query filters
  `contractorId IN (callerIds)`; callers (payment.create, lockAndExport) resolve those
  IDs from org-scoped invoices/run items. The flag-OFF would-block AuditLog write is
  org-scoped. No cross-tenant leak. PASS.
- **SQL injection — compliance-recovery `$queryRaw`**: the JSONB containment query uses
  Prisma tagged-template bound parameters for BOTH `organizationId` and the `itemIds`
  payload (`${containment}::jsonb`). No string interpolation. Org filter present. PASS.
- **TOCTOU — lockAndExport**: eligibility is re-asserted inside the export transaction
  (D-09); a newly-blocked contractor aborts the export and the parent tx rolls back.
  FAIL-verdict rows are recorded in a separate tx. PASS.
- **Crash-safety — reminders cron**: runComplianceReminderScan has a top-level try/catch
  returning zeroes; it cannot abort the shared advisory-locked transaction. PASS.
- **XSS — payment-block modal**: contractor names / labels rendered via React string
  interpolation (escaped); deep links are internal paths via the locale-aware Link
  wrapper (no dangerouslySetInnerHTML, no external URLs). PASS.
- **Logging**: no `console.*` in app source; structured `@contractor-ops/logger` used
  throughout (cron logger, service loggers). PASS.
- **Audit**: sensitive mutations write AuditLog rows (compliance.reminder.reset,
  compliance.payment.would_block, approval.compliance_resolved,
  payment_run.lock_and_export, PaymentRunComplianceCheck). PASS.
- **Feature flag**: compliance-payment-block stays PENDING; production hard-block is OFF
  (would-block soft-warn) until legal review — Standing Constraint honored. PASS.

## Findings

### Info

**1. Pre-existing cognitive complexity + unused-var in classification.ts**
- `recreateComplianceAssessment` (18) and `submit` (25) exceed the biome cognitive-
  complexity-15 threshold, and an unused var in `logEscalation`. All three are
  PRE-EXISTING (confirmed against the unmodified HEAD) — Phase 72 added only a few
  lines (the recovery-hook call) inside these large mutations and did not change their
  complexity scores. `noExcessiveCognitiveComplexity` is `warn`-level in biome.json.
  Not introduced here; left untouched.

**2. noBarrelFile advisory on compliance-recovery re-export**
- compliance-recovery.ts re-exports `onComplianceItemExpiresAtChanged` from
  compliance-reminder-scan to give the classification listeners a single import surface.
  `noBarrelFile` is a perf advisory; the re-export is intentional and minimal (one
  symbol). Acceptable.

## Deviations / integration notes (carried in plan SUMMARYs)
- evaluateConditions kept synchronous (operator registry exercised via advanceFlow's tx
  gate) — backward compatibility preserved.
- Service tx params use structural client interfaces (PaymentGateClient / RecoveryClient
  / SnapshotClient) so the tenant-extended ctx.db.$transaction client compiles.
- Migration naming follows the current-tree full-timestamp convention (sorts after the
  baseline + phase75/76).

## Pre-existing cross-session test debt (NOT introduced by Phase 72)
- `classification.test.ts` / `payment.test.ts` / `user.test.ts` collection-fail on the
  Phase 76 `getIdpAuditLogger` logger-mock gap (appRouter import). Phase 72 service tests
  pass in isolation.
- `classification-recompute.test.ts` asserts `insertedCount === 3` but the Phase 75
  IP-assignment UK policy rules make it 4. Stale assertion from Phase 75.
Both flagged for the Phase 75 / Phase 76 owners.
