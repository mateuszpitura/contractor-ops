# Phase 72 — Pattern Map

For each new/modified file, lists the closest in-repo analog and the concrete code shape to mirror. Read this before any plan executes.

> ⚠️ **POST-MIGRATION PATH NOTICE (2026-05-31).** Written pre-web-migration. Stale paths below (`apps/web/...`, `routers/payment.ts`, `routers/approval.ts`, `routers/classification.ts`) are superseded by the **PLAN.md files (72-01..08)** and **`72-REPLAN-DRIFT-MAP.md`** (authoritative). Current targets: `apps/web-vite` (modal: `components/payments/`, analog `.../new-payment-run-dialog/step-review.tsx` + drv-clearance container; i18n flat `apps/web-vite/messages/{en,de,pl,ar}.json`); cron → `apps/cron-worker/src/jobs/handlers/reminders/index.ts`; payment → `routers/finance/payment.ts`; approval → `routers/core/approval.ts`; classification → `routers/compliance/classification.ts`; lint-guard → per-guard subdir `lint-guards/src/payment-gate-guard/`.

---

## New: `packages/db/prisma/schema/contractor.prisma` (additive — `ContractorComplianceReminderState` model + `ReminderBand` enum)

**Analog:** `packages/db/prisma/schema/contractor.prisma:229-257` (`ContractorComplianceItem`); state-table shape from `prismaRaw.economicDependencyAlertState` model (referenced in `economic-dependency-scan.ts:230-237`).

**Pattern excerpt — 1:1 state table with `@unique` FK:**
```prisma
model EconomicDependencyAlertState {
  // (referenced via prismaRaw — model lives in same schema dir)
  contractorAssignmentId String   @unique
  currentBand            String
  lastBillingShare       Float
  lastScannedAt          DateTime
  lastCrossedAt          DateTime?
  lastReminderAt         DateTime?
}
```

**Phase 72 mirrors:** `itemId @unique` (1:1), `currentBand`, `lastBandFired`, `lastBandFiredAt`, `version Int` (NEW vs twin — concurrency gate per D-01).

---

## New: `packages/db/prisma/schema/approval.prisma` (additive — `PENDING_COMPLIANCE` enum value + `complianceHoldsJson` column)

**Analog:** `packages/db/prisma/schema/contractor.prisma:300-304` (`Severity` enum extension shape from Phase 71); `packages/db/prisma/schema/approval.prisma:21-44` (existing `ApprovalFlow` model).

**Pattern excerpt — Postgres-native enum extension via raw migration SQL:**
```sql
-- Phase 71 (20260427103913_add_compliance_policy_columns_v6/migration.sql precedent)
ALTER TYPE "ApprovalStatus" ADD VALUE 'PENDING_COMPLIANCE' AFTER 'PENDING';
```

**Phase 72:** the migration adds the enum value (raw SQL since Prisma's auto-migrate is conservative on enum mutations) AND the `complianceHoldsJson Json?` column AND the GIN index (custom SQL — Prisma does not auto-emit GIN for `Json` columns).

---

## New: `packages/db/prisma/schema/payment.prisma` (additive — `PaymentRunComplianceCheck` model + `EligibilityVerdict` enum)

**Analog:** `packages/db/prisma/schema/payment.prisma:72-90` (`PaymentExport`); `packages/db/prisma/schema/audit.prisma:3-27` (`AuditLog`'s `JSONb` snapshot pattern).

**Pattern excerpt — append-only audit row with snapshot column:**
```prisma
model AuditLog {
  id            String     @id @default(cuid())
  organizationId String
  resourceType  EntityType
  resourceId    String
  oldValuesJson Json?
  newValuesJson Json?
  metadataJson  Json?
  createdAt     DateTime   @default(now())
  // NO updatedAt — audit logs are immutable
  @@index([organizationId, resourceType, resourceId, createdAt])
}
```

**Phase 72 mirrors:** snapshot-only Json columns, no `updatedAt`, multiple targeted indexes (`@@index([paymentRunId])`, `@@index([contractorId, snapshottedAt(sort: Desc)])`).

---

## New: `packages/api/src/services/compliance-reminder-scan.ts`

**Analog:** `packages/api/src/services/economic-dependency-scan.ts` (366 LoC).

**Pattern excerpts to mirror verbatim:**

```ts
// Logger + metrics (lines 42-48):
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
const log = createCronLogger('compliance-reminder-scan');

// Pure band classifier (lines 64-69):
export function bandFor(daysUntilExpiry: number): ReminderBand {
  if (daysUntilExpiry < 0) return 'EXPIRED';
  if (daysUntilExpiry <= 7) return 'D7';
  if (daysUntilExpiry <= 15) return 'D15';
  if (daysUntilExpiry <= 30) return 'D30';
  if (daysUntilExpiry <= 60) return 'D60';
  if (daysUntilExpiry <= 90) return 'D90';
  return 'NONE';
}

// Orchestrator skeleton (lines 265-361):
export async function runComplianceReminderScan(now: Date = new Date()): Promise<ScanResult> {
  let scanned = 0, fires = 0, digests = 0;
  // Pass 1: collect band transitions per item, claim per-band dedup, accumulate pendingFires
  const items = await prismaRaw.contractorComplianceItem.findMany({
    where: { severity: 'BLOCKING', status: { notIn: ['WAIVED', 'SATISFIED'] } },
    select: { id: true, contractorId: true, organizationId: true, expiresAt: true, expiryJurisdictionTz: true, name: true, documentType: true, policyRuleId: true },
  });
  const pendingFires = new Map<string, FireGroup>(); // key = `${recipientUserId}:${jurisdictionDate}`
  for (const item of items) { /* compute band transition, claim dedup, accumulate */ }
  // Pass 2: per recipient, claim digest dedup, dispatch ONE digest
  for (const [key, group] of pendingFires) { /* claim `compl:digest:${userId}:${jurisdictionDate}`, dispatch */ }
  metrics.gauge('cron.compliance_reminder.scanned', scanned);
  metrics.gauge('cron.compliance_reminder.fires', fires);
  metrics.gauge('cron.compliance_reminder.digests', digests);
  log.info({ scanned, fires, digests }, 'compliance reminder scan complete');
  return { scanned, fires, digests };
}

// Test-deps export (line 364-365):
export const __deps = { prisma, prismaRaw, dispatch, resolveRbacRecipients, claimCronNotificationDedup };
```

---

## New: `packages/api/src/services/compliance-payment-gate.ts`

**Analog:** `packages/api/src/services/compliance-supersession.ts` (Phase 71 helper, transactional eligibility-check shape); `packages/api/src/routers/payment.ts:355-395` (existing `TRPCError({ code: 'PRECONDITION_FAILED' })` pattern).

**Pattern excerpt — transactional helper accepting `tx?` overload:**
```ts
import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@contractor-ops/db';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

interface ContractorReason {
  contractorId: string;
  contractorName: string;
  reasons: Array<{
    itemId: string;
    policyRuleId: string;
    documentTypeLabelKey: string;
    expiredOnDate: string;        // YYYY-MM-DD in jurisdiction TZ
    jurisdictionTz: string;
    deepLinkPath: string;
  }>;
}

export interface EligibilityResult {
  blocked: boolean;
  wouldBlock: boolean;            // true when flag is OFF and there ARE reasons
  contractorReasons: ContractorReason[];
}

export async function assertContractorPaymentEligibility(
  contractorIds: string[],
  opts: { tx?: TxClient; throwOnFail?: boolean; flagEnabled?: boolean } = {},
): Promise<EligibilityResult> {
  const { tx, throwOnFail = true, flagEnabled } = opts;
  const db = tx ?? prisma;
  const items = await db.contractorComplianceItem.findMany({
    where: {
      contractorId: { in: contractorIds },
      severity: 'BLOCKING',
      status: 'EXPIRED',
    },
    include: { contractor: { select: { displayName: true } } },
  });
  const reasons = groupByContractor(items);
  const enforce = flagEnabled ?? isPaymentBlockEnforced();
  const blocked = enforce && reasons.length > 0;
  const wouldBlock = !enforce && reasons.length > 0;
  if (blocked && throwOnFail) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Compliance EXPIRED — payment blocked',
      cause: { contractorReasons: reasons },
    });
  }
  if (wouldBlock) {
    log.warn({ event: 'compliance.payment.would_block', contractorIds, reasonCount: reasons.length }, 'Payment would block (flag off)');
    await writeAuditLog({ action: 'compliance.payment.would_block', ... });
  }
  return { blocked, wouldBlock, contractorReasons: reasons };
}
```

**Why this signature:** mirrors Phase 71's `recreateComplianceAssessment(tx, ...)` shape — accepts an active tx OR creates one — so the helper is callable both as a top-level guard (paymentRun.create) and inside a transaction (paymentRun.export at TOCTOU re-check).

---

## New: `packages/api/src/services/approval-engine/operators/registry.ts`

**Analog:** `packages/feature-flags/src/registry.ts:1-200` (typed-const registry pattern from Phase 70 D-02); `packages/classification/src/registry.ts:registerProfile` style.

**Pattern excerpt — module-load self-registration:**
```ts
// packages/feature-flags/src/registry.ts pattern:
const flagDefinitions: Record<string, FlagDef> = {};
export function defineFlag<K extends string>(key: K, def: FlagDef<K>): void {
  flagDefinitions[key] = def;
}

// Phase 72 operator registry — same module-load shape:
import type { Prisma, PrismaClient } from '@contractor-ops/db';
type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export interface OperatorContext {
  tx: TxClient;
  contractorId: string;
  organizationId: string;
  invoice?: { totalMinor: number; contractorType?: string };  // legacy compat
}

export type ConditionEvaluator<TArgs = unknown> = (args: TArgs, ctx: OperatorContext) => Promise<boolean>;

const operators = new Map<string, ConditionEvaluator>();

export function registerOperator<TArgs>(name: string, evaluator: ConditionEvaluator<TArgs>): void {
  if (operators.has(name)) throw new Error(`Operator already registered: ${name}`);
  operators.set(name, evaluator as ConditionEvaluator);
}

export async function evaluateOperator(name: string, args: unknown, ctx: OperatorContext): Promise<boolean> {
  const evaluator = operators.get(name);
  if (!evaluator) throw new Error(`Unknown operator: ${name}`);
  return evaluator(args, ctx);
}

export function getRegisteredOperators(): string[] {
  return Array.from(operators.keys());
}
```

**Test pattern:** `packages/api/src/services/__tests__/approval-engine-operator-registry.test.ts` asserts `getRegisteredOperators()` includes `'complianceCritical'` after barrel-import side-effect.

---

## New: `packages/api/src/services/approval-engine/operators/compliance-critical.ts`

**Analog:** `packages/api/src/services/approval-engine.ts:63-110` (existing `evaluateConditions` operator-style logic).

**Pattern excerpt:**
```ts
import { registerOperator } from './registry.js';

interface ComplianceCriticalArgs {
  status: 'EXPIRED' | 'MISSING';
}

registerOperator<ComplianceCriticalArgs>('complianceCritical', async (args, ctx) => {
  const blocking = await ctx.tx.contractorComplianceItem.findFirst({
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

---

## Modified: `packages/api/src/services/approval-engine.ts`

**Analog (this file's existing shape):** `packages/api/src/services/approval-engine.ts:63-110` (`evaluateConditions`); `packages/api/src/services/approval-engine.ts:241-296` (`advanceFlow`).

**Phase 72 changes:**
1. Top-of-file barrel-import side effect: `import './approval-engine/operators/index.js';`
2. `evaluateConditions` becomes a dual-path parser (legacy `{ field, operator, value }` AND new `{ operator, args }`):
   ```ts
   export async function evaluateConditions(
     conditionsJson: unknown,
     ctx: OperatorContext,
   ): Promise<boolean> {
     const conditions = parseDualPathConditions(conditionsJson);
     if (conditions.length === 0) return false;
     const results = await Promise.all(conditions.map(c => evaluateOperator(c.operator, c.args, ctx)));
     return results.every(Boolean);
   }
   ```
3. `advanceFlow` adds compliance-hold short-circuit: BEFORE marking the flow APPROVED on final-step completion, evaluate `complianceCritical(EXPIRED)` against the resource's contractor; if TRUE, transition `status = 'PENDING_COMPLIANCE'` + write `complianceHoldsJson = { itemIds, heldAt, heldByOperator: 'complianceCritical' }`. The existing `if (!nextStep)` block (line 264) gains this gate.

---

## New: `packages/api/src/services/compliance-recovery.ts`

**Analog:** `packages/api/src/services/compliance-supersession.ts` (Phase 71 — same in-tx mutation pattern); `packages/api/src/services/economic-dependency-scan.ts:230-237` (upsert-with-version pattern).

**Pattern excerpt — JSONB containment query via `$queryRaw`:**
```ts
const heldFlows = await tx.$queryRaw<Array<{ id: string }>>`
  SELECT id FROM "ApprovalFlow"
  WHERE "status" = 'PENDING_COMPLIANCE'
    AND "organizationId" = ${organizationId}
    AND "complianceHoldsJson" @> ${JSON.stringify({ itemIds: [itemId] })}::jsonb
`;
```

`Prisma.sql` template tag escapes parameters; cast the JSON literal explicitly to `jsonb`. The GIN index on `complianceHoldsJson` (Migration B custom SQL) makes this efficient.

---

## Modified: `packages/api/src/routers/payment.ts`

**Analog (this file's existing shape):** lines 343-465 (`paymentRun.create`); lines 660-740 (`paymentRun.export`).

**Phase 72 changes:**
1. `paymentRun.create`: after the input-validation step but before `idempotencyCache.set(...)` PENDING reservation, call `await assertContractorPaymentEligibility(distinctContractorIds, { flagEnabled: ... });` — throws on block.
2. `paymentRun.export`: re-asserts eligibility INSIDE the existing `$transaction`, writes `PaymentRunComplianceCheck` PASS rows BEFORE generating the file content, sequences as: `assert → check rows (PASS) → generate file → PaymentExport row → return`. On TOCTOU FAIL: catch the assertion throw, write FAIL-verdict rows in a SEPARATE small tx outside the rolled-back parent tx (per D-19), re-throw to the client.

---

## Modified: `packages/api/src/routers/classification.ts`

**Analog (this file's existing shape):** lines 841-880 (`classificationEscalationEvent` synchronous side-effect pattern).

**Phase 72 changes:** the `submit` mutation and `recreateComplianceAssessment` paths each gain calls to:
- `await onComplianceItemSatisfied(tx, { itemId, contractorId, organizationId })` — when item flips to SATISFIED
- `await onComplianceItemExpiresAtChanged(tx, { itemId })` — when `expiresAt` changes (renewal)

Both calls live inside the same `tx` as the originating item write. NO event-bus indirection — direct service-layer call (matches the existing `classificationEscalationEvent.create` synchronous pattern in this file).

---

## New: `packages/api/src/routers/approval.ts` mutation `resumeFromCompliance`

**Analog:** `packages/api/src/routers/approval.ts:700-734` (`approve` mutation — `tenantProcedure` + permission middleware + `$transaction`).

**Pattern excerpt — manual escape-hatch admin mutation:**
```ts
resumeFromCompliance: tenantProcedure
  .use(requirePermission({ approval: ['override'] }))
  .input(z.object({ approvalFlowId: z.string().cuid(), reason: z.string().min(1).max(500) }))
  .mutation(async ({ ctx, input }) => {
    return await ctx.db.$transaction(async tx => {
      const flow = await tx.approvalFlow.findUniqueOrThrow({ where: { id: input.approvalFlowId } });
      if (flow.status !== 'PENDING_COMPLIANCE') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Flow is not in PENDING_COMPLIANCE' });
      }
      // Re-assert eligibility (no throw — manual override path):
      const eligibility = await assertContractorPaymentEligibility([flow.resourceId /* contractorId from resource */], { tx, throwOnFail: false });
      if (eligibility.blocked) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Still blocked', cause: { contractorReasons: eligibility.contractorReasons } });
      }
      await tx.approvalFlow.update({
        where: { id: input.approvalFlowId },
        data: { status: 'PENDING', complianceHoldsJson: null },
      });
      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user.id,
          action: 'approval.compliance_resolved',
          resourceType: 'INVOICE',
          resourceId: flow.resourceId,
          metadataJson: { manualOverride: true, reason: input.reason },
        },
      });
      return { resumed: true };
    });
  })
```

---

## Modified: `apps/web/src/app/api/cron/reminders/route.ts`

**Analog (this file's existing shape):** lines 388-436 (cron-route GET handler with `Promise.all` of three sub-orchestrators).

**Phase 72 change:** add `runComplianceReminderScan` (imported from `@contractor-ops/api/services/compliance-reminder-scan`) as the FOURTH item in the `Promise.all`. Wrap its call in a try/catch that swallows the throw and returns `{ scanned: 0, fires: 0, digests: 0 }` so it cannot fail the other three orchestrators. Update the cron's logger output + `metrics.gauge` to include the new counts.

---

## New: `apps/web/src/components/payment/payment-block-modal.tsx`

**Analog:** `apps/web/src/components/contractors/classification/drv-clearance/drv-clearance-panel.tsx` (existing structured-error display with deep links); `apps/web/src/components/billing/top-up-dialog.tsx` (existing modal shape).

**Pattern excerpt — collapsible per-contractor reason sections:**
```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Link } from '@/components/ui/link';

interface PaymentBlockModalProps {
  contractorReasons: Array<ContractorReason>;
  onClose: () => void;
}

export function PaymentBlockModal({ contractorReasons, onClose }: PaymentBlockModalProps) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compliance EXPIRED — payment blocked</DialogTitle>
        </DialogHeader>
        <Alert variant="destructive">
          <AlertTitle>{contractorReasons.length} contractor(s) blocked</AlertTitle>
          <AlertDescription>Renew the listed documents before retrying.</AlertDescription>
        </Alert>
        <Accordion type="multiple">
          {contractorReasons.map(c => (
            <AccordionItem key={c.contractorId} value={c.contractorId}>
              <AccordionTrigger>{c.contractorName}</AccordionTrigger>
              <AccordionContent>
                <ul>
                  {c.reasons.map(r => (
                    <li key={r.itemId}>
                      <Link href={r.deepLinkPath}>{t(r.documentTypeLabelKey)}</Link>
                      — expired on {r.expiredOnDate} ({r.jurisdictionTz})
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}
```

i18n: keys `compliance.paymentBlockModal.title`, `compliance.documentType.<labelKey>` resolve via existing `next-intl` `useTranslations` hook. Plan 72-07 ships en/de/pl key files.

---

## New: `packages/lint-guards/src/compliance-payment-gate-presence.ts`

**Analog:** existing `packages/lint-guards/src/*` rules from Phase 70.

**Pattern excerpt:**
```ts
// AST walker / regex hybrid — match Phase 70 lint-guards style
const PAYMENT_WRITE_PROCEDURES = new Set([
  'paymentRun.create',
  'paymentRun.addItems',
  'paymentRun.updateItems',
  'paymentRun.export',
]);
// For each .ts file under packages/api/src/routers/payment.ts:
//   parse procedure definitions; for each whose name is in PAYMENT_WRITE_PROCEDURES:
//     assert the procedure body source contains 'assertContractorPaymentEligibility('
//   fail CI with file:line if any are missing
```

---

## New: `packages/feature-flags/src/signoff-registry-flags.json` entry

**Analog:** existing `compliance-policy-engine.*` entries (lines 6-58 of the JSON file).

**Phase 72 entry:**
```json
{
  "compliance-payment-block": {
    "status": "PENDING",
    "notes": "F1 Compliance hard payment-block at every payment-write entry point. Legal-sensitive — admin lockout posture per ROADMAP Phase 72. Engineers develop with FLAG_SIGNOFF_BYPASS=local; legal review deferred per Standing Constraint."
  }
}
```

The `compliance-payment-block` key matches the `compliance-` namespace prefix from `GATED_FLAG_NAMESPACE_PREFIXES` (`signoff-registry-flags.ts:39-44`), so the boot-gate enforces this entry's presence.

---

## PATTERN MAPPING COMPLETE
