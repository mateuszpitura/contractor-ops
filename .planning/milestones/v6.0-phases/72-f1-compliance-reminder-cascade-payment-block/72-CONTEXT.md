# Phase 72: F1 Compliance — Reminder Cascade + Payment Block - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

> ⚠️ **POST-MIGRATION PATH NOTICE (2026-05-31).** Decisions (D-01..D-19) are unchanged and authoritative. Some file paths in `<canonical_refs>` / `<code_context>` are pre-web-migration and stale (`apps/web/...`, `routers/payment-run.ts`, `routers/payment.ts`, `routers/approval.ts`, `routers/classification.ts`, the `claimCronNotificationDedup` location). The **PLAN.md files (72-01..08)** + **`72-REPLAN-DRIFT-MAP.md`** carry the corrected current-tree paths and win on any path conflict. Current targets: `apps/web` → `apps/web-vite`; cron → `apps/cron-worker/src/jobs/handlers/reminders/`; payment-run router → `packages/api/src/routers/finance/payment.ts` (`payment.create` / `payment.lockAndExport`); approval → `routers/core/approval.ts`; classification → `routers/compliance/classification.ts`. The decisions themselves (table shapes, enum values, audit actions, eligibility logic) are correct as written.

<domain>
## Phase Boundary

Wire the Phase 71 schema (`severity`, `expiryJurisdictionTz`, `policyRuleId` on `ContractorComplianceItem`) into runtime behavior:

1. A 90/60/30/15/7-day reminder cascade cron driven by a per-item state machine (mirrors v5 `economic-dependency-scan.ts`), with per-recipient daily-digest throttle so contractors and admins are never spammed across multiple expiring docs.
2. Hard payment-block at every payment-write entry point (payment-run wizard create, payment-run add-items, auto-`READY` approval transition, BACS/SEPA/SWIFT/ZATCA/Peppol export start) when any selected contractor has a `severity = BLOCKING AND status = EXPIRED` row.
3. Approval-engine `complianceCritical(EXPIRED)` condition operator that holds invoice approvals in a new `PENDING_COMPLIANCE` state instead of letting them auto-`READY`.
4. `PaymentRunComplianceCheck` audit row written in the SAME transaction as bank-file emission, with a full snapshot of the contractor's BLOCKING-severity items at moment of export (Pitfall 1 — mid-batch race protection).

Phase 73 owns the admin dashboard, the contractor portal one-click upload-replacement flow, and i18n parity. Legal verification of payment-block lockout copy is DEFERRED per Standing Project Constraints (LOCAL-ONLY, post-deploy legal review).

</domain>

<decisions>
## Implementation Decisions

### Reminder cascade engine

- **D-01:** New table `ContractorComplianceReminderState`, 1:1 with `ContractorComplianceItem` via `itemId String @unique`. Columns: `currentBand` (enum `NONE | D90 | D60 | D30 | D15 | D7 | EXPIRED`), `lastBandFiredAt DateTime?`, `lastBandFired ReminderBand?`, `version Int @default(0)` (optimistic-concurrency guard against late cron writes after a renewal reset). Upserted per cron tick inside a transaction. Mirrors v5 `EconomicDependencyAlertState` shape exactly.
- **D-02:** New enum `ReminderBand = NONE | D90 | D60 | D30 | D15 | D7 | EXPIRED`. Bands map to `ROADMAP.md` 90/60/30/15/7 cascade. EXPIRED is a terminal band that fires once on the first cron tick after the jurisdiction-TZ "expires today" boundary trips.
- **D-03:** Idempotency reuses Phase 65's existing DB-unique-index pattern from `apps/web/src/app/api/cron/reminders/reminders-shared.ts` (`claimCronNotificationDedup(dedupeKey)` + `notification_cron_dedup` migration). Two dedup-key shapes:
  - Per-band fire: `compl:band:{itemId}:{band}:{jurisdictionDate}`
  - Per-recipient daily digest: `compl:digest:{userId}:{jurisdictionDate}`
  - Single source of truth, transactionally consistent with reminder-fire writes, no Redis dependency in the hot path. The ROADMAP wording "Redis SETNX" is aspirational; update post-implementation to match the DB-pattern actually shipped.
- **D-04:** Per-recipient daily digest is two-pass inside a single cron invocation:
  - **Pass 1:** Cron iterates ALL contractors+items, computes band transitions in jurisdiction TZ (reuses Phase 71 `dayjs.tz(expiresAt, expiryJurisdictionTz).startOf('day')`), claims per-band DB-unique-index dedup slots, accumulates `pendingFires` in memory grouped by `(recipientUserId, jurisdictionDate)`. Skips rows where `severity IN (WARNING, INFO)` (those don't fire reminders) AND skips rows where `status IN (WAIVED, SATISFIED)`.
  - **Pass 2:** For each recipient group, claim the per-recipient daily-digest dedup slot. If claimed, render ONE digest email + ONE in-app notification listing all (doc, band, expiresAt) rows for that recipient that day. Dispatch via existing `notification-service.ts` (`dispatch()`).
  - Mirrors `economic-dependency-scan.ts` orchestrator shape.
- **D-05:** Reminder recipients per item:
  - The contractor (always — uses `Contractor.userId` if portal-enrolled, else falls back to `Contractor.email` direct send).
  - Admin recipients resolved via existing `resolveRbacRecipients(orgId, 'compliance:read')` pattern — same RBAC gate the Phase 73 dashboard will use.
  - Both recipient sets share the `compl:digest:{userId}:{jurisdictionDate}` throttle; an admin watching 5 contractors gets one digest, not five.
- **D-06:** Cascade reset on `expiresAt` change (renewal):
  - The classification.ts `materialiseFromPolicy` / item-update path emits a `compliance.item.expires_at_changed` domain event inside its transaction.
  - A listener atomically resets the `ContractorComplianceReminderState` row: `currentBand = NONE`, `lastBandFiredAt = null`, `lastBandFired = null`, `version = version + 1`.
  - Cron writes use `WHERE version = ?` optimistic concurrency to prevent a stale tick re-firing the old band after a renewal.
  - AuditLog entry `compliance.reminder.reset` records the reset with `itemId`, `previousBand`, `triggerEvent` (`expires_at_changed` | `status_satisfied` | `manual_admin_reset`).

### Payment-block enforcement

- **D-07:** Single shared assertion helper `assertContractorPaymentEligibility(contractorIds: string[], opts: { failOpen?: boolean }): Promise<EligibilityResult>` lives in new file `packages/api/src/services/compliance-payment-gate.ts`. Default behaviour: throws `TRPCError({ code: 'PRECONDITION_FAILED', cause: { contractorReasons } })` when any contractor has `ContractorComplianceItem WHERE severity = 'BLOCKING' AND status = 'EXPIRED' AND (waivedReason IS NULL OR status != 'WAIVED')`.
- **D-08:** Helper is called from EVERY payment-write entry point (CI lint enforces presence of the import):
  - `paymentRun.create` mutation
  - `paymentRun.addItems` / `paymentRun.updateItems` mutations
  - Approval-engine auto-`READY` transition (defence-in-depth — should be redundant with the `complianceCritical(EXPIRED)` condition from D-13, but the helper is the canonical check)
  - Each export pathway start: `paymentRun.exportBankFile` (BACS / SEPA / SWIFT / ZATCA / Peppol) — re-asserts at export per D-09
- **D-09:** Time-of-check-vs-time-of-use defence — `paymentRun.exportBankFile` re-runs `assertContractorPaymentEligibility` inside the same transaction as the `PaymentExport` + `PaymentRunComplianceCheck` writes. If a contractor newly fails (doc expired between run-create and export), the export ABORTS with `PRECONDITION_FAILED` listing the newly-blocked contractor + reason. Admin must remove the contractor from the run (or have them renew) and retry. Also writes the FAIL-verdict `PaymentRunComplianceCheck` row per D-19.
- **D-10:** Block-modal payload structure — `cause` field on `PRECONDITION_FAILED`:
  ```ts
  {
    contractorReasons: Array<{
      contractorId: string,
      contractorName: string,
      reasons: Array<{
        itemId: string,
        policyRuleId: string,
        documentTypeLabelKey: string,  // i18n key, e.g. 'compliance.documentType.uk_right_to_work'
        expiredOnDate: string,         // YYYY-MM-DD in jurisdiction TZ
        jurisdictionTz: string,        // IANA TZ
        deepLinkPath: string,          // e.g. '/contractors/{id}/compliance#item-{itemId}'
      }>
    }>
  }
  ```
  Wizard renders one collapsible section per contractor. `documentTypeLabelKey` resolves via Phase 71's locked-phrase registry (Phase 73 i18n). Same shape Phase 73 admin dashboard consumes — single source of truth.
- **D-11:** Feature-flag gating via `compliance-payment-block` (Phase 70 D-09 signoff registry, status PENDING). When flag is OFF:
  - Helper still runs the same query.
  - Instead of throwing, returns `{ blocked: false, wouldBlock: true, reasons }`.
  - Emits a structured WARN log (`logger.warn({ event: 'compliance.payment.would_block', ... })`) AND an `AuditLog` entry `compliance.payment.would_block` with the same payload.
  - Wizard renders a soft warning banner ("Compliance check would block this payment when feature is enabled") but allows the payment.
  - Engineers verify the gate is detecting correctly before legal sign-off flips the flag. Mirrors Phase 70 D-10 LOCAL-ONLY bypass philosophy. `FLAG_SIGNOFF_BYPASS=local` continues to enable hard-block in dev.

### PENDING_COMPLIANCE recovery

- **D-12:** Extend `ApprovalStatus` enum additively with new value `PENDING_COMPLIANCE`. Migration: `ALTER TYPE "ApprovalStatus" ADD VALUE 'PENDING_COMPLIANCE'`. Approval-engine queue queries treat it as a `PENDING_*` family member: `status IN ('PENDING', 'PENDING_COMPLIANCE')`. Only `PENDING` is actionable by approvers. UI labels: "Pending approval" (`PENDING`) vs "Held — compliance" (`PENDING_COMPLIANCE`). Fully backward-compatible.
- **D-13:** New plugin-style condition-operator registry in `packages/api/src/services/approval-engine.ts`:
  - New file `packages/api/src/services/approval-engine/operators/registry.ts` exporting `registerOperator(name, evaluator)` + `evaluateCondition(condition, context)`.
  - Each operator lives in its own file (`operators/compliance-critical.ts`) and registers itself at module-load time via a side-effect import in the engine's barrel.
  - Phase 72 ships ONE operator: `complianceCritical`. Schema in `ApprovalChainConfig.conditionsJson`: `{ "operator": "complianceCritical", "args": { "status": "EXPIRED" } }`. Evaluator queries `ContractorComplianceItem WHERE contractorId = ? AND severity = 'BLOCKING' AND status = 'EXPIRED'`. If any match, condition is TRUE → engine transitions the approval to `PENDING_COMPLIANCE` instead of advancing.
  - Registry pattern enables future operators (budget-cap, fraud-score) without core-engine changes.
- **D-14:** `complianceHoldsJson Json?` column added to `ApprovalFlow` (existing schema location: `packages/db/prisma/schema/approval.prisma`). Stores the linkage between a held approval and the items holding it: `{ itemIds: string[], heldAt: ISO8601, heldByOperator: 'complianceCritical' | string }`. Recovery hook queries via Postgres JSONB containment: `WHERE status = 'PENDING_COMPLIANCE' AND complianceHoldsJson @> '{"itemIds": ["<thisItemId>"]}'`. Index `@@index([status])` already exists; add a GIN index on `complianceHoldsJson` for the containment query.
- **D-15:** Recovery semantics — hybrid auto-resume to PENDING, NEVER auto-APPROVE:
  - When a `ContractorComplianceItem` flips MISSING/EXPIRED → SATISFIED (Phase 73 portal upload, admin doc-replace, or re-classification), the same transaction emits a `compliance.item.satisfied` domain event.
  - A listener queries all `PENDING_COMPLIANCE` approvals where `complianceHoldsJson @> '{"itemIds": ["<thisItemId>"]}'`.
  - For each candidate, re-runs `assertContractorPaymentEligibility(contractor)` — if it now passes, transitions the approval atomically: `status = 'PENDING'`, `complianceHoldsJson = null`, version-bump.
  - Approval re-enters the standard approval queue. An approver still must explicitly approve/reject. Audit-log entry `approval.compliance_resolved` records `{ approvalFlowId, releasedItemIds, resolverEvent: 'item_satisfied', timestamp }`.
  - If multiple items held the approval and only one is satisfied, the approval stays in `PENDING_COMPLIANCE` (hold released only when ALL holding items are satisfied — the eligibility re-assertion enforces this naturally).

### PaymentRunComplianceCheck audit row

- **D-16:** New table `PaymentRunComplianceCheck` (1 row per `PaymentRun × Contractor` per export attempt). Columns:
  ```
  id              String   @id @default(cuid())
  paymentRunId    String
  paymentExportId String?  // null when verdict = FAIL (export aborted)
  contractorId    String
  snapshottedAt   DateTime @default(now())
  snapshotJson    Json     // structure per D-17
  eligibilityVerdict EligibilityVerdict  // PASS | FAIL
  failureReasons  Json?    // populated when verdict = FAIL
  policyRuleSetVersion String  // Phase 71 ClassificationAssessment.policyRuleSetVersion at moment of snapshot
  createdAt       DateTime @default(now())

  @@index([paymentRunId])
  @@index([contractorId, snapshottedAt(sort: Desc)])
  @@index([paymentExportId])
  ```
  Phase 73 dashboard "blocked-payments queue" consumes this directly.
- **D-17:** Snapshot scope is FULL ContractorComplianceItem rows (frozen copy), not a digest. `snapshotJson` shape:
  ```ts
  {
    items: Array<{
      itemId: string,
      policyRuleId: string,
      severity: 'BLOCKING' | 'WARNING' | 'INFO',
      status: 'MISSING' | 'PENDING' | 'SATISFIED' | 'EXPIRED' | 'WAIVED',
      expiresAt: string | null,           // ISO8601 from @db.Date
      expiryJurisdictionTz: string | null,
      satisfiedByDocumentId: string | null,
      waivedReason: WaivedReason | null,
      waivedAt: string | null,
      satisfiedAt: string | null,
      createdAt: string,
    }>,
    policyRuleSetVersion: string,         // mirrors Phase 71 D-03
    jurisdictionDate: string,             // YYYY-MM-DD in contractor jurisdiction TZ
    eligibilityVerdict: 'PASS' | 'FAIL',
    failureReasons: Array<{ itemId, reason: 'severity_blocking_expired' | 'severity_blocking_missing', expiredOnDate?: string }>,
  }
  ```
  Replay-ready: a future audit can fully reconstruct "why did this export pass for contractor X on date Y" without joining live tables. Captures every BLOCKING-severity row regardless of status (PASS verdict still snapshots the full BLOCKING set so auditors can see what was checked, not just what failed).
- **D-18:** Atomicity boundary — `paymentRun.exportBankFile`:
  ```
  prisma.$transaction(async tx => {
    const eligibility = await assertContractorPaymentEligibility(contractorIds, { tx });
    // For each contractor, write PaymentRunComplianceCheck row (PASS verdict)
    const checkRows = await tx.paymentRunComplianceCheck.createMany({...});
    const exportRow = await tx.paymentExport.create({ data: { exportedAt: new Date(), fileUrl: null, ... } });
    // Generate file CONTENT inside tx (deterministic from already-written DB state)
    const fileBytes = generateBankFile(...);
    return { exportId: exportRow.id, fileBytes };
  });
  // After commit: upload to R2, then UPDATE PaymentExport.fileUrl in a follow-up small tx
  await uploadToR2(fileBytes);
  await prisma.paymentExport.update({ where: { id }, data: { fileUrl } });
  ```
  R2 upload is OUTSIDE the tx — if R2 fails, `PaymentExport.fileUrl IS NULL` surfaces as a retry-able state in the admin reconcile queue. Avoids long-held tx + un-rollback-able R2 writes.
- **D-19:** Failed-eligibility recording — even when export aborts, write `PaymentRunComplianceCheck` rows with `eligibilityVerdict = 'FAIL'`, `paymentExportId = null`, `failureReasons` populated. This row is written in a SEPARATE small transaction (since the parent export tx is rolling back). Ensures every export attempt — success or fail — leaves a forensic trail. Phase 73 admin dashboard "recently blocked exports" widget queries `WHERE eligibilityVerdict = 'FAIL' ORDER BY snapshottedAt DESC`.

### Claude's Discretion

- Exact pino log structure for `compliance.payment.would_block` and `compliance.reminder.fired` events — match existing log structure conventions in `packages/api/src/services/*.ts` (the project memory feedback is "no console.* in source; use `@contractor-ops/logger` factories").
- Exact wording of the digest email/notification ("X documents expiring soon" header, per-doc bullet list) — translatable via i18n keys; Phase 73 i18n parity work covers final copy. Phase 72 ships English placeholders + `*.json` keys for de/pl.
- Cron tick frequency — recommend matching existing `economic-dependency-scan` cron schedule (daily 02:00 UTC) unless ROADMAP-pinned otherwise. Researcher to confirm.
- Exact GIN-index syntax on `complianceHoldsJson` — pin from Postgres docs during research.
- Whether to add `@@check` Prisma constraints or rely on application-layer validation for `eligibilityVerdict = 'FAIL' ⇒ paymentExportId IS NULL` (recommend application-layer; Postgres CHECK constraints across nullable columns are awkward).
- Exact admin reconcile-queue surface for retry-able R2-failed exports (`fileUrl IS NULL` rows) — match existing payment-run admin patterns.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architectural twin (model for D-01..D-06)
- `packages/api/src/services/economic-dependency-scan.ts` — v5 CLASS-07 cron orchestrator. Phase 72's reminder cron mirrors its: band-state-machine pattern (lines around `bandFor` / `bandIndex`), `EconomicDependencyAlertState` upsert, recipient fan-out via `resolveRbacRecipients`, dispatch via `notification-service.ts`.
- `packages/api/src/services/notification-service.ts` (`dispatch()`) — existing notification fan-out (in-app + email + Slack). Used by D-04 Pass 2 digest emit.

### Existing reminder + dedup infrastructure (D-03)
- `apps/web/src/app/api/cron/reminders/reminders-shared.ts` — `claimCronNotificationDedup(dedupeKey)` helper. Phase 72 reuses verbatim with new dedup key prefixes `compl:band:*` and `compl:digest:*`.
- `packages/db/prisma/schema/migrations/20260426120000_reminder_unique_notification_cron_dedup/` — Phase 65 migration that established the unique-index dedup pattern. No new migration needed for the dedup table itself (re-uses).
- `apps/web/src/app/api/cron/reminders/route.ts` — existing reminder cron route. Phase 72 adds a new sub-orchestrator file (`compliance-reminder-scan.ts`) wired in here.
- `apps/web/src/app/api/cron/reminders/drv-clearance-expiries.ts` — existing band-cascade reminder for DRV clearance (v5). Same shape Phase 72 ships for compliance items. Worth reading as a smaller-scope precedent than `economic-dependency-scan.ts`.

### Schema baseline (extension target for D-01, D-12, D-14, D-16)
- `packages/db/prisma/schema/contractor.prisma` — `ContractorComplianceItem` model (Phase 71-extended with `severity`, `policyRuleId`, `expiryJurisdictionTz`, `waivedReason`). Phase 72 adds `ContractorComplianceReminderState` 1:1 sibling table.
- `packages/db/prisma/schema/approval.prisma` — `ApprovalFlow`, `ApprovalChainConfig`, `ApprovalStatus` enum. Phase 72 adds `PENDING_COMPLIANCE` enum value (D-12) and `complianceHoldsJson` column on `ApprovalFlow` (D-14).
- `packages/db/prisma/schema/payment.prisma` — `PaymentRun`, `PaymentRunItem`, `PaymentExport`. Phase 72 adds `PaymentRunComplianceCheck` table + `EligibilityVerdict` enum (D-16).
- `packages/db/scripts/migrate-all-regions.ts` (script `db:migrate:all`) — multi-region migration tool. Phase 72 schema migration carries the same Standing Constraint (manual post-deploy run per region).

### Phase 70 dependencies (feature-flag gating)
- `packages/feature-flags/src/signoff-registry-flags.ts` — Phase 70 D-09 parallel signoff registry. `compliance-payment-block` lives here as PENDING per ROADMAP. Engineers develop with `FLAG_SIGNOFF_BYPASS=local`.
- `packages/feature-flags/src/registry.ts` — `compliance-*` namespace registered.

### Phase 71 dependencies (severity, TZ, supersession)
- `.planning/phases/71-f1-compliance-policy-package-schema-classification-reconcile/71-CONTEXT.md` — Phase 71 decisions; especially D-05 (severity 3-tier), D-07 (`expiryJurisdictionTz` IANA), D-09..D-12 (WAIVED-never-deleted, supersession semantics, document carry-forward).
- `packages/classification/src/snapshot.ts` — `policyRuleSetVersion` snapshot pattern Phase 72 uses inside `PaymentRunComplianceCheck.snapshotJson` (D-17).
- `packages/compliance-policy/src/registry.ts` — Phase 71 typed-const policy registry. Phase 72 reads `severity` from rules during the eligibility check.
- `packages/api/src/routers/classification.ts` — Phase 71 `submit` mutation now emits `compliance.item.expires_at_changed` and `compliance.item.satisfied` domain events (Phase 72 listeners hook in here).

### tRPC + approval-engine integration (D-13, D-15)
- `packages/api/src/services/approval-engine.ts` — existing approval-engine. Phase 72 extends with the operator registry (D-13). Existing `conditionsJson` evaluation lives here.
- `packages/api/src/routers/approval.ts` — admin/approver tRPC procedures. Phase 72 adds `approval.resumeFromCompliance(approvalFlowId)` admin mutation as the manual fallback escape hatch (recovery hook D-15 covers the auto path).

### Audit log infrastructure
- Existing `audit_log` Prisma model — Phase 72 emits structured entries: `compliance.payment.blocked`, `compliance.payment.would_block`, `compliance.reminder.fired`, `compliance.reminder.reset`, `approval.compliance_resolved`, `payment.export.compliance_check`. No new audit table.

### TZ handling
- Whichever date-with-TZ library Phase 71 pinned (`dayjs/plugin/timezone` likely — Phase 71 D-07 left this for Researcher). Phase 72 reuses verbatim for jurisdiction-day boundary computation in cron + `PaymentRunComplianceCheck.jurisdictionDate`.

### Standing constraints
- `.planning/STATE.md` "Standing Project Constraints" — LOCAL-ONLY, legal review DEFERRED. Phase 72 ships the engine; the `compliance-payment-block` flag stays PENDING. No hard-block on missing legal sign-off.

### ROADMAP entry (success criteria source-of-truth)
- `.planning/ROADMAP.md` "Phase 72: F1 Compliance — Reminder Cascade + Payment Block" — 4 numbered success criteria. Phase 72 maps:
  - SC #1 → D-01..D-06 (reminder cascade engine)
  - SC #2 → D-07..D-11 (payment-block enforcement, error payload, flag gating)
  - SC #3 → D-12..D-15 (PENDING_COMPLIANCE recovery, condition operator)
  - SC #4 → D-16..D-19 (PaymentRunComplianceCheck audit row, atomicity, failure recording)

### Requirements
- `.planning/REQUIREMENTS.md` — COMPL-03 (reminder cascade), COMPL-05 (payment-run hard-block), COMPL-06 (PENDING_COMPLIANCE approval state), COMPL-07 (PaymentRunComplianceCheck audit row).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`packages/api/src/services/economic-dependency-scan.ts`** — full-cron orchestrator template. Reuse: band state-machine, `bandFor` / `bandIndex` shape, upsert pattern, recipient fan-out, `resolveRbacRecipients` integration.
- **`apps/web/src/app/api/cron/reminders/reminders-shared.ts`** (`claimCronNotificationDedup`) — DB-unique-index dedup. D-03 reuses verbatim.
- **`apps/web/src/app/api/cron/reminders/route.ts`** — cron route registry. New `compliance-reminder-scan` sub-orchestrator wires in here.
- **`packages/api/src/services/notification-service.ts`** (`dispatch`) — multi-channel notification fan-out (in-app + email + Slack). Phase 72 digest emit uses this.
- **`packages/api/src/services/cache.ts`** + **`packages/api/src/lib/idempotency.ts`** — Upstash Redis singleton + idempotency cache. NOT used in Phase 72 hot path (D-03 chose DB pattern), but available if a future operator needs Redis.
- **`packages/feature-flags/src/signoff-registry-flags.ts`** — `compliance-payment-block` PENDING entry plugs in here.
- **`packages/api/src/services/approval-engine.ts`** — existing condition-evaluator. Phase 72 extends with plugin registry (D-13).
- **`packages/db/prisma/schema/approval.prisma` `ApprovalStatus` enum** — additive `PENDING_COMPLIANCE` value (D-12).
- **`packages/db/prisma/schema/payment.prisma` `PaymentRun`/`PaymentExport` tables** — `PaymentRunComplianceCheck` joins via `paymentRunId` + `paymentExportId?`.
- **`packages/db/scripts/migrate-all-regions.ts`** (script `db:migrate:all`) — multi-region migration runner; Phase 72 migration carries Standing Constraint.

### Established Patterns

- **Band state machine + upsert per cron tick** (`economic-dependency-scan.ts`) — Phase 72 D-01..D-06 follow this verbatim.
- **DB-unique-index dedup, NOT Redis SETNX** (Phase 65 `notification_cron_dedup`) — Phase 72 D-03 deliberately diverges from the ROADMAP wording. Document the divergence in DISCUSSION-LOG.md so future readers don't re-litigate.
- **Two-pass cron orchestration: collect-then-emit** (`economic-dependency-scan.ts`) — Phase 72 D-04 follows this for digest aggregation.
- **Transactional mutation for state changes spanning multiple tables** (Phase 71 `recreateComplianceAssessment`) — Phase 72 D-09 / D-15 / D-18 all follow.
- **PRECONDITION_FAILED for blocked operations** (Phase 71 `recreateComplianceAssessment`'s idempotency precondition) — Phase 72 D-07 / D-09 reuse the error code.
- **Plugin-style registry over hardcoded switch statements** (Phase 70 D-02 typed constants, Phase 70 D-09 parallel package) — Phase 72 D-13 operator registry is in the same family.
- **Optimistic concurrency via version column** (some v5 saga state code) — Phase 72 D-01 reminder state uses this for the renewal-reset race.
- **Feature-flag PENDING + LOCAL-ONLY bypass** (Phase 70 D-10) — Phase 72 D-11 mirrors.
- **WAIVED-skip across consumers** (Phase 71 D-09 / D-11) — Phase 72 reminder and payment-block both skip WAIVED rows.
- **Replay-ready audit snapshots** (Phase 71 D-15 single-entry-per-recompute, frozen-row snapshot) — Phase 72 D-16 / D-17 follow.

### Integration Points

- **`apps/web/src/app/api/cron/reminders/route.ts`** — new sub-orchestrator import (`runComplianceReminderScan`).
- **`packages/api/src/routers/classification.ts`** — Phase 71 `submit` mutation emits `compliance.item.expires_at_changed` and `compliance.item.satisfied` events. Phase 72 adds listeners for both (cascade reset D-06, approval recovery D-15). Listener wiring lives next to the emit (single transactional unit).
- **`packages/api/src/routers/payment-run.ts`** — `paymentRun.create`, `paymentRun.addItems`, `paymentRun.exportBankFile` mutations all gain `assertContractorPaymentEligibility` calls (D-08). New `paymentRun.exportBankFile` adds `PaymentRunComplianceCheck` writes (D-16..D-19).
- **`packages/api/src/services/approval-engine.ts`** — operator registry (D-13). New file `operators/compliance-critical.ts`. Engine's existing `evaluateCondition` becomes a thin shim over the registry.
- **`packages/api/src/routers/approval.ts`** — new admin mutation `approval.resumeFromCompliance(approvalFlowId)` for the manual fallback path (audit-logged, eligibility re-asserted).
- **`packages/db/prisma/schema/`** — three additive migrations: (a) `ContractorComplianceReminderState` table + `ReminderBand` enum, (b) `ApprovalStatus` enum extension + `complianceHoldsJson` column + GIN index, (c) `PaymentRunComplianceCheck` table + `EligibilityVerdict` enum. Multi-region apply per Standing Constraint.
- **Web UI**: payment-run wizard renders the structured-error modal from D-10 payload; admin queue view (Phase 73) consumes `PaymentRunComplianceCheck` rows. Phase 72 ships the wizard modal only; dashboard polish is Phase 73.

</code_context>

<specifics>
## Specific Ideas

- The 5-band cascade (90/60/30/15/7) is locked by `PROJECT.md` and ROADMAP — no negotiation on band count.
- The `economic-dependency-scan.ts` pattern is the single architectural twin Researcher should anchor against (Pattern 3 there: state-machine + dispatch + cadence).
- Per-recipient daily digest is a direct response to the v1.0 invoice-reminder fatigue lesson — keep the lesson explicit in the cron's header comment so future readers don't strip the digest "for simplicity".
- The PRECONDITION_FAILED error payload structure (D-10) is the same shape Phase 73 dashboard consumes — design it once, use twice.
- The `compliance-payment-block` flag stays PENDING all the way through Phase 72; LOCAL-ONLY engineers use `FLAG_SIGNOFF_BYPASS=local` to enable hard-block in dev environments.
- `complianceHoldsJson` (D-14) is intentionally JSONB with GIN index, not a join table, because the relationship is short-lived (held → released) and the audit history lives in AuditLog entries — relational normalisation would over-engineer for the actual access pattern.
- The "approval re-enters PENDING, never auto-APPROVE" rule (D-15) honours v1.0 RBAC's "approver must explicitly act" invariant; this should be called out in the approval-engine code comment.

</specifics>

<deferred>
## Deferred Ideas

- **DB CHECK constraint / Postgres trigger as a payment-block safety net** — rejected in D-08 in favour of API-layer-only enforcement + CI lint. Revisit only if production telemetry shows a payment-write code path bypassed the helper (i.e. a real escape, not a hypothetical).
- **Redis SETNX for per-recipient digest throttle** — rejected in D-03 in favour of the existing DB-unique-index pattern. Revisit if cron runtime shows the unique-index inserts becoming a hotspot at scale (well past v6.0).
- **Generic plugin operator registry beyond `complianceCritical`** — registry pattern shipped (D-13) but only one operator lands in Phase 72. Future operators (budget-cap, fraud-score, region-hold) plug into the same registry without core-engine changes.
- **Auto-skip blocked contractors on export** — rejected in D-09 in favour of fail-closed. Revisit if admins running large batches complain about the "doc expired mid-batch → manually remove → retry" loop. UX could land in Phase 73 as an opt-in.
- **Auto-APPROVE on compliance resolution** — rejected in D-15. Approver action stays explicit. Not a future-revisit candidate; this is a deliberate v1.0 RBAC invariant.
- **Per-export tamper-evidence hash on `snapshotJson`** — rejected in D-17 in favour of full row snapshot. Phase 76 IdP saga model uses SHA-256 hashes for SOC2 evidence; if a future SOC2 audit demands the same for compliance checks, add a `snapshotHash` column then. Out of scope for v6.0.
- **Soft-warn modal on TOCTOU (admin chooses skip vs cancel)** — rejected in D-09 in favour of fail-closed. Revisit if real admin workflows show the strict path is too brittle.
- **Two-table relational hold linkage (`ApprovalComplianceHold`)** — rejected in D-14 in favour of JSONB. Revisit only if a future need to join held-by-item across history emerges.
- **Sub-status column instead of new enum value for PENDING_COMPLIANCE** — rejected in D-12; ROADMAP names the state explicitly. Revisit only if the v6+ approval engine grows multiple hold reasons (budget, fraud, etc.) and the enum becomes unwieldy — at which point sub-status is the cleaner refactor.

</deferred>

---

*Phase: 72-f1-compliance-reminder-cascade-payment-block*
*Context gathered: 2026-04-27*
