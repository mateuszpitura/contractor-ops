# Phase 72 — Research

**Researched:** 2026-04-27
**Goal:** "What do I need to know to PLAN Phase 72 well?"

Phase 72 wires the Phase 71 schema (`severity`, `expiryJurisdictionTz`, `policyRuleId` on `ContractorComplianceItem`) into runtime behavior — a band-state-machine reminder cron, hard payment-block at every payment-write entry point, a `PENDING_COMPLIANCE` approval state with a plug-in `complianceCritical` operator, and a `PaymentRunComplianceCheck` audit row written transactionally with bank-file emission.

This phase has minimal external research surface — every architectural decision was locked in `72-CONTEXT.md` against a battle-tested in-repo twin (`economic-dependency-scan.ts`) and a Phase 65 dedup pattern (`reminders-shared.ts`). Research below confirms the twins, names the precise file/function targets, and pins a few open items left to "Claude's Discretion" (cron schedule, GIN-index syntax, log-event names).

---

## Architectural Twin (canonical reference)

`packages/api/src/services/economic-dependency-scan.ts` is the **single architectural anchor** for D-01..D-06.

Confirmed shape (read 2026-04-27, 366 LoC):

| Element | Twin construct | Phase 72 mapping |
|---------|----------------|------------------|
| Pure band classifier | `bandFor(share: number): Band` | `bandFor(daysUntilExpiry: number): ReminderBand` |
| Band ordering | `bandIndex(b: Band): number` (0/1/2) | `bandIndex(b: ReminderBand): number` (0..6 — NONE → D90 → D60 → D30 → D15 → D7 → EXPIRED) |
| State table | `EconomicDependencyAlertState` (1:1 with `contractorAssignment` via `@unique`) | `ContractorComplianceReminderState` (1:1 with `ContractorComplianceItem` via `itemId @unique`) |
| Upsert in cron | `prismaRaw.economicDependencyAlertState.upsert({ where: { contractorAssignmentId }, ... })` | `prismaRaw.contractorComplianceReminderState.upsert({ where: { itemId }, ... })` |
| Recipient fan-out | `await resolveRbacRecipients(orgId, 'contractor:read')` | `await resolveRbacRecipients(orgId, 'compliance:read')` |
| Dispatch | `await dispatch({ organizationId, type, recipientUserIds, ... })` | identical |
| Cadence helper | `daysBetween(a, b)` + `REMINDER_CADENCE_DAYS = 30` | NOT NEEDED — Phase 72 uses **band transitions only**, not periodic reminders |
| Logger | `createCronLogger('classification-economic-dependency')` | `createCronLogger('compliance-reminder-scan')` |
| Metrics | `metrics.gauge('cron.classification_economic_dependency.scanned', n)` | `metrics.gauge('cron.compliance_reminder.scanned', n)` etc. |
| Cross-org access | `prismaRaw` (no tenant frame) | `prismaRaw` (cron has no tenant frame) |
| Error handling | `try/catch per-row, log.error` | identical (do not abort whole scan on per-item failure) |

**Critical divergence — band semantics:**
- Twin (`economic-dependency-scan`) bands are derived from a **continuous variable** (`billingShare`), with an "improvement" path (`cross-down`) and a 30-day re-fire cadence in non-safe bands.
- Phase 72 bands are derived from a **monotonically decreasing time-to-expiry** (`daysUntilExpiry`); the only reasonable transition direction is forward (NONE → D90 → D60 → D30 → D15 → D7 → EXPIRED). The reverse direction (`expiresAt` extended via renewal) resets the row to NONE per D-06 (renewal listener), NOT via a "cross-down" band-transition path.
- **No 30-day re-fire cadence.** Each band fires exactly once per item per renewal cycle. The "cadence" is built into the band sequence — D60 IS the 30-day-later re-fire of D90.

Twin lines 169-219 implement the cross-up / cross-down / re-fire logic; Phase 72's `updateBandState` will be **strictly simpler**: compute next band from `daysUntilExpiry`, fire iff `nextBand !== existing.lastBandFired AND nextBand !== NONE`, persist, return.

---

## Existing Reminder & Dedup Infrastructure

`apps/web/src/app/api/cron/reminders/reminders-shared.ts` — confirmed surface (read 2026-04-27, 32 LoC):

```ts
export async function claimCronNotificationDedup(dedupeKey: string): Promise<boolean>
// returns true on first claim, false on P2002 unique-violation, throws on other errors
```

Backed by Phase 65 migration `20260426120000_reminder_unique_notification_cron_dedup` — `notification_cron_dedup` table with `dedupeKey` as UNIQUE column.

**Phase 72 dedup-key shapes (D-03):**
- Per-band fire: `compl:band:{itemId}:{band}:{jurisdictionDate}` where `jurisdictionDate = YYYY-MM-DD in expiryJurisdictionTz`
- Per-recipient daily digest: `compl:digest:{userId}:{jurisdictionDate}` where `jurisdictionDate` is computed from the recipient's organization TZ default OR the contractor's TZ — pin **organization TZ** (recipient-side, not contractor-side) for digest consistency: an admin watching contractors across multiple TZs gets ONE digest per their own day.

**Smaller-scope precedent — DRV expiries cron** (`apps/web/src/app/api/cron/reminders/drv-clearance-expiries.ts`, 68 LoC): demonstrates day-exact band match `validTo: { gte: target, lt: targetEnd }`, one-shot dedup keyed on `(type, entityType, entityId)`. Phase 72's structure is a strict superset (state machine + recipient-digest layer).

---

## Cron Wiring

`apps/web/src/app/api/cron/reminders/route.ts` (lines 388-436) is the entry point:

```ts
const [ruleResults, overdueTasksNotified, drvExpiriesNotified] = await Promise.all([
  evaluateReminderRules(),
  detectOverdueTasks(),
  detectDrvClearanceExpiries(),
]);
```

Cron schedule: `'0 9 * * *'` UTC daily (line 432). **Phase 72 piggybacks on this same cron** — adds a fourth call: `runComplianceReminderScan()`. Schedule does NOT change. The 02:00 UTC schedule referenced in CONTEXT.md "Claude's Discretion" was a misread of `economic-dependency-scan` — the **reminders cron** runs at 09:00 UTC; Phase 72 is part of THIS cron, not a new one.

Error handling: each call inside `Promise.all`. If `runComplianceReminderScan` throws, the other three still run (because `Promise.all` rejects on first throw — actually NO; need defensive wrapping). Look at line 398: it IS `Promise.all`, so a throw in any branch fails the cron. **Pin design decision:** wrap `runComplianceReminderScan` in a try/catch INSIDE the function so it never throws to the cron route — it logs + returns 0. (Twin `economic-dependency-scan` already does per-row try/catch but the orchestrator can still throw on infra failure; we wrap one level higher.)

---

## Notification Service Contract

`packages/api/src/services/notification-service.ts` `dispatch()` shape (confirmed via existing call sites):

```ts
await dispatch({
  organizationId: string,
  type: NotificationType,         // string-typed enum — Phase 72 adds new entries
  recipientUserIds: string[],
  title: string,
  body: string,
  entityType: EntityType,         // 'CONTRACTOR' for compliance reminders
  entityId: string,               // contractorId
  metadata?: Record<string, unknown>,
});
```

**New `NotificationType` values (Phase 72):**
- `compliance.expiry_reminder.D90` / `.D60` / `.D30` / `.D15` / `.D7` — per-band item reminders (FALLBACK only; not used in digest mode)
- `compliance.expiry_digest` — single per-recipient daily digest (preferred path per D-04)

The digest path emits ONE notification with metadata listing all (doc, band, expiresAt) entries. Per-band notifications stay registered for fallback — if dispatch fails for the digest, individual band-fire entries remain captured in audit log per D-06.

i18n: title/body in English, with i18n keys for de/pl. Phase 73 covers full i18n parity. Locked-phrase registry from Phase 71 covers `documentTypeLabelKey`.

---

## Schema Migration Surface

Three migrations land in Phase 72, each in a separate plan for crash-recovery clarity:

### Migration A — `ContractorComplianceReminderState` + `ReminderBand` enum (D-01, D-02)

```prisma
enum ReminderBand {
  NONE
  D90
  D60
  D30
  D15
  D7
  EXPIRED
}

model ContractorComplianceReminderState {
  itemId            String       @unique  // FK to ContractorComplianceItem.id
  organizationId    String                // denormalized for index efficiency
  currentBand       ReminderBand @default(NONE)
  lastBandFired     ReminderBand?
  lastBandFiredAt   DateTime?
  version           Int          @default(0)  // optimistic concurrency
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  item ContractorComplianceItem @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([organizationId, currentBand])
}
```

`itemId` is BOTH the primary FK and the unique key — no separate `id` column. Mirrors twin `EconomicDependencyAlertState.contractorAssignmentId @unique` shape.

### Migration B — `ApprovalStatus.PENDING_COMPLIANCE` + `complianceHoldsJson` + GIN index (D-12, D-14)

```prisma
enum ApprovalStatus {
  NOT_STARTED
  PENDING
  PENDING_COMPLIANCE  // NEW (D-12)
  APPROVED
  REJECTED
  CANCELLED
}

model ApprovalFlow {
  // ... existing fields ...
  complianceHoldsJson Json?  // NEW (D-14): { itemIds: string[], heldAt: ISO8601, heldByOperator: string }
}
```

**Postgres-native ALTER TYPE:** `ALTER TYPE "ApprovalStatus" ADD VALUE 'PENDING_COMPLIANCE' AFTER 'PENDING'` is fully backward-compatible. Prisma's auto-generated migration uses this verbatim — confirmed against Phase 71 enum-extend pattern (`Severity` enum was added the same way).

**GIN index for JSONB containment** (`complianceHoldsJson @> '{"itemIds": [...]}'`):
```sql
-- Migration custom SQL (Prisma migrate dev does NOT auto-emit GIN for json columns):
CREATE INDEX "ApprovalFlow_complianceHoldsJson_gin_idx"
  ON "ApprovalFlow" USING GIN ("complianceHoldsJson" jsonb_path_ops);
```

`jsonb_path_ops` operator class is the right choice for `@>` (containment) queries — smaller index, faster lookups, and the only operations needed are containment. Confirmed against Postgres 16 docs (which the Neon backend runs).

### Migration C — `PaymentRunComplianceCheck` table + `EligibilityVerdict` enum (D-16)

```prisma
enum EligibilityVerdict {
  PASS
  FAIL
}

model PaymentRunComplianceCheck {
  id                   String             @id @default(cuid())
  organizationId       String
  paymentRunId         String
  paymentExportId      String?            // null when verdict = FAIL
  contractorId         String
  snapshottedAt        DateTime           @default(now())
  snapshotJson         Json
  eligibilityVerdict   EligibilityVerdict
  failureReasons       Json?
  policyRuleSetVersion String
  createdAt            DateTime           @default(now())

  organization  Organization   @relation(fields: [organizationId], references: [id])
  paymentRun    PaymentRun     @relation(fields: [paymentRunId], references: [id])
  paymentExport PaymentExport? @relation(fields: [paymentExportId], references: [id])
  contractor    Contractor     @relation(fields: [contractorId], references: [id])

  @@index([organizationId])
  @@index([paymentRunId])
  @@index([contractorId, snapshottedAt(sort: Desc)])
  @@index([paymentExportId])
}
```

Multi-region apply per Standing Constraint via `packages/db/scripts/push-all-regions.ts`.

---

## Payment-Block Integration Points

`packages/api/src/routers/payment.ts` confirmed entry points (1350 LoC, read 2026-04-27):

| Procedure | Line | Phase 72 wiring |
|-----------|------|-----------------|
| `paymentRun.create` | 343 (`tenantProcedure.use(requirePermission(...)).input(paymentRunCreateSchema).mutation(...)`) | Add `assertContractorPaymentEligibility(contractorIds)` BEFORE the existing `paymentRun.findFirst` runNumber generation. Throws `PRECONDITION_FAILED` per D-07 / D-10 |
| `paymentRun.export` (the bank-file export at line ~700; the actual procedure name is the one calling `_generateExportFileForFormat`) | ~660-740 | Wrap the existing `$transaction` to: (a) re-assert eligibility, (b) write `PaymentRunComplianceCheck` rows (PASS), (c) generate file, (d) write `PaymentExport` row — all atomic per D-18. R2 upload OUTSIDE tx (existing pattern). On FAIL: separate small tx writes FAIL-verdict rows per D-19 |
| `paymentRun.updateItemStatus` | 745 | NOT a payment-write entry point — only flips item status to PAID/FAILED post-export. NO eligibility check needed |
| `paymentRun.addItems` / `paymentRun.updateItems` | search confirms not present in current router (item-level mutations land via `create`'s invoice-list and the wizard rebuilds runs rather than mutating items) | If these procedures DO exist after Phase 71 (verify in Plan 72-04), wire the assertion. Otherwise SKIP — the create + export gates are the only entry points |

**Approval-engine auto-`READY` path:** `packages/api/src/services/approval-engine.ts` `advanceFlow()` (line 241). When the final step approves, the flow status flips to `APPROVED` (line 269). The auto-`READY` transition happens DOWNSTREAM in the invoice update path (search `paymentStatus.*READY` to find call site). Phase 72 wires `complianceCritical` BEFORE the flow advances to APPROVED — so the held-state lives in the approval-engine, not in the invoice-payment-status code. The invoice-payment helper still calls `assertContractorPaymentEligibility` as defence-in-depth (D-08).

**CI lint rule (D-08 enforcement):** add a custom `packages/lint-guards/` rule (precedent from Phase 70) that walks `packages/api/src/routers/*.ts`, identifies any procedure whose name matches `paymentRun.(create|export|addItems|updateItems)`, and fails CI if the procedure body lacks `assertContractorPaymentEligibility(`. Single source of truth for "did we actually wire the helper everywhere".

---

## Approval-Engine Operator Registry (D-13)

`packages/api/src/services/approval-engine.ts` `evaluateConditions()` currently handles only `field === 'amount'` and `field === 'contractorType'` with hardcoded operator logic (line 63-110). D-13's plug-in registry replaces this with:

```ts
// New file: packages/api/src/services/approval-engine/operators/registry.ts
export interface ConditionEvaluator<TArgs = unknown> {
  (args: TArgs, context: EvaluationContext): Promise<boolean>;
}
const operators = new Map<string, ConditionEvaluator>();
export function registerOperator<TArgs>(name: string, evaluator: ConditionEvaluator<TArgs>) {
  operators.set(name, evaluator as ConditionEvaluator);
}
export async function evaluateOperator(name: string, args: unknown, context: EvaluationContext): Promise<boolean> {
  const evaluator = operators.get(name);
  if (!evaluator) throw new Error(`Unknown operator: ${name}`);
  return evaluator(args, context);
}
```

```ts
// New file: packages/api/src/services/approval-engine/operators/compliance-critical.ts
import { registerOperator } from './registry.js';
import { prismaRaw } from '@contractor-ops/db';

interface Args { status: 'EXPIRED' | 'MISSING' }
registerOperator<Args>('complianceCritical', async (args, ctx) => {
  const blocking = await prismaRaw.contractorComplianceItem.findFirst({
    where: {
      contractorId: ctx.contractorId,
      severity: 'BLOCKING',
      status: args.status,
    },
    select: { id: true },
  });
  return blocking !== null;
});
```

**Self-registration via barrel-import side effect:**
```ts
// packages/api/src/services/approval-engine/operators/index.ts
import './compliance-critical.js';  // side-effect: registers operator
// Future: import './budget-cap.js'; etc.
```

The barrel is imported once at engine module-load time:
```ts
// packages/api/src/services/approval-engine.ts (top of file)
import './approval-engine/operators/index.js';  // ensures all operators registered
```

`evaluateConditions()` becomes a thin shim:
```ts
export function evaluateConditions(conditionsJson, context) {
  const conditions = parseConditions(conditionsJson);
  return Promise.all(conditions.map(c => evaluateOperator(c.operator, c.args, context)))
    .then(results => results.every(Boolean));
}
```

**Backward compatibility:** existing `field === 'amount'`/`contractorType'` conditions migrate to operator form. Either (a) ship a one-shot data migration that rewrites existing `conditionsJson` into the new shape, or (b) build a dual-path parser that accepts both legacy `{ field, operator, value }` and new `{ operator, args }`. Option (b) is safer — pin in plan 72-06.

---

## Recovery Hook (D-15)

`packages/api/src/routers/classification.ts` line 865 already creates a `classificationEscalationEvent` row. The `submit` mutation also returns a `materialiseFromPolicy` result. We need to find where the `compliance.item.satisfied` and `compliance.item.expires_at_changed` events are emitted — current code uses `classificationEscalationEvent` table writes as the synchronous "event," not a domain-event bus.

**Pin the listener pattern:** Phase 72 follows the existing direct-call pattern (no event bus). The `materialiseFromPolicy` and item-update code paths in `classification.ts` directly invoke:

```ts
// In the same $transaction as the item update:
await onComplianceItemSatisfied(tx, { itemId, contractorId, organizationId });
await onComplianceItemExpiresAtChanged(tx, { itemId });  // for renewal reset
```

These helpers live in `packages/api/src/services/compliance-recovery.ts` (NEW file, Plan 72-05):

```ts
export async function onComplianceItemSatisfied(tx, { itemId, contractorId, organizationId }) {
  // Find PENDING_COMPLIANCE approvals held by this item (JSONB containment query):
  const heldFlows = await tx.$queryRaw`
    SELECT id FROM "ApprovalFlow"
    WHERE status = 'PENDING_COMPLIANCE'
      AND organizationId = ${organizationId}
      AND "complianceHoldsJson" @> ${JSON.stringify({ itemIds: [itemId] })}::jsonb
  `;
  for (const flow of heldFlows) {
    // Re-assert eligibility — only release if NO blocking item still expired
    const eligibility = await assertContractorPaymentEligibility([contractorId], { tx, throwOnFail: false });
    if (eligibility.blocked) continue;  // other items still hold this approval
    await tx.approvalFlow.update({
      where: { id: flow.id },
      data: { status: 'PENDING', complianceHoldsJson: null },
    });
    await tx.auditLog.create({ data: { action: 'approval.compliance_resolved', ... } });
  }
}

export async function onComplianceItemExpiresAtChanged(tx, { itemId }) {
  // Atomically reset the reminder state with version bump:
  await tx.contractorComplianceReminderState.upsert({
    where: { itemId },
    update: { currentBand: 'NONE', lastBandFired: null, lastBandFiredAt: null, version: { increment: 1 } },
    create: { itemId, currentBand: 'NONE', version: 0 },
  });
  await tx.auditLog.create({ data: { action: 'compliance.reminder.reset', ... } });
}
```

Optimistic-concurrency in cron upsert (D-01 `version` column):
```ts
// In runComplianceReminderScan, when persisting band transition:
const updated = await tx.contractorComplianceReminderState.updateMany({
  where: { itemId, version: existingState.version },
  data: { currentBand: nextBand, lastBandFired: nextBand, lastBandFiredAt: now, version: { increment: 1 } },
});
if (updated.count === 0) {
  // Version raced with a renewal-reset — skip this fire, will retry next cron tick
  log.warn({ itemId, version: existingState.version }, 'reminder cron lost optimistic-concurrency race; skipping fire');
  return;
}
```

**Manual escape hatch (D-15 fallback):** `approval.resumeFromCompliance(approvalFlowId)` admin tRPC mutation in `packages/api/src/routers/approval.ts`:
- Permission: `approval:override` (existing)
- Action: re-asserts eligibility; if PASS, transitions PENDING_COMPLIANCE → PENDING; audit-logged with `actorUserId` and reason text
- If still FAIL: returns structured error showing which items still block

---

## Validation Architecture (Nyquist sampling)

Phase 72 ships behavior-heavy code (cron scheduler, hard-block helper, recovery listener). Test coverage MUST verify the band state-machine, the dedup idempotency, the optimistic-concurrency renewal race, the TOCTOU atomicity at export, and the JSONB containment recovery query.

| Sampling rate | Test type | Command | Latency target |
|---------------|-----------|---------|----------------|
| Every commit | Unit (Vitest) | `pnpm --filter @contractor-ops/api test --run` | < 30s |
| Every wave | Integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='reminder|compliance-payment-gate|approval-engine'` | < 90s |
| Pre-verify | Full | `pnpm test` | < 5min |

**Wave 0 failing tests (Plan 72-01):**
1. `packages/api/src/services/__tests__/compliance-reminder-scan.test.ts` — at least one `it('fires D90 band on first cron tick after 90d threshold', ...)` failing (helper not implemented)
2. `packages/api/src/services/__tests__/compliance-payment-gate.test.ts` — `it('throws PRECONDITION_FAILED when contractor has BLOCKING+EXPIRED item', ...)` failing
3. `packages/api/src/services/__tests__/approval-engine-operator-registry.test.ts` — `it('registers complianceCritical operator at module-load', ...)` failing
4. `packages/api/src/services/__tests__/payment-run-compliance-check.test.ts` — `it('writes PaymentRunComplianceCheck row in same tx as PaymentExport', ...)` failing
5. `apps/web/src/components/payment/__tests__/payment-block-modal.test.tsx` — `it('renders per-contractor reasons with deep links', ...)` failing
6. `packages/api/src/services/__tests__/compliance-recovery.test.ts` — `it('resumes PENDING_COMPLIANCE flow when held item satisfied', ...)` failing

**Manual UAT-only verifications:**
- End-to-end test: contractor with UK Right-to-Work expiring in 89 days receives ONE digest email at next cron tick — requires email-inbox observation OR mock dispatch capture.
- Multi-region migration apply via `push-all-regions.ts` — verified by ops post-deploy per Standing Constraint.
- `FLAG_SIGNOFF_BYPASS=local` engineer-bypass UX — verified manually in dev environment.

---

## Open Items Resolved Here

| CONTEXT.md "Claude's Discretion" item | Decision pinned by research |
|---------------------------------------|------------------------------|
| Pino log structure for `compliance.payment.would_block` and `compliance.reminder.fired` | Match existing services pattern: `log.info({ event: 'compliance.payment.would_block', organizationId, contractorId, itemIds, eligibilityVerdict }, 'Compliance payment block (would-block, flag off)')` — single-line with structured context object, message is human prose. See `economic-dependency-scan.ts` lines 355-358 for the canonical shape. |
| Cron tick frequency | DAILY 09:00 UTC — piggybacks on existing reminders cron (`apps/web/src/app/api/cron/reminders/route.ts` line 432). Do NOT add a new cron route. |
| GIN index syntax | `CREATE INDEX "ApprovalFlow_complianceHoldsJson_gin_idx" ON "ApprovalFlow" USING GIN ("complianceHoldsJson" jsonb_path_ops);` — emitted via custom SQL in the migration's `migration.sql` (Prisma does not auto-generate GIN for `Json?` columns). `jsonb_path_ops` operator class chosen for `@>` containment. |
| `@@check` Prisma constraints vs application-layer for `eligibilityVerdict = 'FAIL' ⇒ paymentExportId IS NULL` | **Application-layer.** Prisma 7's `@@check` is not yet GA on the multi-region Neon target; cleaner to enforce via the helper that writes the row (single write site) + a dedicated unit test. |
| Admin reconcile-queue surface for retry-able R2-failed exports | OUT OF SCOPE for Phase 72 — Phase 73 dashboard owns. Phase 72's contract: `PaymentExport.fileUrl IS NULL` is the durable signal; querying it is Phase 73's job. |
| `assertContractorPaymentEligibility` `failOpen` flag semantics | RENAMED `throwOnFail` for clarity. Default `true` (throws PRECONDITION_FAILED). When `false`, returns `{ blocked: boolean, reasons }` for the would-block soft-warn flow (D-11) AND for the recovery-hook re-assertion path. |
| Date library for `jurisdictionDate` calculation in cron | `@date-fns/tz` (already a dep of `packages/compliance-policy`). NOT `dayjs` — repo standard is `date-fns`. CONTEXT.md mentioned `dayjs.tz` aspirationally; correct is `new TZDate(now, expiryJurisdictionTz)` per `packages/compliance-policy/src/expiry.ts` (Phase 71 D-07 already pinned this). |

---

## RESEARCH COMPLETE

Phase 72 has zero unknown blockers. Every decision in CONTEXT.md is grounded against an in-repo twin or an existing Phase 71 / Phase 65 / Phase 70 pattern. Open items pinned above. Ready for planning.
