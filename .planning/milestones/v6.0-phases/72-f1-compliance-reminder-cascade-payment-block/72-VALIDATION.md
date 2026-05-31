---
phase: 72
slug: f1-compliance-reminder-cascade-payment-block
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-27
---

# Phase 72 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

> ⚠️ **POST-MIGRATION PATH NOTICE (2026-05-31).** Written pre-web-migration. Path/identifier references below are stale where they cite `apps/web/...`, `apps/web/vitest.config.ts`, `paymentRun.create`/`paymentRun.export`. Current targets (authoritative in the PLAN.md files + `72-REPLAN-DRIFT-MAP.md`): web tests run under `@contractor-ops/web-vite` (config `apps/web-vite/vitest.config.ts`); the cron orchestrator wiring + test live in `@contractor-ops/cron-worker`; the payment procedures are `payment.create` / `payment.lockAndExport` in `routers/finance/payment.ts`; the lint guard is `payment-gate-guard`. The validation *intent* (what each `it(...)` proves) is unchanged.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x (workspace-level pnpm/turbo) |
| **Config file** | `packages/api/vitest.config.ts` (existing); `apps/web/vitest.config.ts` for RTL |
| **Quick run command** | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance|reminder|payment-gate|approval-engine-operator'` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | Quick: ~30s · Full: ~5min |

---

## Sampling Rate

- **After every task commit:** Run quick command (filtered tests for affected service).
- **After every plan wave:** Run quick command for ALL Phase 72 services + the schema validation: `pnpm --filter @contractor-ops/db test --run; pnpm --filter @contractor-ops/api test --run`.
- **Before `/gsd-verify-work`:** Full suite must be green plus `pnpm typecheck` and `pnpm lint`.
- **Max feedback latency:** 30s for unit, 90s for integration.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 72-01-01 | 01 | 0 | COMPL-03/05/06/07 | T-72-01-01 | Failing tests scaffolded for all six services | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-reminder-scan'` | ❌ W0 | ⬜ pending |
| 72-01-02 | 01 | 0 | COMPL-05 | T-72-01-02 | Payment-block helper test fails (helper absent) | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-payment-gate'` | ❌ W0 | ⬜ pending |
| 72-01-03 | 01 | 0 | COMPL-06 | T-72-01-03 | Operator registry test fails | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='approval-engine-operator-registry'` | ❌ W0 | ⬜ pending |
| 72-01-04 | 01 | 0 | COMPL-07 | T-72-01-04 | PaymentRunComplianceCheck atomicity test fails | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='payment-run-compliance-check'` | ❌ W0 | ⬜ pending |
| 72-01-05 | 01 | 0 | COMPL-05 | T-72-01-05 | Block-modal RTL test fails | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='payment-block-modal'` | ❌ W0 | ⬜ pending |
| 72-01-06 | 01 | 0 | COMPL-06 | T-72-01-06 | Recovery hook test fails | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-recovery'` | ❌ W0 | ⬜ pending |
| 72-02-01 | 02 | 1 | COMPL-03 | T-72-02-01 | Migration A creates `ContractorComplianceReminderState` + `ReminderBand` enum | integration | `pnpm --filter @contractor-ops/db prisma:validate && pnpm --filter @contractor-ops/db test` | ✅ | ⬜ pending |
| 72-02-02 | 02 | 1 | COMPL-06 | T-72-02-02 | Migration B adds `PENDING_COMPLIANCE` enum + `complianceHoldsJson` + GIN index | integration | `pnpm --filter @contractor-ops/db test --run --testNamePattern='approval-flow-migration'` | ✅ | ⬜ pending |
| 72-02-03 | 02 | 1 | COMPL-07 | T-72-02-03 | Migration C creates `PaymentRunComplianceCheck` + `EligibilityVerdict` | integration | `pnpm --filter @contractor-ops/db test --run --testNamePattern='payment-run-compliance-check-migration'` | ✅ | ⬜ pending |
| 72-03-01 | 03 | 2 | COMPL-03 | T-72-03-01 | `runComplianceReminderScan` fires D90 band on first crossing | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='reminder-scan band-state-machine'` | ✅ | ⬜ pending |
| 72-03-02 | 03 | 2 | COMPL-03 | T-72-03-02 | Per-recipient daily-digest dedup (`compl:digest:*`) emits ONE notification | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='reminder-scan digest'` | ✅ | ⬜ pending |
| 72-03-03 | 03 | 2 | COMPL-03 | T-72-03-03 | Renewal listener resets state with version bump (optimistic concurrency) | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='reminder-scan renewal-reset'` | ✅ | ⬜ pending |
| 72-04-01 | 04 | 2 | COMPL-05 | T-72-04-01 | `assertContractorPaymentEligibility` throws PRECONDITION_FAILED with structured `cause` | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='payment-gate assertion'` | ✅ | ⬜ pending |
| 72-04-02 | 04 | 2 | COMPL-05 | T-72-04-02 | `paymentRun.create` blocks contractor with EXPIRED BLOCKING item | integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='payment-run create blocked'` | ✅ | ⬜ pending |
| 72-04-03 | 04 | 2 | COMPL-05 | T-72-04-03 | Feature-flag OFF returns `{ blocked: false, wouldBlock: true }` + WARN log | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='payment-gate flag-off'` | ✅ | ⬜ pending |
| 72-04-04 | 04 | 2 | COMPL-05 | T-72-04-04 | CI lint guard fails when payment-write entry point lacks helper import | unit | `pnpm --filter @contractor-ops/lint-guards test --run --testNamePattern='compliance-payment-gate-presence'` | ✅ | ⬜ pending |
| 72-05-01 | 05 | 2 | COMPL-06 | T-72-05-01 | Operator registry registers `complianceCritical` at module-load | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='operator-registry register'` | ✅ | ⬜ pending |
| 72-05-02 | 05 | 2 | COMPL-06 | T-72-05-02 | `complianceCritical(EXPIRED)` evaluates TRUE for contractor with BLOCKING+EXPIRED | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='operator-registry compliance-critical'` | ✅ | ⬜ pending |
| 72-05-03 | 05 | 2 | COMPL-06 | T-72-05-03 | Engine transitions APPROVED-eligible flow → PENDING_COMPLIANCE when operator returns true | integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='approval-engine pending-compliance-transition'` | ✅ | ⬜ pending |
| 72-05-04 | 05 | 3 | COMPL-06 | T-72-05-04 | Recovery hook re-asserts eligibility, transitions PENDING_COMPLIANCE → PENDING | integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-recovery resume'` | ✅ | ⬜ pending |
| 72-05-05 | 05 | 3 | COMPL-06 | T-72-05-05 | `approval.resumeFromCompliance` admin mutation manual escape hatch works | integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='approval router resumeFromCompliance'` | ✅ | ⬜ pending |
| 72-06-01 | 06 | 3 | COMPL-07 | T-72-06-01 | `paymentRun.export` writes `PaymentRunComplianceCheck` PASS rows in SAME tx as `PaymentExport` | integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='payment-export atomic-compliance-check'` | ✅ | ⬜ pending |
| 72-06-02 | 06 | 3 | COMPL-07 | T-72-06-02 | TOCTOU re-assertion at export ABORTS run when contractor newly fails mid-batch | integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='payment-export toctou-abort'` | ✅ | ⬜ pending |
| 72-06-03 | 06 | 3 | COMPL-07 | T-72-06-03 | FAIL-verdict rows written in separate tx after export rollback | integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='payment-export fail-verdict-recording'` | ✅ | ⬜ pending |
| 72-07-01 | 07 | 3 | COMPL-05 | T-72-07-01 | Payment wizard renders block-modal with per-contractor sections + deep links | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='payment-block-modal'` | ✅ | ⬜ pending |
| 72-07-02 | 07 | 3 | COMPL-05 | T-72-07-02 | Wizard handles `PRECONDITION_FAILED` cause field; deep links resolve | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='payment-wizard error-handling'` | ✅ | ⬜ pending |
| 72-08-01 | 08 | 3 | COMPL-03 | T-72-08-01 | Cron route invokes `runComplianceReminderScan` and Sentry monitor reports metrics | integration | `pnpm --filter @contractor-ops/web test --run --testNamePattern='cron/reminders compliance-reminder'` | ✅ | ⬜ pending |
| 72-08-02 | 08 | 3 | COMPL-03/05 | T-72-08-02 | `compliance-payment-block` flag entry exists in `signoff-registry-flags.json` (PENDING) | unit | `pnpm --filter @contractor-ops/feature-flags test --run --testNamePattern='compliance-payment-block-entry'` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/services/__tests__/compliance-reminder-scan.test.ts` — failing stubs for COMPL-03 cron orchestrator
- [ ] `packages/api/src/services/__tests__/compliance-payment-gate.test.ts` — failing stubs for COMPL-05 helper
- [ ] `packages/api/src/services/__tests__/approval-engine-operator-registry.test.ts` — failing stubs for COMPL-06 operator registry
- [ ] `packages/api/src/services/__tests__/payment-run-compliance-check.test.ts` — failing stubs for COMPL-07 atomicity
- [ ] `packages/api/src/services/__tests__/compliance-recovery.test.ts` — failing stubs for COMPL-06 recovery hook
- [ ] `apps/web/src/components/payment/__tests__/payment-block-modal.test.tsx` — failing RTL for COMPL-05 modal
- [ ] `packages/lint-guards/src/__tests__/compliance-payment-gate-presence.test.ts` — failing CI-lint stub for COMPL-05 helper-coverage
- [ ] `packages/feature-flags/src/__tests__/compliance-payment-block-entry.test.ts` — asserts `compliance-payment-block` entry exists in `signoff-registry-flags.json`

Vitest configs already exist in both `packages/api` and `apps/web`. No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end email/notification dispatch on cron tick | COMPL-03 | Production email infra (Resend) is mocked in unit tests; real send is not part of test loop | Run `curl -H "Authorization: Bearer $CRON_SECRET" /api/cron/reminders` against staging; observe inbox for digest email referencing seeded contractor's expiring item |
| Multi-region migration apply | COMPL-03/05/06/07 | Standing Constraint — manual ops post-deploy step | `pnpm --filter @contractor-ops/db push:all-regions` after merge to main; verify each region's schema diff matches migration |
| `FLAG_SIGNOFF_BYPASS=local` engineer-bypass UX | COMPL-05 | Boot-time flag-signoff gate behavior under env-var | Set `FLAG_SIGNOFF_BYPASS=local`; boot the dev server; confirm no startup error; flip flag manually in `flag-bag` to enable hard-block; observe block-modal in payment wizard |
| Production legal review of admin lockout copy | COMPL-05 | Standing Project Constraint — DEFERRED post-deploy | Track in STATE.md as legal-review checkpoint; do not block phase verification |

---

## Verification Closure

Phase 72 passes verification when:
1. All Wave 0 tests turn from RED to GREEN as Plans 72-02..08 land.
2. `pnpm test` exits 0 across the affected workspaces.
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0 (including new `compliance-payment-gate-presence` CI-lint guard).
5. Manual UAT verifications recorded in STATE.md as deferred / completed.
