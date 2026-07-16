---
phase: 100
plan: 100-11
subsystem: integrations / outbound-webhooks
tags: [webhooks, outbox, producers, wiring, built-but-unwired, shield]
requires:
  - P100 outbound-webhook engine (enqueue → fan-out → deliver, SSRF/HMAC/redaction)
  - transactional outbox (enqueueOutboxEvent + drain + handlers registry)
provides:
  - all 16 catalog events emitted from their owning domain mutations
  - unmocked producer→outbox round-trip seam test
affects:
  - P101 marketplace / n8n / Zapier triggers (now receive real events once module granted)
tech-stack:
  added: []
  patterns:
    - enqueueWebhookEvent(tx, orgId, { eventType, aggregateId, data }) inside the owning $transaction
    - emit from shared helpers (finalizeApprovedInvoice, applyInvoicePaymentOutcome,
      autoCompleteRunIfTerminal, advanceFlow) to cover every caller once
    - unblockDependentsAndRecomputeRun returns runCompleted so callers emit workflow.completed
key-files:
  created:
    - packages/api/src/__tests__/webhook-producer-emit.test.ts
  modified:
    - packages/api/src/routers/core/contractor-core.ts
    - packages/api/src/services/approval-engine.ts
    - packages/api/src/routers/core/approval-shared.ts
    - packages/api/src/routers/core/approval-queue.ts
    - packages/api/src/routers/finance/invoice-crud.ts
    - packages/api/src/routers/finance/invoice-matching.ts
    - packages/api/src/routers/finance/payment-shared.ts
    - packages/api/src/routers/finance/payment-core.ts
    - packages/api/src/routers/portal/portal-invoices-router.ts
    - packages/api/src/routers/workflow/workflow-shared.ts
    - packages/api/src/routers/workflow/workflow-execution-tasks.ts
    - packages/api/src/routers/workflow/workflow-execution-runs.ts
    - packages/api/src/routers/public-api/workflow-task.ts
    - packages/api/src/routers/compliance/classification-submit.ts
    - packages/api/src/services/compliance-reminder-scan.ts
    - .planning/brain/wiki/domains/outbound-webhooks.md
decisions:
  - contractor.updated wrapped in a $transaction so the emit is durable-iff-commit (was tx-less)
  - contractor.offboarded emits from BOTH the ENDED lifecycle transition and archive (distinct terminal states)
  - payment_run.completed emits only on clean COMPLETED, never on a FAILED run
  - compliance_doc.* emitted from the cron right after the durable band-state write (no $transaction seam exists)
metrics:
  duration_min: ~95
  completed: 2026-07-17
  tasks: 9
  files_changed: 21
---

# Phase 100 Plan 11: Wire the outbound-webhook producer Summary

Closed v7.0 milestone-audit BLOCKER #1 (WEBHOOK-PRODUCER-UNWIRED): `enqueueWebhookEvent` had **zero** production callers, so the entire P100 engine + P101 triggers silently delivered nothing once `module.outbound-webhooks` was granted. All **16** catalog events now emit from the domain mutation that owns each transition, inside that mutation's `$transaction`, verified by an unmocked producer→outbox round-trip seam test.

## Shield Scope
- **Flow:** domain mutations (contractor / invoice / payment / workflow / classification / compliance-cron) → `enqueueWebhookEvent` → `integration.webhook.publish` outbox row → existing fan-out → deliver.
- **Surfaces touched:** staff tRPC, portal tRPC, public-api tRPC, cron.
- **Seams crossed:** producer → transactional outbox (NEW seam, added to seams-registry mentally + covered by test); invoice-paid / payment-run / approval / workflow completion shared helpers.
- **Pattern classes at risk:** S1 (built-but-unwired — the whole point), S2 (seam test), S4 (sibling entry points), T1 (enqueue in-tx).
- **Reference:** `wiki/domains/outbound-webhooks.md`.

## What was wired (16 events → owning mutation)

| Event | Emit site (in-tx) |
|-------|-------------------|
| contractor.created | `contractor-core.ts` `create` |
| contractor.updated | `contractor-core.ts` `update` (wrapped in a new tx) |
| contractor.offboarded | `contractor-core.ts` `updateLifecycleStage`(→ENDED) + `archive` |
| contractor.compliance_blocked | `approval-engine.ts` `advanceFlow` (final-step PENDING_COMPLIANCE hold) |
| invoice.received | `invoice-crud.ts` (staff) + `portal-invoices-router.ts` (portal) |
| invoice.matched | `invoice-matching.ts` auto-match + manual-match |
| invoice.approved | shared `finalizeApprovedInvoice` (`approval-shared.ts`) — single + bulk approve |
| invoice.rejected | `approval-queue.ts` `reject` + `bulkReject` |
| invoice.paid | shared `applyInvoicePaymentOutcome` (`payment-shared.ts`) — all settlement sources |
| payment_run.created | `payment-core.ts` per created run |
| payment_run.completed | shared `autoCompleteRunIfTerminal` (`payment-shared.ts`), COMPLETED only |
| workflow.task.completed | `workflow-execution-tasks.ts` `completeTask` + public-api DONE |
| workflow.completed | via `unblockDependentsAndRecomputeRun` `runCompleted` — completeTask, skipTask, IP-override, public-api, complete-with-pending-credentials |
| classification.outcome | `classification-submit.ts` submit (contractors + employees) |
| compliance_doc.expiring_soon / expired | `compliance-reminder-scan.ts` per band fire (EXPIRED band → expired) |

Every emit passes the full domain object as `data` (the fan-out redacts per-subscription); `aggregateId` is the entity id. Shared-helper emits (`finalizeApprovedInvoice`, `applyInvoicePaymentOutcome`, `autoCompleteRunIfTerminal`, `advanceFlow`) cover all callers once — the S4-clean approach.

## Deviations from Plan

### Auto-fixed / adjustments

**1. [Rule 2 / T1] Wrapped `contractor.update` in a `$transaction`**
- **Issue:** `update` ran the write, audit and side-effects without a transaction, so an emit there would not be durable-iff-commit.
- **Fix:** wrapped the `contractor.update` + `enqueueWebhookEvent` in `ctx.db.$transaction`; post-update side-effects (session revocation, VAT-id, billing profile) stay outside unchanged.
- **Files:** `contractor-core.ts` · **Commit:** ed0314315

**2. [Rule 3] `unblockDependentsAndRecomputeRun` now returns `{ runCompleted }`**
- **Issue:** the run-completion chokepoint is a shared helper whose narrow structural `tx` type cannot reach the outbox raw writers; emitting inside it would force widening + test-mock churn across 6 callers.
- **Fix:** return `runCompleted` (was `void`, backward-compatible for callers that ignore it); each caller emits `workflow.completed` with its own real tx.
- **Files:** `workflow-shared.ts` + callers · **Commit:** b842ff45b

**3. [Rule 1 — mocks-follow-api] Updated stale tx / outbox test mocks**
- **Issue:** the new in-tx emit calls the real `enqueueOutboxEvent` → `tx.$executeRawUnsafe`; several suites' tx mocks lacked it, and 5 suites mock `services/outbox` without `enqueueOutboxEvent`.
- **Fix:** added `$executeRaw/$executeRawUnsafe` to the contractor, contractor-dedup, portal, classification and public-api-mutation-audit tx mocks; added `enqueueOutboxEvent` stub to the invoice/approval/workflow-execution/equipment outbox mocks; added `workflowRun.findUnique` to the workflow-execution tx mock; added the raw writers to the two reminder-scan client mocks + widened `ReminderScanClient`.
- **Commits:** 3aedb6a67, 222d0daab, f7a0b4a31

## Scoped follow-ups (S4 siblings NOT wired — recorded, not faked)

- **workflow.completed from integration auto-completions:** `services/linear-webhook-handler.ts` and `services/equipment-workflow.ts` call `unblockDependentsAndRecomputeRun` but do not emit `workflow.completed` (they ignore the new `runCompleted`). Internal integration side-effects; the staff + public-api completion paths ARE wired. Deferred.
- **invoice.received from intake-convert:** `svcConvertToInvoice` (invoice-intake service) promotes a matched intake to an Invoice — a third `RECEIVED` entry point not yet wired. The two primary creation sites (staff `create`, portal submit) are wired. Deferred.
- **invoice.received for the late-payment interest invoice** (`late-payment-interest.ts`) is intentionally **skipped** — a derived interest artifact, not an inbound "received" business event.

## Known Stubs

None. Every catalog type has ≥1 real production emit inside a committing transaction (or, for the cron, immediately after the durable band-state write).

## Threat Flags

None new. This plan adds no network endpoint, auth path, or schema change — it only feeds the existing P100 engine, whose per-subscription PII redaction, SSRF guard and HMAC signing are unchanged. Producers pass the full domain object; the fan-out redacts per `include_pii`, so no producer pre-redaction was added (nor should be).

## Verify

| Check | Result |
|-------|--------|
| `pnpm typecheck --filter @contractor-ops/api` | clean (tsc, no casts needed on interactive-tx emits) |
| `pnpm --filter @contractor-ops/api test webhook-subscription webhook-dispatch owasp-api-gate` | 13/13 GREEN |
| seam test `webhook-producer-emit.test.ts` | 2/2 GREEN (real mutation → real outbox row) |
| touched suites: contractor, invoice, approval, payment, portal, classification, workflow-execution, workflow-task, equipment-return(s), reminder-scan, region-fanout, public-api-mutation-audit | GREEN |
| full `@contractor-ops/api` suite | 4435 passed / 0 failed (6 skipped, 18 todo) — re-run after mock fixes |

Full-run note: the first full run surfaced 7 reds across 3 suites — all mocks-follow-api gaps (tx mocks missing `$executeRawUnsafe`), fixed in commit f7a0b4a31 and re-verified per-file (portal/classification/public-api-mutation-audit 72/72 GREEN). `check:wiki-brain` reports 2 errors that are NOT this plan's: a fresh-worktree BM25 artifact absence (gitignored/local) and pre-existing `root.ts`↔`api-routers-catalog` drift (root.ts is untouched by this plan). The outbound-webhooks domain page WAS updated in this change set with the producer emit sites + verify_with, so no touched source file is flagged as new drift.

## Self-Check: PASSED
- Created: `packages/api/src/__tests__/webhook-producer-emit.test.ts` — FOUND
- All 15 modified source files present with emits — FOUND
- Commits ed0314315 · 3ffab6799 · 61bdffeeb · 3ce540518 · b842ff45b · 5723515cd · 3aedb6a67 · 5451028ca · 222d0daab · f7a0b4a31 — FOUND

## Shield Verdict
- **Patterns:** S1 PASS (every catalog type has ≥1 production emit — the blocker's core, verified with semble/graphify + typecheck). S2 PASS (unmocked round-trip seam test: real `applyInvoicePaymentOutcome` → real `enqueueWebhookEvent`/`enqueueOutboxEvent` → asserted `integration.webhook.publish` row carrying `invoice.paid`; partial payment emits nothing). S4 PARTIAL→documented (shared-helper emits cover single+bulk approve, all paid sources, all workflow-completion callers incl. public-api; three sibling entry points deferred and recorded above, none faked). T1 PASS (every emit sits inside the owning `$transaction`; `contractor.update` wrapped to satisfy it; the cron has no tx seam and emits at the correct post-durable-write point with once-per-band dedup — documented precisely).
- **Seams tested:** `packages/api/src/__tests__/webhook-producer-emit.test.ts` — `outbound-webhook producer seam`.
- **Verify run:** `pnpm typecheck --filter @contractor-ops/api` clean; webhook + owasp 13/13; seam 2/2; full api suite 4435 passed / 0 failed after mocks-follow-api fixes.
- **Residual risk:** three S4 sibling emit sites deferred (linear/equipment workflow auto-completion, intake-convert invoice.received) — each is an additional entry point for an already-wired event, so subscribers still receive the event on the primary path; no event type is left unemitted.
