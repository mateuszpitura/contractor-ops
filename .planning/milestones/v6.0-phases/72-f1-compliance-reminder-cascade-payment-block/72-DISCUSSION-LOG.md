# Phase 72: F1 Compliance — Reminder Cascade + Payment Block — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in 72-CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-27
**Phase:** 72-f1-compliance-reminder-cascade-payment-block
**Mode:** discuss (default mode, no flags)
**Areas discussed:** Reminder cron, Payment-block enforcement, PENDING_COMPLIANCE recovery, PaymentRunComplianceCheck audit row

---

## Area selection

User selected ALL FOUR proposed areas via multiSelect — full coverage of the four ROADMAP success criteria.

| Option | Selected? |
|--------|-----------|
| Reminder cron — state, dedup, digest | ✓ |
| Payment-block enforcement — layer & shape | ✓ |
| PENDING_COMPLIANCE recovery semantics | ✓ |
| PaymentRunComplianceCheck audit row | ✓ |

---

## Area 1 — Reminder cron (state, dedup, digest)

### Q1: Reminder state machine persistence

| Option | Selected |
|--------|----------|
| Per-item `ReminderState` row, mirrors v5 `EconomicDependencyAlertState` | ✓ |
| Sparse fire-log table only | — |
| Hybrid (state row + audit log entry per fire) | — |

→ **D-01.** Decision: 1:1 `ContractorComplianceReminderState` table with `currentBand`/`lastBandFiredAt`/`lastBandFired`/`version`.

### Q2: Idempotency / dedup mechanism

| Option | Selected |
|--------|----------|
| Extend existing DB-unique-index pattern (Phase 65 `notification_cron_dedup`) | ✓ |
| Redis SETNX exactly as ROADMAP says | — |
| Hybrid (DB for per-band, Redis for digest) | — |

→ **D-03.** Decision: reuse `claimCronNotificationDedup` verbatim. Note: this diverges from ROADMAP success-criterion-#1 wording ("Redis SETNX"). Captured in `<code_context>` as a deliberate divergence; ROADMAP wording will be updated post-implementation to match what shipped.

### Q3: Per-recipient daily digest pattern

| Option | Selected |
|--------|----------|
| Two-pass: collect then digest-emit | ✓ |
| Per-tick fan-out, defer aggregation to mailer | — |
| Per-doc notification, drop the digest | — |

→ **D-04.** Decision: in-cron two-pass orchestration mirrored from `economic-dependency-scan.ts`. Pass 1 accumulates `pendingFires` grouped by `(recipientUserId, jurisdictionDate)`; Pass 2 dispatches one digest per recipient.

### Q4: Cascade reset on renewal

| Option | Selected |
|--------|----------|
| Reset on `expiresAt` change — new cohort | ✓ |
| New cohort row per `expiresAt` | — |
| Reset only via explicit admin/portal action | — |

→ **D-06.** Decision: classification.ts emits `compliance.item.expires_at_changed` event in-tx; listener resets state row + version-bumps. Optimistic concurrency on cron writes via `WHERE version = ?` prevents stale-tick re-fires.

---

## Area 2 — Payment-block enforcement (layer & shape)

### Q1: Enforcement layer

| Option | Selected |
|--------|----------|
| Shared assertion helper at every entry point | ✓ |
| Helper + DB CHECK constraint safety net | — |
| Helper at API + scheduled audit reconcile | — |

→ **D-07 / D-08.** Decision: `assertContractorPaymentEligibility` in `compliance-payment-gate.ts` called from `paymentRun.create`, `paymentRun.addItems`, auto-`READY` transition, every export pathway. CI lint enforces presence of import. No DB triggers.

### Q2: Time-of-check-vs-time-of-use defence

| Option | Selected |
|--------|----------|
| Re-assert at export, fail the export if blocked | ✓ |
| Re-assert at export, auto-skip blocked items | — |
| Re-assert + soft-warn, admin chooses | — |

→ **D-09.** Decision: fail-closed re-assertion inside the export transaction. Admin must remove blocked contractors and retry. Failed attempts still logged via D-19.

### Q3: Block-modal payload structure

| Option | Selected |
|--------|----------|
| Structured per-contractor + per-doc array | ✓ |
| Flat list of (contractor, doc) tuples | — |
| Generic blocker — list contractor IDs only | — |

→ **D-10.** Decision: `cause: { contractorReasons: [{ contractorId, contractorName, reasons: [...] }] }` shape. Reused by Phase 73 dashboard.

### Q4: Feature-flag gating posture

| Option | Selected |
|--------|----------|
| Flag-off — helper warns, never blocks | ✓ |
| Flag-off — helper is a no-op | — |
| Flag controls only user-facing block, not audit | — |

→ **D-11.** Decision: when `compliance-payment-block` is OFF, helper still runs check, returns `{ blocked: false, wouldBlock: true, reasons }`, emits WARN log + AuditLog entry. Mirrors Phase 70 D-10 LOCAL-ONLY bypass philosophy.

---

## Area 3 — PENDING_COMPLIANCE recovery semantics

### Q1: Recovery flow on doc renewal

| Option | Selected |
|--------|----------|
| Hybrid — auto re-enter PENDING, never auto-APPROVE | ✓ |
| Manual admin action only | — |
| Auto-resume to next status (auto-APPROVE if all checks pass) | — |

→ **D-15.** Decision: `compliance.item.satisfied` event listener finds held approvals via JSONB containment, re-asserts eligibility, atomically transitions to `PENDING`. Approver still explicitly acts.

### Q2: Hold linkage persistence

| Option | Selected |
|--------|----------|
| JSON column on ApprovalFlow | ✓ |
| New join table ApprovalComplianceHold | — |
| Compute on-demand from current item state | — |

→ **D-14.** Decision: `complianceHoldsJson Json?` on `ApprovalFlow` + GIN index for containment query. Audit history lives in AuditLog entries.

### Q3: ApprovalStatus enum extension

| Option | Selected |
|--------|----------|
| Add as a sibling status to PENDING | ✓ |
| PENDING + new sub-status column | — |
| Separate boolean flag column | — |

→ **D-12.** Decision: additive enum value `PENDING_COMPLIANCE`. UI labels distinguish "Pending approval" vs "Held — compliance".

### Q4: complianceCritical condition operator wiring

| Option | Selected |
|--------|----------|
| Built-in operator, registered in evaluator | — |
| Plugin-style operator registry | ✓ |
| Hardcoded — always evaluate, no opt-in | — |

→ **D-13.** Decision: plugin-style registry in `approval-engine/operators/registry.ts`. `complianceCritical` ships as the only operator in Phase 72, with the registry shape ready for future operators (budget-cap, fraud-score).

---

## Area 4 — PaymentRunComplianceCheck audit row

### Q1: Row granularity

| Option | Selected |
|--------|----------|
| One row per (PaymentRun × Contractor) | ✓ |
| One row per PaymentRun with all-contractor snapshot | — |
| Two rows: parent (run) + children (per contractor) | — |

→ **D-16.** Decision: 1 row per (run × contractor). Indexed `(contractorId, snapshottedAt DESC)` for forensics; `(paymentRunId)` and `(paymentExportId)` for joins.

### Q2: Snapshot scope

| Option | Selected |
|--------|----------|
| Full ContractorComplianceItem rows + policy rule | ✓ |
| Digest-only — verdict + reasons | — |
| Full items + signed hash for tamper-evidence | — |

→ **D-17.** Decision: full frozen-row snapshot of every BLOCKING-severity item (regardless of status), plus `policyRuleSetVersion`, `jurisdictionDate`, `eligibilityVerdict`, `failureReasons`. Replay-ready. Tamper-evidence hash deferred to a possible SOC2-driven future phase.

### Q3: Atomicity boundary

| Option | Selected |
|--------|----------|
| Inside the export-mutation transaction, before file emit | ✓ |
| Inside tx, including R2 upload | — |
| Outside tx, written after file emit succeeds | — |

→ **D-18.** Decision: Prisma `$transaction` wraps eligibility check + `PaymentRunComplianceCheck` writes + `PaymentExport` row + bank-file content generation. R2 upload is post-commit; failed R2 leaves `fileUrl IS NULL` as retry-able state.

### Q4: Failed-eligibility recording

| Option | Selected |
|--------|----------|
| Yes — row per failure with verdict=FAIL, no PaymentExport row | ✓ |
| Yes — audit log entry only, no PaymentRunComplianceCheck row | — |
| No — silent abort, log only | — |

→ **D-19.** Decision: write FAIL-verdict rows in a separate small tx (since parent export tx is rolling back). Phase 73 admin dashboard "recently blocked exports" widget queries these.

---

## Wrap-up question

| Option | Selected |
|--------|----------|
| Write CONTEXT.md now | ✓ |
| Add one more clarification | — |

→ Proceeded to write CONTEXT.md.

---

## Claude's discretion (deferred to Researcher / Planner)

- Pino log structure for `compliance.payment.would_block` / `compliance.reminder.fired`.
- Final wording of digest email/notification (i18n keys, English placeholders + de/pl/ar parity in Phase 73).
- Cron tick frequency (recommend matching `economic-dependency-scan` daily 02:00 UTC unless ROADMAP-pinned).
- Exact Postgres GIN index syntax on `complianceHoldsJson`.
- Application-layer vs Prisma `@@check` enforcement of `eligibilityVerdict = 'FAIL' ⇒ paymentExportId IS NULL`.
- Admin reconcile-queue surface for retry-able R2-failed exports.

## Deferred ideas (for future phases or backlog)

See `<deferred>` section of 72-CONTEXT.md — 9 ideas captured.

## Background events during the discussion

- Phase 71 background executor completed mid-discussion (35666551 → 9c9e851f, 7/7 plans, 109 tests GREEN). Two manual deploy items (multi-region schema apply + backfill apply) per LOCAL-ONLY constraint.
- Phase 74 background executor completed mid-discussion (8/8 plans, 21 atomic commits, 50+ new GREEN tests). Multi-region migration apply pending; some UI integration deferred to Phase 74.1.
- Neither completion altered the Phase 72 discussion since the decisions captured here are independent of those phases' shipped surfaces (Phase 72 reads Phase 71's schema and consumes Phase 70's signoff registry — both already locked at start of discussion).

---

*Mode: discuss (default)*
*Discussion completed: 2026-04-27*
