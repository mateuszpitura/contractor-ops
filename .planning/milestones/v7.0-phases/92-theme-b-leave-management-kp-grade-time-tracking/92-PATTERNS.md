# Phase 92: Theme B — Leave Management + KP-Grade Time Tracking - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** ~42 new/modified files (8 Prisma models across 4 schema files, 1 trigger migration, 2 db-config edits, 2 new + 6 edited compliance-policy modules, 3 new tRPC routers + 5 router/engine edits, 4 new API services, 1 cron sub-job, ~12 web-vite surfaces, 3 validator files, 4 i18n files, cross-org + service tests)
**Analogs found:** 40 / 42 (exact or role-match) — only the team-calendar grid and the `PublicHoliday` global reference table are partial (idiom-only) analogs

> Every code fact below was read directly (paths + line numbers verified this session). CONTEXT `<canonical_refs>` and RESEARCH `Pattern N` are the upstream authority; this file resolves each to a concrete excerpt the planner copies from.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|-------------------|------|-----------|----------------|-------|
| `packages/db/prisma/schema/leave.prisma` (NEW) | prisma model | CRUD + append-only ledger | `worker.prisma` header + `approval.prisma` index shape + `time-tracking.prisma` `@@unique` | role-match |
| `packages/db/prisma/schema/employee-time.prisma` (NEW) | prisma model | CRUD (daily grain) | `time-tracking.prisma:29` `TimeEntry` **minus** contractor/contract FK | exact-shape |
| `packages/db/prisma/schema/ewidencja.prisma` (NEW) | prisma model | append-only snapshot | `audit.prisma:9` `AuditLog` + `tax-form.service` `TaxFormSubmission` (ACTIVE/SUPERSEDED) | role-match |
| `packages/db/prisma/schema/reference.prisma` (NEW/extend) | prisma model | global seeded reference | `tenant.ts:55` global `BoEBaseRateHistory` / `ExchangeRate` | partial (idiom) |
| `migrations/…_ewidencja_append_only/migration.sql` (NEW) | migration (DDL) | trigger + RLS | `migrations/20260617000000_auditlog_append_only/migration.sql` | exact |
| `packages/db/src/tenant.ts` (MODIFY) | infra/config | tenancy | self — `APPEND_ONLY_MODELS:34` + `globalModels:42` | exact |
| `packages/db/src/retention-policy.ts` (MODIFY) | config | retention | self — `RETENTION_YEARS:13` + `MODEL_RETENTION_TYPE:29` | exact |
| `packages/compliance-policy/src/leave-registry.ts` (NEW) | registry/service | register-on-import | `compliance-policy/src/registry.ts:15` | exact |
| `packages/compliance-policy/src/wt-registry.ts` (NEW) | registry/service | register-on-import | `compliance-policy/src/registry.ts:15` | exact |
| `packages/compliance-policy/src/types.ts` (MODIFY) | types | — | self — `PolicyRule` interface `:46` | exact |
| `packages/compliance-policy/src/index.ts` (MODIFY) | barrel | — | self — `:7` side-effect imports + re-exports | exact |
| `packages/compliance-policy/src/policies/{pl,de,uk,us,uae,ksa}.ts` (MODIFY ×6) | policy rule module | register-on-import | `policies/pl.ts:9` `registerPolicyRule(...)` | exact |
| `packages/validators/src/approval.ts` (MODIFY) | validator | — | self — `approvalResourceTypeEnum:23` | exact |
| `packages/validators/src/leave.ts` (NEW) | validator | — | `validators/src/approval.ts` (enum mirror + zod schemas) | role-match |
| `packages/validators/src/employee-time.ts` (NEW) | validator | — | `validators/src/approval.ts` | role-match |
| `packages/db/prisma/schema/approval.prisma` (MODIFY) | prisma enum | — | self — `ApprovalResourceType:106` | exact |
| `packages/db/prisma/schema/contract.prisma` (MODIFY) | prisma enum | — | self — `EntityType:280` | exact |
| `packages/api/src/routers/workforce/leave.ts` (NEW) | tRPC router | request-response + CRUD | `approval-submit.ts:19` `submitForApproval` | exact-seam |
| `packages/api/src/routers/workforce/employee-time.ts` (NEW) | tRPC router | request-response (sync check) | `approval-submit.ts` + `routers/core/time.ts` | role-match |
| `packages/api/src/routers/workforce/ewidencja.ts` (NEW) | tRPC router | request-response | `approval-submit.ts` + ewidencja-builder call | role-match |
| `packages/api/src/services/leave-balance.ts` (NEW) | service | transform / aggregate (Σ ledger) | `tax-form.service.ts` supersede discipline + `leave-registry` resolve | role-match |
| `packages/api/src/services/wt-limit-check.ts` (NEW) | service | synchronous transform | `compliance-reminder-scan.ts:48` `bandFor` (pure) + `wt-registry` resolve | role-match |
| `packages/api/src/services/wt-limit-scan.ts` (NEW) | service (cron) | batch / region fan-out | `compliance-reminder-scan.ts:167` `runComplianceReminderScan` + `economic-dependency-scan.ts` twin | exact |
| `packages/api/src/services/ewidencja-builder.ts` (NEW) | service | append-only snapshot | `tax-form.service.ts:108` `buildFormSnapshot` + `:181` `supersedeAndInsert` | exact |
| `packages/api/src/services/approval-engine.ts` (MODIFY) | service | routing | self — `routeToChain` + `createApprovalFlow` (widen resourceType) | exact |
| `packages/api/src/routers/core/approval-shared.ts` (MODIFY) | service | finalize seam | self — `finalizeApprovedInvoice:255` | exact |
| `packages/api/src/routers/core/approval-queue.ts` (MODIFY) | tRPC router | finalize branch | self — `bulkApprove` finalize site `:525-534` (+ single-approve twin) | exact |
| `packages/api/src/services/notification-service.ts` (MODIFY) | service | routing table | self — `ENTITY_ROUTES:52` | exact |
| `packages/api/src/root.ts` (MODIFY) | router mount | — | self — `workforceRouters:175` | exact |
| `apps/cron-worker/src/jobs/handlers/reminders/wt-limit-scan.ts` (NEW) | cron handler sub-job | batch | `reminders/index.ts:401` `executeComplianceReminderScan()` wiring + `drv-clearance-expiries.ts` | exact |
| `apps/web-vite/src/components/leave/hooks/use-leave-queue.ts` (NEW) | hook (sole tRPC boundary) | request-response | `approvals/hooks/use-approval-queue.ts` | exact |
| `apps/web-vite/src/components/leave/*` (queue section, NEW) | container/component | presentational | `approvals/approval-queue/*` | exact (extend) |
| `apps/web-vite/src/components/leave/team-calendar/*` (NEW) | component | presentational | `contractors/insights/proportion-bar.tsx` `color-mix` idiom | partial (idiom) |
| `apps/web-vite/src/components/employee-time/*` (NEW) | container/component/hook | request-response | `time/single-entry-form.tsx` + `time/time-summary-stats.tsx` | role-match |
| `apps/web-vite/src/components/employee-time/ewidencja/*` (NEW) | component | presentational | `@contractor-ops/ui` `DataTable` + badge | role-match |
| `apps/web-vite/messages/{en,de,pl,ar}.json` (MODIFY ×4) | i18n | — | existing `Approvals` / `Time` namespaces | exact |
| `packages/api/src/__tests__/leave-time-cross-org-leak.test.ts` (NEW) | test | — | `packages/api/src/__tests__/employee-cross-org-leak.test.ts` | exact |
| `packages/db/src/__tests__/ewidencja-immutable.test.ts` (NEW) | test | — | (DB trigger test; mirror auditlog immutability) | role-match |

---

## Pattern Assignments

### `packages/db/prisma/schema/leave.prisma` (prisma model, CRUD + append-only ledger)

**Analogs:** `worker.prisma` (tenant-owning doc + index), `approval.prisma:3-19` (`ApprovalChainConfig` org-config shape for `LeaveType`/`BlackoutPeriod`), `time-tracking.prisma:22-26` (`@@unique`/`@@index` convention).

**Tenant-owning model header to copy** (`worker.prisma:17-37` — carries `organizationId`, `@@index([organizationId])`, and is deliberately ABSENT from `globalModels`):
```prisma
model Worker {
  id             String     @id @default(cuid())
  organizationId String
  ...
  organization    Organization     @relation(fields: [organizationId], references: [id])
  @@index([organizationId])
  @@index([organizationId, workerType])
}
```
Every leave model (`LeaveType`, `LeaveRequest`, `LeaveLedgerEntry`, `LeaveBalance`, `BlackoutPeriod`) follows this: `organizationId` column + `organization` relation + `@@index([organizationId, …])`. RESEARCH Pattern 4 gives the exact `LeaveLedgerEntry` shape (signed `minutes`, `entryType LeaveLedgerType`, `effectiveDate @db.Date`, `sourceRef`, `reason`).

**Index/unique convention** (`time-tracking.prisma:49-53`):
```prisma
  @@unique([organizationId, contractorId, source, externalId])
  @@index([organizationId])
  @@index([organizationId, contractorId, entryDate])
```
Leave ledger → `@@index([organizationId, workerId, leaveTypeId, effectiveDate])`; `LeaveBalance` cache → `@@unique([organizationId, workerId, leaveTypeId, year])`.

---

### `packages/db/prisma/schema/employee-time.prisma` (prisma model, daily grain)

**Analog:** `time-tracking.prisma:29-54` `TimeEntry` — copy the shape, **DROP** `timesheetId` / `contractorId` / `contractId` FKs (the collision — D-04), swap in `workerId`.

**What NOT to reuse** — `TimeEntry` is contractor-hard-coupled with a taken unique:
```prisma
model TimeEntry {
  ...
  timesheetId    String
  contractorId   String     // ← drop
  contractId     String     // ← drop
  source         TimeEntrySource @default(MANUAL)   // ← name TAKEN; use EmployeeTimeSource
  @@unique([organizationId, contractorId, source, externalId])   // ← taken shape
}
enum TimeEntrySource { MANUAL CLOCKIFY JIRA }   // ← name TAKEN
```
New model: `@@unique([organizationId, workerId, workDate])`, `source EmployeeTimeSource`, `enum EmployeeTimeSource { MANUAL IMPORTED }`, `enum AbsenceKind {…}`. Full column list (OT split, night, weekend/holiday, on-call, `wtOptOut`) in RESEARCH Pattern 3.

---

### `packages/db/prisma/schema/ewidencja.prisma` + append-only migration (prisma model, append-only snapshot)

**Analog for the immutable table + trigger:** `packages/db/prisma/schema/audit.prisma:9` (the ONLY existing trigger-enforced append-only store) and the migration that hardens it.

**Trigger + RLS to mirror** (`migrations/20260617000000_auditlog_append_only/migration.sql:33-62`):
```sql
create or replace function app.reject_auditlog_update()
returns trigger language plpgsql as $$
begin
  raise exception 'AuditLog is append-only: UPDATE is not permitted'
    using errcode = 'restrict_violation';
end;
$$;
create trigger auditlog_no_update
  before update on "AuditLog"
  for each row execute function app.reject_auditlog_update();

create policy auditlog_insert on "AuditLog"
  for insert with check (app.org_match("organizationId") and app.can_write_ops());
create policy auditlog_delete on "AuditLog"
  for delete using (
    app.org_match("organizationId") and app.can_write_ops() and app.audit_purge_allowed()
  );
```
Rename to `reject_ewidencja_update` / `ewidencja_no_update` / `ewidencja_insert` / `ewidencja_delete`. **RESEARCH Open Q2 (must resolve in plan):** a strict "reject all UPDATE" trigger also blocks the `updateMany` supersede flip (see next section). Resolve by either (a) INSERT-only "latest ACTIVE wins by `createdAt`" — never UPDATE, or (b) scope the trigger to reject only content columns (`snapshotJson`, `periodKey`) while allowing one-way `status: ACTIVE→SUPERSEDED`.

**Snapshot content builder** — mirror `tax-form.service.ts` `buildFormSnapshot` + `supersedeAndInsert` (see ewidencja-builder assignment below). `TaxFormSubmission` already models the `status: 'ACTIVE' | 'SUPERSEDED'` supersede chain (`tax-form.service.ts:198-206`).

---

### `packages/db/src/tenant.ts` (MODIFY — infra/config)

**Analog:** self. Two edits, both narrow.

1. Add the ledger to `APPEND_ONLY_MODELS` (`tenant.ts:34`) — blocks `update/updateMany/upsert` at the app layer (the `ClassificationDocument` precedent; RESEARCH Alternatives + Pattern 4):
```typescript
const APPEND_ONLY_MODELS = new Set(['ClassificationDocument']);   // + 'LeaveLedgerEntry'
```
2. Add ONLY `PublicHoliday` to `globalModels` (`tenant.ts:42-68`) — it has no `organizationId`. **All leave/time/ewidencja tenant models stay OUT** so they inherit `withTenantScope` (the cross-org invariant; the enforcement is `applyTenantScope` at `:117-131`):
```typescript
const globalModels = new Set([
  'User', 'Session', ... 'BoEBaseRateHistory', 'ExchangeRate', ...   // + 'PublicHoliday'
]);
```

---

### `packages/db/src/retention-policy.ts` (MODIFY — config)

**Analog:** self (`:13` invites new record types; `:29` maps model→type). Two edits per D-06:
```typescript
export const RETENTION_YEARS = {
  '1099-NEC': 4,
  'backup-withholding': 7,
  // + 'KP-ewidencja': 3,
} as const;

export const MODEL_RETENTION_TYPE: Partial<Record<string, RetainedRecordType>> = {
  Form1099Nec: '1099-NEC',
  // + EwidencjaSnapshot: 'KP-ewidencja',
};
```
**RESEARCH Open Q1 (escalate before locking purge):** dokumentacja pracownicza is 10 yr (KP §94⁴); treat 3 as the immutability/claim-limitation floor, do NOT auto-purge at 3.

---

### `packages/compliance-policy/src/leave-registry.ts` + `wt-registry.ts` (NEW — register-on-import)

**Analog:** `packages/compliance-policy/src/registry.ts:15-43` — module-level array + `Set` of ids, a `register*` that `deepFreeze`s and throws on duplicate, a pure `resolve*(jurisdiction)` filter, a `list*()` for tests. **D-02: NEW typed registries — do NOT extend `PolicyRule`** (it is document-centric; leave/WT have no document).

**Registry skeleton to copy** (`registry.ts:6-43`):
```typescript
const REGISTRY: PolicyRule[] = [];
const REGISTERED_IDS = new Set<PolicyRuleId>();

export function registerPolicyRule(rule: PolicyRule): void {
  if (!POLICY_RULE_ID_RE.test(rule.policyRuleId)) throw new Error(`Malformed …`);
  if (REGISTERED_IDS.has(rule.policyRuleId)) throw new Error(`Duplicate …`);
  REGISTERED_IDS.add(rule.policyRuleId);
  REGISTRY.push(deepFreeze(rule));
}
export function resolvePolicyRules(ctx: EngagementContext): readonly PolicyRule[] {
  return REGISTRY.filter(r => r.jurisdiction === ctx.jurisdiction && r.appliesIf(ctx));
}
export function listPolicyRules(): readonly PolicyRule[] { return REGISTRY; }
```
`resolveLeaveAccrual(jurisdiction, leaveKind)` / `resolveWtLimits(jurisdiction)` filter on `Jurisdiction` (`types.ts:6` — `'UK'|'DE'|'PL'|'US'|'KSA'|'UAE'`). New interfaces `LeaveAccrualRule` / `WorkingTimeLimitRule` go in `types.ts` next to `PolicyRule` (`types.ts:46-72`) — full field lists in RESEARCH Pattern 2.

---

### `packages/compliance-policy/src/policies/{pl,de,uk,us,uae,ksa}.ts` (MODIFY ×6 — register-on-import)

**Analog:** `policies/pl.ts:9-51` — each module calls `registerPolicyRule(...)` at import time (side effect; wired via `index.ts:7`). Add `registerLeaveAccrualRule(...)` + `registerWorkingTimeLimit(...)` alongside.

**Rule-object convention to copy** (`policies/pl.ts:9-21` — note the `draftLegalText` "PENDING legal review" annotation, mandatory per constraint 8):
```typescript
registerPolicyRule({
  policyRuleId: 'pl.zus_a1@v1',
  jurisdiction: 'PL',
  ...
  draftLegalText:
    'Issued by ZUS via the RUS-3 form; …  (ZUS / EU Reg 883/2004 Art 12; PENDING legal review)',
  expirySemantic: 'fixed_months',
  expiryMonths: 12,
});
```
RESEARCH `Code Examples` gives the exact PL `registerLeaveAccrualRule` + `registerWorkingTimeLimit` calls with cited statutory values (KP art. 154/129/131/151); RESEARCH `Statutory Rule Values` enumerates PL/DE/UK/US/UAE/KSA — each carries a `[CITED]` or `[ASSUMED, adviser-verify]` tag to mirror into `draftLegalText`.

**index.ts (MODIFY):** side-effect imports already present (`index.ts:7-12`); add the new registry re-exports next to the `registry.ts` block (`index.ts:47-52`).

---

### `packages/api/src/routers/workforce/leave.ts` (NEW — tRPC router, request-response + CRUD)

**Analog:** `packages/api/src/routers/core/approval-submit.ts:19-133` `submitForApproval` — the invoice submit seam. The NEW `submitLeaveRequest` mirrors it structurally: transaction → validate resource → route to chain → `createApprovalFlow` → set status → post-commit dispatch.

**Submit seam to mirror** (`approval-submit.ts:22-76`):
```typescript
const flow = await ctx.db.$transaction(async tx => {
  const invoice = await findOrThrow(() => tx.invoice.findFirst({ where: { id, organizationId: ctx.organizationId, deletedAt: null } }), E.INVOICE_NOT_FOUND);
  // ... precondition checks (matchStatus / already-pending) ...
  const chainConfig = await routeToChain(tx as TxClient, ctx.organizationId, { totalMinor: invoice.totalMinor });
  if (!chainConfig) throw new TRPCError({ code: 'BAD_REQUEST', message: E.APPROVAL_NO_CHAIN_CONFIGURED });
  const approvalFlow = await createApprovalFlow(tx as TxClient, {
    organizationId: ctx.organizationId,
    resourceType: 'INVOICE',          // ← LEAVE_REQUEST here
    resourceId: invoice.id,
    chainConfig,
    createdByUserId: ctx.user?.id,
  });
  await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'APPROVAL_PENDING' } });
  return { approvalFlow, invoice };
});
```
`submitLeaveRequest`: validate `LeaveRequest` + blackout overlap + sufficient balance (via `leave-balance.ts`), call NEW `routeToLeaveChain`, `createApprovalFlow({ resourceType: 'LEAVE_REQUEST' })`, set `LeaveRequest.status='PENDING'`.

**Auth + tenancy idiom** (`approval-submit.ts:19-21`): `tenantProcedure.use(requirePermission({ … })).input(z…)`. Leave uses the P89 HR roles (`hr_admin`/`hr_manager`/`leave_approver`) — RESEARCH Security V4.

**`recordSickAbsence` (D-03 1c — DIRECT, no chain):** write a `LeaveLedgerEntry` directly + `writeAuditLog` + `dispatch` a NOTIFICATION (never `APPROVAL_REQUEST`, never `createApprovalFlow`). Contrast the invoice path's `dispatch({ type: 'APPROVAL_REQUEST', … })` at `approval-submit.ts:95-116` — sick uses a plain notification type.

**Flag gate:** call `assertWorkforceEnabled(ctx.organizationId, ctx.region)` at the top of every procedure (see Shared Patterns).

---

### `packages/api/src/services/approval-engine.ts` (MODIFY) + `approval-shared.ts` (MODIFY) + `approval-queue.ts` (MODIFY) — the two invoice-coupled seams

**RESEARCH Pattern 1 (verified):** the Flow/Step/Decision engine is generic; invoice coupling is isolated to exactly TWO seams. Add a `LEAVE_REQUEST` branch, do not fork the engine.

**Seam 1 — finalize.** Analog `finalizeApprovedInvoice` (`approval-shared.ts:255-296`):
```typescript
export async function finalizeApprovedInvoice(tx: TxClient, opts: { resourceId; organizationId; db; userId }) {
  await tx.invoice.update({ where: { id: opts.resourceId }, data: { status: 'APPROVED', paymentStatus: 'READY', readyForPaymentAt: new Date() } });
  // ... syncPaymentDueDeadline ...
}
```
Add a sibling `finalizeApprovedLeave(tx, opts)`: set `LeaveRequest.status='APPROVED'`, insert `LeaveLedgerEntry(DEDUCTION)`, update `LeaveBalance` cache in the SAME tx, `writeAuditLog`, optional `EmployeeProfile.employmentStatus`.

**Seam 2 — branch at the two `advanceResult.completed` call sites.** Analog `bulkApprove` (`approval-queue.ts:525-534`) and its single-approve twin:
```typescript
const advanceResult = await advanceFlow(tx, step.approvalFlowId);
if (advanceResult.completed) {
  await finalizeApprovedInvoice(tx, { resourceId: step.approvalFlow.resourceId, organizationId: ctx.organizationId, db: ctx.db, userId: ctx.user?.id });
}
```
Becomes (RESEARCH Code Examples):
```typescript
if (advanceResult.completed) {
  if (step.approvalFlow.resourceType === 'LEAVE_REQUEST') {
    await finalizeApprovedLeave(tx, { … });
  } else {
    await finalizeApprovedInvoice(tx, { … });
  }
}
```
`step.approvalFlow.resourceType` is already selected (the `include: { approvalFlow: true }` at `approval-shared.ts:323`). **bulkReject** (`approval-queue.ts:571-574`) writes `tx.invoice.update(... status:'REJECTED')` — add a leave branch there too (set `LeaveRequest.status='REJECTED'`, no ledger deduction).

**`routeToChain` / `createApprovalFlow` (approval-engine.ts):** `createApprovalFlow`'s `resourceType: 'INVOICE'` literal type must be WIDENED to accept `'LEAVE_REQUEST'` (Pitfall 1 warning sign — TS flags it). Add `routeToLeaveChain` querying `ApprovalChainConfig where resourceType='LEAVE_REQUEST'`. **Verified safe:** `checkComplianceHoldAtFinalStep` already returns `null` for `resourceType !== 'INVOICE'` (`approval-engine.ts:336`), so leave flows never hit the contractor-compliance hold.

---

### `packages/api/src/services/ewidencja-builder.ts` (NEW — append-only snapshot)

**Analog:** `packages/api/src/services/tax-form.service.ts` — `buildFormSnapshot` (`:108-128`) freezes captured content into `snapshotJson`; `supersedeAndInsert` (`:181-223`) flips prior ACTIVE→SUPERSEDED then inserts the new ACTIVE row.

**Supersede discipline to mirror** (`tax-form.service.ts:198-222`):
```typescript
await tx.taxFormSubmission.updateMany({
  where: { organizationId, contractorId, formType, status: 'ACTIVE' },
  data: { status: 'SUPERSEDED' },
});
return tx.taxFormSubmission.create({
  data: { organizationId, contractorId, formType, status: 'ACTIVE', snapshotJson: snapshot, … },
});
```
`buildEwidencjaSnapshot(worker, period)` assembles the KP §149 field set (RESEARCH Statutory PL — hours+start/end, night, OT, days-off-with-type, dyżur place, zwolnienia, absences) from Σ `EmployeeTimeRecord` + leave, freezes to JSON, then `supersedeAndInsertEwidencja` keyed on `(organizationId, workerId, periodKey, status='ACTIVE')`. **Reconcile the supersede `updateMany` with the append-only trigger — RESEARCH Open Q2** (see ewidencja.prisma above).

---

### `packages/api/src/services/wt-limit-check.ts` (NEW — synchronous transform) + `wt-limit-scan.ts` (NEW — batch/region fan-out)

**`wt-limit-check.ts` analog:** the pure band-classifier `bandFor` (`compliance-reminder-scan.ts:48-57`) — a DB-free pure function taking a scalar and returning a band. The synchronous on-save check resolves `resolveWtLimits(jurisdiction)` from `wt-registry` and compares daily-ceiling + current-week heuristic (RESEARCH Pitfall 5: the sync check is the fast heuristic; the scan does the true rolling average).

**`wt-limit-scan.ts` analog:** `runComplianceReminderScan` (`compliance-reminder-scan.ts:167-195`) — the region fan-out entry, and `runComplianceReminderScanForClient` (`:204-249`) — the per-region two-pass worker.

**Region fan-out to copy verbatim** (`:167-195` — Pitfall 3: a tenant-frame-less scan MUST fan out over regions, region-prefix dedup keys):
```typescript
export async function runComplianceReminderScan(now = new Date()): Promise<ScanResult> {
  const total = { scanned: 0, fires: 0, digests: 0 };
  for (const region of SUPPORTED_REGIONS) {
    let client;
    try { client = getRegionalClient(region) as unknown as ReminderScanClient; }
    catch (err) { log.warn({ err, region }, '… region client unavailable; skipping'); continue; }
    const result = await runComplianceReminderScanForClient(client, region, now);
    total.scanned += result.scanned; total.fires += result.fires; total.digests += result.digests;
  }
  return total;
}
```
Two-pass digest (`:239-247`): `collectPendingFires` (pass 1, per-recipient groups) → `dispatchDigests` (pass 2, ONE dedup-gated digest per recipient/day via `claimCronNotificationDedup`). **Do NOT remove the digest layer** — `compliance-reminder-scan.ts:14-17` documents that the flat "one notification per breach" approach was already tried and produced fatigue-grade spam. Logger: `createCronLogger('wt-limit-scan')` (`:37`).

---

### `apps/cron-worker/src/jobs/handlers/reminders/wt-limit-scan.ts` (NEW — cron sub-job)

**Analog:** `reminders/index.ts` — `detectDrvClearanceExpiries()` is the sub-job precedent; `executeComplianceReminderScan()` (`:401`) is wired into the `Promise.all` batch under the advisory lock.

**Wiring to mirror** (`reminders/index.ts:383-402`): add the WT scan to the `Promise.all` (or a new dedicated handler). Note the crash-isolation comment (`:397-400`) — the compliance scan uses its OWN `prismaRaw` connections, NOT the lock-holding tx, because the dedup unique index is the real idempotency guard. Follow the same pattern. Advisory-lock guard `tryAcquireXactLock(tx, 'cron', 'reminders')` (`:367`) already covers the tick.

---

### `apps/web-vite/src/components/leave/hooks/use-leave-queue.ts` (NEW — hook = sole tRPC boundary)

**Analog:** `apps/web-vite/src/components/approvals/hooks/use-approval-queue.ts` — the sole-tRPC-boundary hook (constraint 6; enforced by `check:web-vite-data-layer`).

**Boundary idiom to copy** (`use-approval-queue.ts:54-152`): `useTRPC()` + `useQuery({ ...trpc.<ns>.<proc>.queryOptions(input) })` + `useResourceMutation(trpc.<ns>.<proc>.mutationOptions(), { invalidate, successMessage: t(…), errorMessage: t(…) })`; URL state via `nuqs` (`useQueryState`); returns a `queueSectionProps` / `sidePanelProps` bundle so the container stays presentational. The leave hook swaps `trpc.approval.listPending` → `trpc.leave.listRequests` and adds the balance-after query. **Reuse `use-approval-chain.ts` + `sla-badge`/`chain-tracker` verbatim** — the engine is generic (UI-SPEC S1).

**Queue table reuse (UI-SPEC Component Inventory):** extend the `ApprovalQueueRow` union in `approvals/approval-queue/columns.tsx` so `resourceType==='LEAVE_REQUEST'` rows render leave fields — same `DataTable`, branched cell renderers. Do NOT rebuild the table.

---

### `apps/web-vite/src/components/leave/team-calendar/*` (NEW build — presentational)

**Analog (idiom only — no team-calendar exists):** `contractors/insights/proportion-bar.tsx` — the capacity heatmap band reuses its `flexGrow + backgroundColor` inline-style idiom and the `color-mix(in oklch, var(--status-*) …)` composition (UI-SPEC S2 visual spec).

**Segment/fill idiom to copy** (`proportion-bar.tsx:34-56`):
```tsx
<button type="button" aria-pressed={segment.active ?? false} aria-label={`${segment.label}: ${segment.value}`}
  // biome-ignore lint/nursery/noInlineStyles: runtime proportion + dynamic color
  style={{ flexGrow: segment.value, backgroundColor: segment.color }}
  className={cx('h-full transition-opacity', segment.active ? 'opacity-100' : 'opacity-75 hover:opacity-100')} />
```
Build `TeamCalendarView` / `CalendarMonthGrid` / `CapacityCell` / `ConflictMarker` / `CapacityLegend` from `packages/ui` primitives + a div grid (UI-A2: no third-party calendar block; RTL correctness). Day cell ≥ 44px (UI-SPEC spacing exception). Conflict = `TriangleAlert` icon + text (never color alone).

---

### `apps/web-vite/src/components/employee-time/*` (NEW — form/hook/component)

**Analog:** `time/single-entry-form.tsx` — the day-grain dialog form (Dialog + `DialogBody`/`DialogFooter`, `check:web-vite-dialog-pattern`), and `time/time-summary-stats.tsx` for the 3 KPI cards (UI-SPEC S3 anchor).

**Dialog + form idiom to copy** (`single-entry-form.tsx:139-234`): `DialogContent → DialogHeader → DialogBody(space-y-4) → DialogFooter`; per-field `Label` + control + inline `text-destructive` error; local `useState` + `validate()` + `onSubmit` prop (data flows through the hook, not the form). Extend fields for night/OT/weekend/on-call/absence (RESEARCH Pattern 3). Add the on-save WT warning banner (`WtLimitWarningBanner`) — non-blocking with "Save anyway" (UI-A3). Distinct hook `use-employee-time.ts`; do NOT reuse the contractor `Time.*` tRPC procedures.

---

### `packages/api/src/__tests__/leave-time-cross-org-leak.test.ts` (NEW — test)

**Analog:** `packages/api/src/__tests__/employee-cross-org-leak.test.ts` — proves a tenant-owning model inherits `withTenantScope` over a fake base client.

**Test idiom to mirror** (`employee-cross-org-leak.test.ts:101-138`): seed `rowA`(ORG_A) + `rowB`(ORG_B), run a read for `rowB.id` inside `tenantStore.run({ organizationId: ORG_A_ID, region: 'EU' }, …)`, assert `null` + that the injected `where` contains `organizationId: ORG_A_ID`; assert a cross-org mutation throws `P2025`; assert a no-context call throws `'Tenant context not initialized'`. Mirror once per new tenant model family (leave ledger/request, employee-time, ewidencja).

---

## Shared Patterns

### Feature-flag gate (`module.workforce-employees`)
**Source:** `packages/api/src/middleware/require-workforce-flag.ts:25` (`assertWorkforceEnabled`) + `:51` (`isWorkforceRegistered`); mount at `root.ts:175` (`workforceRouters`).
**Apply to:** every new leave / employee-time / ewidencja router (two-layer defense — constraint 3, RESEARCH Pattern / Security EoP).
```typescript
// per-request guard (top of each procedure):
assertWorkforceEnabled(ctx.organizationId, ctx.region);
// conditional mount (root.ts:175-182 pattern):
const workforceRouters = {
  worker: workerRouter, employee: employeeRouter,
  // + leave: leaveRouter, employeeTime: employeeTimeRouter, ewidencja: ewidencjaRouter,
} as const;
const conditionalWorkforceRouters = isWorkforceRegistered() ? workforceRouters : ({} as typeof workforceRouters);
```

### Audit logging on sensitive mutations
**Source:** `packages/api/src/services/audit-writer.ts:118` (`writeAuditLog`); usage `approval-submit.ts:269-282`.
**Apply to:** leave approve/reject, `recordSickAbsence`, ledger `ADJUSTMENT` (mandatory `reason`), ewidencja generate (constraint 2, RESEARCH Security V7).
```typescript
await writeAuditLog({
  organizationId: ctx.organizationId,
  actorType: 'USER', actorId: ctx.user.id,
  action: 'leave.approved',              // dotted action token
  resourceType: 'LEAVE_REQUEST',         // EntityType — must be added to contract.prisma:280
  resourceId: leaveRequest.id,
  metadata: { … },
  tx,                                    // join the caller's transaction so it rolls back together
});
```

### Notification dispatch + entity route
**Source:** `packages/api/src/services/notification-service.ts:270` (`dispatch`) + `:52` (`ENTITY_ROUTES`); producer example `reminders/index.ts:131-140`.
**Apply to:** leave `APPROVAL_REQUEST` (chain), sick-leave notification, WT-limit alert digest.
- Add to `ENTITY_ROUTES` (`:52`): `LEAVE_REQUEST: '/leave'`, `EMPLOYEE_TIME_RECORD: '/employee-time'` — else `buildEntityUrl` produces no CTA (Pitfall 1/2; UI-SPEC S5).
- Notification `title`/`body` are dotted i18n keys resolved by `resolveEventCopy` (`:292`); pass interpolation via `metadata` (constraint 7). Example dotted-key producer: `reminders/index.ts:222-223` (`'Notifications.reminders.contractExpiring.title'`).

### Two-enum extension for LEAVE_REQUEST (Pitfall 1 — BOTH enums)
**Sources:** `approval.prisma:106` `ApprovalResourceType` (used by `ApprovalChainConfig.resourceType`) AND `contract.prisma:280` `EntityType` (used by `ApprovalFlow.resourceType`, `AuditLog.resourceType`, `NotificationEvent.entityType`) AND `validators/src/approval.ts:23` `approvalResourceTypeEnum` AND `notification-service.ts:52` `ENTITY_ROUTES`. Miss one → runtime enum error or 404 CTA. Add `LEAVE_REQUEST` to all four; add `EMPLOYEE_TIME_RECORD` to `EntityType` + `ENTITY_ROUTES` for time-alert entity refs.

### Statutory adviser-verify annotation
**Source:** `policies/pl.ts:17-18` + `types.ts:58-63` (`draftLegalText` "PENDING legal review").
**Apply to:** every `LeaveAccrualRule` / `WorkingTimeLimitRule` value (constraint 8, local-only posture). Carry the RESEARCH `[CITED]` / `[ASSUMED, adviser-verify]` tag into `draftLegalText`.

---

## No / Partial Analog

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web-vite/src/components/leave/team-calendar/*` | component | presentational | No team-availability calendar exists — every "calendar" asset is Google/Outlook integration config. Build from `packages/ui` primitives; borrow only the `proportion-bar.tsx` `color-mix` band idiom + `composition-strip.tsx`. |
| `packages/db/prisma/schema/reference.prisma` `PublicHoliday` | prisma model | seeded reference | No seeded-holiday table exists. Closest is the shape of other global (no-`organizationId`) rows in `globalModels` (`ExchangeRate`, `BoEBaseRateHistory`, `tenant.ts:55-61`); model as a global reference table + seed rows (RESEARCH Environment Availability — live holiday API is by-design absent). |

Both are genuine new builds flagged in CONTEXT `## Claude's Discretion` — the planner should use RESEARCH patterns (Pattern 6/7) rather than a codebase copy.

---

## Metadata

**Analog search scope:** `packages/db/prisma/schema/`, `packages/db/src/`, `packages/compliance-policy/src/`, `packages/api/src/{routers/core,services,middleware,__tests__}/`, `packages/validators/src/`, `apps/cron-worker/src/jobs/handlers/reminders/`, `apps/web-vite/src/components/{approvals,time,contractors/insights}/`.
**Files read (full or targeted):** 24 source files verified this session (all line numbers above cross-checked against the read output).
**Pattern extraction date:** 2026-07-01
