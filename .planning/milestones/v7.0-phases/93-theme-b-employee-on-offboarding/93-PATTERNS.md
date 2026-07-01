# Phase 93: Theme B — Employee On/Offboarding - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 23 (create + modify)
**Analogs found:** 23 / 23 (this is a reuse-first phase — every file has a same-repo analog)

> Line numbers verified by direct Read at current HEAD (2026-07-01). Phases 87/90/91 execute concurrently — re-confirm with `mcp__semble__search` (repo=`/Users/mateusz.pitura/Repos/projects/contractor-ops`) if HEAD advances before execution. Phase 90 `EmployeeProfile.terminatedAt` is a HARD dependency: plan now, execute after 90 lands.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/db/prisma/schema/idp-deprovisioning.prisma` (M) | model | event-driven | its own `DeprovisioningRun` block :8-29 + `WorkflowRun.contractorId?` (workflow.prisma:111) + `EmployeeProfile.workerId` FK (employee.prisma:18,51) | exact |
| `packages/db/prisma/schema/workflow.prisma` (M) | model | CRUD | `WorkflowRun.contractorId?` :111,132 + `WorkflowTemplate` :4-24 (needs new `@@unique`) | exact |
| `packages/db/prisma/schema/contract.prisma` (M) | model (enum) | — | `EntityType` enum :280-297 | exact |
| `packages/db/prisma/schema/employee.prisma` (M) | model | — | `ContractorAssignment.endedAt` (contractor.prisma:217) | exact |
| `StatutoryCertificate` (NEW model, employee.prisma or new schema) | model | file-I/O | `Form1099Nec` (snapshotJson + pdfArchiveKey pattern, see form-1099-nec-pdf.ts:66-79) | role-match |
| `packages/db/prisma/schema/migrations/__phase93_*/` (NEW) | migration | — | `migrations/__worker_base_additive/` (Phase 89) | exact |
| `packages/validators/src/workflow.ts` (M) | validator | request-response | `startRunSchema` :133-137 | exact |
| `packages/validators/src/legal/disclaimers.ts` (M) | validator (const) | — | `SDS_DISCLAIMER_EN` :28 + `RESERVED_DISCLAIMER_KEYS` :111 + `LOCKED_DISCLAIMERS` :126 | exact |
| `packages/api/src/routers/workflow/workflow-execution-runs.ts` (M) | controller | request-response | its own contractor branch :56-107 | exact |
| `packages/api/src/routers/workflow/workflow-shared.ts` (M) | service (pure-fn) | transform | `resolveAssignee` :134-168 | exact |
| `packages/api/src/routers/integrations/deprovisioning.ts` (M) | controller | event-driven | `startDeprovisioningRun` :202-345 + `resolveAssignmentForContractor` :177-190 + `COUNTRY_TZ` :103-110 | exact |
| `packages/api/src/routers/{workforce\|employee}/employee-lifecycle-router.ts` (NEW) | controller/route | request-response | `deprovisioningRouter` (`integrationProcedure` + Zod + `writeAuditLog`) + workflow-execution-runs.ts `tenantProcedure` + `requirePermission` :38-40 | role-match |
| `packages/api/src/root.ts` (M) | config (router mount) | — | `workforceRouters` const + `conditionalWorkforceRouters` :168-182 | exact |
| `packages/api/src/services/statutory-cert-pdf.ts` (NEW) | service | file-I/O | `form-1099-nec-pdf.ts` (render→CAS→R2, whole file) | exact |
| `packages/api/src/services/{i9-everify,zus-zwua,abmeldung-sv,hmrc-rti,pit-filing}-stub.ts` (NEW) | service | request-response | `elstam-stub.ts` :18-62 | exact |
| `packages/api/src/pdf-templates/{swiadectwo-pracy,arbeitszeugnis,p45,w2}.tsx` (NEW) | component (react-pdf) | transform | `ir35-sds.tsx` :1-70 | exact |
| `packages/api/src/services/post-org-create-hook.ts` (M) | service (boot hook) | batch | its own `runPostOrganizationCreateHooks` :14-28 | exact |
| `packages/employee-templates/src/{seeds,upsert-on-boot,index}.ts` (NEW pkg) | service (seed) | batch | `packages/offboarding-templates/src/{upsert-on-boot.ts,seeds.ts}` | exact (retarget model) |
| `packages/compliance-policy/src/{index,types}.ts` (M) | config (register-on-import) | — | `index.ts` :7-12 register-on-import + `Jurisdiction` types.ts:6 | exact |
| `packages/feature-flags/src/flags-core.ts` (reuse — no change) | config (flag) | — | `module.workforce-employees` :220-228 (already registered) | exact (reuse) |
| `apps/web-vite/src/components/idp/hooks/use-start-deprovisioning.ts` (M/variant) | hook | request-response | its own body :44-125 | exact |
| `apps/web-vite/src/components/idp/deprovisioning-trigger.tsx` (M) | component | request-response | `DeprovisioningTriggerWired` :140-169 | exact |
| `apps/web-vite/src/components/{employees}/…` on/offboarding Page→Container→Hook (NEW) | page/container/hook/component | request-response | workflow-run UI (reuse by runId) + use-start-deprovisioning hook layering | role-match |

---

## Shared Patterns

### Tenant scope (every new read/write)
`Worker` and `EmployeeProfile` are tenant-owning (absent from `globalModels`, inherit `withTenantScope`). Header comments to replicate: worker.prisma:8-10, employee.prisma:7-10. Every Prisma call filters `organizationId: ctx.organizationId` (see deprovisioning.ts:183, workflow-execution-runs.ts:48,61). **New models (`StatutoryCertificate`, per-market template rows) require a two-org cross-leak regression test** (v7.0 standing decision).

### Audit log (sensitive mutations)
**Source:** `packages/api/src/services/audit-writer.ts` (imported at workflow-execution-runs.ts:18, deprovisioning.ts:24).
**Apply to:** worker `startRun`, worker `startDeprovisioningRun`, cert generation, `terminatedAt` write. Structured emit idiom (deprovisioning.ts:318-326):
```typescript
auditLog.info(
  { auditEvent: 'deprovision_run_started', organizationId: ctx.organizationId, userId: ctx.user.id, runId: run.id },
  'Deprovisioning run started',
);
```

### Flag gate (defense-in-depth, already built P89)
**Source:** `packages/api/src/middleware/require-workforce-flag.ts` — `assertWorkforceEnabled(orgId, region)` :25 + `isWorkforceRegistered()` :51. Two layers: (1) conditional `root.ts` spread (`conditionalWorkforceRouters` :180 → METHOD_NOT_FOUND when off); (2) per-request `assertWorkforceEnabled`. Flag `module.workforce-employees` already registered (flags-core.ts:220) — **no new flag needed**; add new lifecycle routers to the existing `workforceRouters` const.

### Logging
`@contractor-ops/logger` only — `createLogger({ service: '…' })` (post-org-create-hook.ts:12, form-1099-nec-pdf.ts:21) or `getIdpAuditLogger()` (deprovisioning.ts:29). **No `console.*`** in app source.

### Prisma migration (drift-blocked posture)
Author each schema edit as an `__`-prefixed **un-applied** dir (`migration.sql` + `down.sql`) — mirror `migrations/__worker_base_additive/` (Phase 89). Run `prisma generate` only (pure codegen); per-region `db:migrate:all` defers to a `[BLOCKING]` human gate. Pair every schema edit with `db:generate` (CI `db:check-drift`). New enum members UPPER_SNAKE (`db:audit-enum-casing`).

### i18n parity + locked disclaimers
User-facing strings via `useTranslations` with en/de/pl/ar (+ en-US) parity. **Exception — cert disclaimers are locked const in `disclaimers.ts` and must be ABSENT from `messages/*.json`** (locked-phrases-guard CI test). PII: cert snapshots carry `*Last4` only (form-1099-nec-pdf.ts:28), never a full national ID — mirror the `buildFormSnapshot` defensive strip (tax-form.service.ts header :11-15).

---

## Pattern Assignments

### `packages/db/prisma/schema/idp-deprovisioning.prisma` (model, event-driven) — THE PHASE SPINE

**Analog:** its own `DeprovisioningRun` block + nullable-FK + relation idiom from `WorkflowRun.contractorId?` (workflow.prisma:111,132) + tenant-owning FK from `EmployeeProfile.worker` (employee.prisma:51).

**Current NON-NULL FKs to make nullable** (:11-12, :20-21):
```prisma
model DeprovisioningRun {
  id                String                  @id @default(cuid())
  organizationId    String
  contractorId      String        // → String?  (DROP NOT NULL, additive ALTER)
  assignmentId      String        // → String?  (DROP NOT NULL)
  ...
  organization    Organization         @relation(fields: [organizationId], references: [id])
  contractor      Contractor           @relation(fields: [contractorId], references: [id])   // → Contractor? …
  assignment      ContractorAssignment @relation(fields: [assignmentId], references: [id])   // → ContractorAssignment? …
  ...
  @@index([organizationId, assignmentId])
}
```
**Add** (mirror the nullable-relation shape used by `WorkflowRun.contractor` workflow.prisma:132 + tenant index shape :144):
```prisma
  workerId  String?
  worker    Worker?  @relation(fields: [workerId], references: [id])
  @@index([organizationId, workerId])
```
**Convention to replicate:** the "exactly one subject" invariant **cannot** be a Prisma relation constraint (Pitfall 3) — enforce in the mutation via discriminated-union input; optionally add a raw `CHECK ((contractorId IS NOT NULL) <> (workerId IS NOT NULL))` in `migration.sql`. `DeprovisioningStep.externalUserId` (:39) is already subject-agnostic — do NOT touch it or the step runner.

---

### `packages/db/prisma/schema/workflow.prisma` (model, CRUD)

**Analog:** `WorkflowRun.contractorId?` (already nullable ✓) :111 + relation :132 + tenant index :144.

**`WorkflowRun` — add worker subject** (mirror :111/:132/:144 exactly):
```prisma
  contractorId         String?     // existing — already nullable ✓
  contractId           String?
  // + workerId  String?
  // + worker    Worker?  @relation(fields: [workerId], references: [id])
  // + @@index([organizationId, workerId])
  entityType           EntityType  // set 'EMPLOYEE' for employee runs
```

**`WorkflowTemplate` — needs a compound unique for idempotent boot upsert** (it has NONE today, :4-24):
```prisma
model WorkflowTemplate {
  ...
  type                WorkflowTemplateType
  appliesToEntityType EntityType
  // + jurisdiction  String?   (nullable — existing org-authored rows stay null)
  // + seedKey       String?   (stable per-market seed identity)
  // + @@unique([organizationId, jurisdiction, type, seedKey])
}
```
**Convention:** seed rows with `status: DRAFT` + `appliesToEntityType: EMPLOYEE` (mirrors `seedStarterTemplates` DRAFT posture). Existing `WorkflowTemplateType` already has `ONBOARDING`/`OFFBOARDING` — seed 8 rows = 4 jurisdictions × 2 types. **Do NOT seed `WorkflowRoleTemplate`/`WorkflowRoleTaskTemplate` (:56/:79)** — that is the KT role registry consumed by `startOffboardingRun`, NOT what `startRun` instantiates.

---

### `packages/db/prisma/schema/contract.prisma` (enum, EntityType)

**Analog:** `EntityType` enum :280-297.
```prisma
enum EntityType {
  ORGANIZATION
  CONTRACTOR
  ...
  USER
  RETURN_REQUEST
  // + EMPLOYEE
  // + WORKER
}
```
**Convention:** UPPER_SNAKE (Pitfall 2 — `db:audit-enum-casing`). Adding `EMPLOYEE`+`WORKER` (vs reusing `USER`) also fixes the P89 workaround where worker audit rows were forced to `resourceType: ORGANIZATION`.

---

### `packages/db/prisma/schema/employee.prisma` (model, dated termination signal)

**Analog:** `ContractorAssignment.endedAt` (contractor.prisma:214-217) — the proven "administrative termination instant, distinct from calendar end, drives the 14-day cooldown" precedent.
```prisma
// contractor.prisma:214-217 — the shape to mirror:
  // Phase 76 D-06 — administrative termination instant; drives the 14-day deprovisioning cooldown.
  endedAt  DateTime?
```
**Add to `EmployeeProfile`** (after :45 `employmentStatus`):
```prisma
  // + terminatedAt  DateTime?   (dated termination signal — feeds the IdP cooldown gate)
```
**Convention (Discretion D-01):** research recommends `terminatedAt` field over an `EmploymentEvent` table for v7.0 (minimal blast radius, zero new join, mirrors `endedAt`); defer `EmploymentEvent` to v7.5 if an audit trail is required. Note `EmploymentStatus.TERMINATED` (:62) already exists but is a bare status, not dated — write `terminatedAt` when transitioning to TERMINATED.

---

### NEW `StatutoryCertificate` model (file-I/O) + migration

**Analog:** `Form1099Nec` (surfaced via form-1099-nec-pdf.ts:66-79 — `snapshotJson: Prisma.JsonValue` + `pdfArchiveKey: string | null` + org scope). Mirror those columns so the immutable-snapshot + CAS double-render guard carries over. Add `organizationId`, `workflowRunId`, `certType`, `status`, `snapshotJson`, `pdfArchiveKey`, tenant index. Link to the run via the existing `WorkflowAttachment`/`Document` rail for UI download. **Two-org cross-leak test required.**

---

### `packages/validators/src/workflow.ts` (validator, request-response)

**Analog:** `startRunSchema` :133-137 (today a flat `z.object` mandating `contractorId`).
```typescript
// CURRENT (:133):
export const startRunSchema = z.object({
  templateId: z.string().min(1),
  contractorId: z.string().min(1),
  contractId: optionalFk,
});
// TARGET — discriminated union (Pitfall 3 "exactly one subject" enforced at the type level):
export const startRunSchema = z.discriminatedUnion('subjectType', [
  z.object({ subjectType: z.literal('CONTRACTOR'), templateId: z.string().min(1),
             contractorId: z.string().min(1), contractId: optionalFk }),
  z.object({ subjectType: z.literal('EMPLOYEE'), templateId: z.string().min(1),
             workerId: z.string().min(1) }),
]);
```
**Convention:** `.strict()` on the employee variant rejects an injected `organizationId`/`workerType` (V5). Keep `StartRunInput = z.infer<…>` export.

---

### `packages/validators/src/legal/disclaimers.ts` (validator const, locked)

**Analog:** `SDS_DISCLAIMER_EN` :28-33 + the two registries that CI enforces.
```typescript
// Locked const style to mirror (:28):
export const SDS_DISCLAIMER_EN =
  'This Status Determination Statement is issued by the client … Consult a qualified UK tax adviser before acting on this result.';
```
**Add** e.g. `CERT_ADVISER_VERIFY_EN/DE/PL` ("This document is a DRAFT and needs verification by a jurisdiction-specific legal/tax adviser before use."), then **register in BOTH** `RESERVED_DISCLAIMER_KEYS` (:111-124) and `LOCKED_DISCLAIMERS` (:126-139). **Convention:** these strings must be ABSENT from `messages/*.json` (locked-phrases-guard extends automatically once keyed). Render as a prominent fixed watermark/footer on every cert.

---

### `packages/api/src/routers/workflow/workflow-execution-runs.ts` (controller, request-response)

**Analog:** its own contractor branch — the whole `startRun` :38-107.
```typescript
// CONTRACTOR branch to fork on input.subjectType (:56-96):
const contractor = await findOrThrow(
  () => tx.contractor.findFirst({ where: { id: input.contractorId, organizationId: ctx.organizationId, deletedAt: null } }),
  E.CONTRACTOR_NOT_FOUND,
);
...
const workflowRun = await tx.workflowRun.create({
  data: {
    organizationId: ctx.organizationId,
    workflowTemplateId: template.id,
    entityType: 'CONTRACTOR',          // → 'EMPLOYEE' on the worker branch
    entityId: contractor.id,           // → worker.id
    contractorId: contractor.id,       // → null; set workerId: worker.id
    ...
  },
});
const taskIdMap = await instantiateTaskRuns(tx, ctx.organizationId, workflowRun.id, template.tasks, contractor, contract, now);
```
**Worker branch:** `tx.worker.findFirst({ where: { id: input.workerId, organizationId, workerType: 'EMPLOYEE' } })` instead of `tx.contractor.findFirst`; create with `entityType:'EMPLOYEE', entityId: worker.id, workerId: worker.id, contractorId: null`. **`instantiateTaskRuns` needs NO change** — its signature is structurally typed `contractor: { id: string; [k: string]: unknown }` (workflow-execution-shared.ts:196), so an employee bag satisfies it. **`assertRunCompletable` (workflow-shared.ts, keys on `workflowRunId`+org) and `calculateProgress` are reused unchanged.** Keep `requirePermission({ workflow: ['execute'] })` (:39) and the `writeAuditLog` on start.

---

### `packages/api/src/routers/workflow/workflow-shared.ts` (pure-fn, transform)

**Analog:** `resolveAssignee` :134-168.
```typescript
// :159-162 — the two owner modes employees lack (no internalOwnerUserId on Worker/EmployeeProfile):
    case 'CONTRACTOR_OWNER':
      return contractor.internalOwnerUserId ?? null;
    case 'CONTRACT_OWNER':
      return contract?.internalOwnerUserId ?? null;
```
**Convention:** **Design employee templates to use `ROLE_BASED`** (P89 HR roles `hr_admin`/`hr_manager`/`payroll_officer`/`leave_approver`, resolved via `tx.member.findFirst` :150-157) **or `FIXED_USER`** — do NOT rely on the owner modes for employees. Optionally generalize by adding an `EMPLOYEE_HR_OWNER` mode. Also generalize the downstream "for {contractorName}" notification (workflow-execution-runs.ts:138 returns `contractorName`) to a subject-agnostic display name.

---

### `packages/api/src/routers/integrations/deprovisioning.ts` (controller, event-driven) — THE MAIN NEW BUILD

**Analog:** `startDeprovisioningRun` :202-345, `resolveAssignmentForContractor` :177-190, `COUNTRY_TZ` :103-110.

**Cooldown reuse — today reads a contractor via an ENDED assignment (:210-236):**
```typescript
const assignment = await findOrThrow(() => ctx.db.contractorAssignment.findFirst({
  where: { id: input.assignmentId, organizationId: ctx.organizationId },
  select: { id: true, status: true, endedAt: true, contractorId: true,
            contractor: { select: { id: true, countryCode: true, email: true } } },
}), DEPROVISIONING_ASSIGNMENT_NOT_FOUND);

const decision = canStartDeprovisioning({
  endedAt: assignment.endedAt ?? null,
  jurisdictionTz: COUNTRY_TZ[assignment.contractor.countryCode] ?? DEFAULT_JURISDICTION_TZ,
  status: assignment.status,
});
if (!decision.allowed) throw new TRPCError({ code: 'FORBIDDEN', message: DEPROVISIONING_COOLDOWN_ACTIVE });
const externalUserId = assignment.contractor.email;   // worker path: emp.worker.email
```
**Worker branch to add** (read `EmployeeProfile` instead of assignment; synthesize the ENDED status from `terminatedAt`):
```typescript
const emp = await ctx.db.employeeProfile.findFirst({
  where: { workerId: input.workerId, organizationId: ctx.organizationId },
  select: { countryCode: true, terminatedAt: true, worker: { select: { email: true } } },
});
const decision = canStartDeprovisioning({
  endedAt: emp.terminatedAt ?? null,
  status: emp.terminatedAt ? 'ENDED' : 'ACTIVE',           // synthesize — no assignment row
  jurisdictionTz: COUNTRY_TZ[emp.countryCode] ?? DEFAULT_JURISDICTION_TZ,
});
const externalUserId = emp.worker.email;
```
**Run creation** — today writes `contractorId`/`assignmentId` (:263-286); worker path writes `{ workerId, contractorId: null, assignmentId: null, steps: … }`. **The step fan-out (:294-316), the `deriveProvidersForRun` set (:84-93), the P2002 idempotency handler (:328-343), and the QStash body (`externalUserId` only, :303-311) all stay unchanged.**

**`resolveAssignmentForContractor` (:177-190)** — employees have no assignment. Add a sibling `resolveWorkerForDeprovisioning(workerId)` OR bypass entirely (worker path supplies `workerId` directly; `assignmentId` stays null).

**Pitfall 7:** `COUNTRY_TZ` (:103-110) has DE/GB/PL/SA/AE but **no US** — add a conservative `US: 'America/New_York'` default (cooldown is TZ-identical across IANA zones; only the displayed earliest-date differs). Keep `integrationProcedure({ permission: { idp: ['start_run'] } })`.

**DO NOT TOUCH (already worker-agnostic):** `apps/api/src/routes/idp-deprovisioning.ts` step runner, `idp-deprovisioning-step-runner.ts` (`stepRunnerBodySchema` — externalUserId only), `idp-token-resolver.ts` (keys on org+provider), `cooldown.ts` `canStartDeprovisioning`, `recomputeRunStatus`, all adapters.

---

### NEW `employee-lifecycle-router.ts` (controller/route) + `root.ts` mount

**Analog for the router:** `deprovisioningRouter` structure (deprovisioning.ts:112 — `router({ … integrationProcedure … })`) + `startRun` (`tenantProcedure.use(requirePermission(...)).input(zodSchema).mutation(...)` :38-41). New procedures: start on/offboard, generate cert. Zod on every input; `assertWorkforceEnabled(ctx.organizationId, ctx.region)` first line; `writeAuditLog` on mutations.

**Analog for the mount:** `root.ts:168-182`.
```typescript
const workforceRouters = {
  worker: workerRouter,
  employee: employeeRouter,
  // + employeeLifecycle: employeeLifecycleRouter,
} as const;
const conditionalWorkforceRouters = isWorkforceRegistered() ? workforceRouters : ({} as typeof workforceRouters);
```
**Convention:** add to the existing `workforceRouters` const (do NOT create a new conditional block) — the flag `module.workforce-employees` already gates it; the `as const` + `as typeof` keeps client typing constant across the flag-off branch.

---

### NEW `packages/api/src/services/statutory-cert-pdf.ts` (service, file-I/O)

**Analog:** `form-1099-nec-pdf.ts` (whole file — render→CAS→R2 CAS double-render guard).
```typescript
// snapshot type (:24) — carries *Last4 ONLY, never a full national ID:
export interface CertRenderSnapshot { /* values-as-of-generation; never a live recompute */ }

// CAS guard (:115-122) — claim the archive slot before any I/O:
const claimed = await db.statutoryCertificate.updateMany({
  where: { id: row.id, pdfArchiveKey: null },
  data: { pdfArchiveKey },
});
if (claimed.count === 0) return { …, skipped: true };

// lazy render (:40) + org-scoped R2 key (:57) + sign+discard (:127-134):
const { renderToBuffer } = await import('@react-pdf/renderer');
const pdfBuffer = await renderToBuffer(SwiadectwoPracyDocument({ …snapshot }));
await putObjectAndSignDownload({ key: `emp-cert/${orgId}/${id}.pdf`, body: pdfBuffer, contentType: 'application/pdf', ttlSeconds: 60 });
```
**Convention:** immutable snapshot (never a live recompute), org-scoped key `emp-cert/<orgId>/<id>.pdf` (ASVS V4), lazy `@react-pdf/renderer` import, `createLogger({ service: 'statutory-cert-pdf' })`. R2 bucket routes per region (EU for PL/DE/UK, US bucket lazy-throws if `R2_BUCKET_NAME_US` unset — non-blocking for PL/DE/UK).

---

### NEW `pdf-templates/{swiadectwo-pracy,arbeitszeugnis,p45,w2}.tsx` (react-pdf component)

**Analog:** `ir35-sds.tsx` :1-70 — the legal-doc precedent.
```typescript
// :16 — imports; :18-19 — versioned template + slug; :65 — StyleSheet:
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { CERT_ADVISER_VERIFY_EN } from '@contractor-ops/validators';   // locked disclaimer
export const TEMPLATE_VERSION = 1 as const;
export const RENDERER_SLUG = 'swiadectwo-pracy' as const;
const styles = StyleSheet.create({ page: { fontFamily: 'Helvetica', fontSize: 10, … } });
```
**Convention:** reads ONLY from the immutable snapshot (never live constants); a PROMINENT locked adviser-verify watermark/footer from `disclaimers.ts` on every page; stable `renderedAt` for byte stability. **v7.0 subset (research A3/Open-Q2):** ship structured/form-shaped certs first — PL świadectwo pracy + PIT-11, DE simple Arbeitszeugnis + Lohnsteuerbescheinigung, UK P45, US W-2; defer free-text qualified Arbeitszeugnis + US benefits packets (COBRA/401k) to v7.5. Planner locks the subset.

---

### NEW `services/{i9-everify,zus-zwua,abmeldung-sv,hmrc-rti,pit-filing}-stub.ts` (service, gov seam)

**Analog:** `elstam-stub.ts` :18-62.
```typescript
// :18 input iface, :33-41 STUB result shape, :55-62 network-free body:
export interface ZwuaSubmitInput { pesel: string; terminationDate: string; }
export interface GovStubResult { source: 'STUB'; available: false; note: string; }
export function submitZusZwua(input: ZwuaSubmitInput): GovStubResult {
  return { source: 'STUB', available: false,
    note: `ZUS ZWUA submission stubbed for PESEL ending ${input.pesel.slice(-2)} — no live PUE ZUS channel wired.` };
}
```
**Convention:** typed, network-free, `source:'STUB', available:false`, note masks PII (last-2 only). Each gov interaction = one stub fn + one MANUAL/NOTIFICATION `WorkflowTaskTemplate` the HR user completes by hand. **Steuer-ID lookup reuses the existing `lookupElstam`** — do not re-stub. Applies to: I-9+E-Verify, ZUS ZWUA, Abmeldung SV, HMRC RTI, PIT-2/PIT-11.

---

### `packages/api/src/services/post-org-create-hook.ts` (boot hook, batch) + NEW `packages/employee-templates/`

**Analog for the hook:** `runPostOrganizationCreateHooks` :14-28 (fail-soft — logged, NOT re-thrown).
```typescript
export async function runPostOrganizationCreateHooks(prisma, organizationId): Promise<void> {
  try {
    await upsertSeedTemplates(prisma, organizationId);          // + await upsertEmployeeMarketTemplates(prisma, organizationId);
    logger.info({ organizationId }, 'offboarding seed templates upserted');
  } catch (err) {
    logger.error({ organizationId, err }, 'seed upsert failed; …');   // do NOT re-throw
  }
}
```
**Analog for the seed package:** `offboarding-templates/src/upsert-on-boot.ts` :16-58 — idempotent upsert on a compound unique.
```typescript
// :21-30 — the upsert-on-compound-unique idiom to retarget at WorkflowTemplate:
const tmpl = await prisma.workflowRoleTemplate.upsert({          // → prisma.workflowTemplate.upsert
  where: { organizationId_role: { organizationId, role: seed.role } },   // → organizationId_jurisdiction_type_seedKey
  update: { … },
  create: { organizationId, …, isSeed: true },                  // → status:'DRAFT', appliesToEntityType:'EMPLOYEE'
});
```
**CRITICAL convention (research §Pattern 3):** reuse the boot-upsert **pattern**, but target `WorkflowTemplate`/`WorkflowTaskTemplate` (what `startRun` instantiates) — **NOT** `WorkflowRoleTemplate`/`WorkflowRoleTaskTemplate` (the KT role registry). Keyed on the new `@@unique([organizationId, jurisdiction, type, seedKey])`. Seed 8 rows (4 jurisdictions × ONBOARDING/OFFBOARDING). Content authored as typed-const seeds (see seeds.ts:9-50 shape), materialized DRAFT on boot so orgs review/activate/edit. Mirror `offboarding-templates/__tests__/upsert-on-boot.test.ts` for the idempotency test.

---

### `packages/compliance-policy/src/{index,types}.ts` (register-on-import config)

**Analog:** `index.ts` :7-12 register-on-import + `Jurisdiction` (types.ts:6 — already `'UK'|'DE'|'PL'|'US'|'KSA'|'UAE'`).
```typescript
// index.ts:7-12 — module-import side-effect registration, order-independent:
import './policies/uk';
import './policies/de';
import './policies/pl';
import './policies/us';
```
**Convention:** mirror this typed-const register-on-import idiom for the **per-market template content definitions** (a `Jurisdiction`-keyed const map); the DB rows are materialized on boot by the employee-templates upsert. `Jurisdiction` already covers PL/DE/UK/US — no type change needed.

---

### `apps/web-vite/.../use-start-deprovisioning.ts` (hook) + `deprovisioning-trigger.tsx` (component)

**Analog:** its own body :44-125 (already dual-path: `assignmentId` direct OR `contractorId` → server resolver).
```typescript
// :55-62 — the server-resolver pattern to mirror for the worker path:
const resolverQuery = useQuery({
  ...trpc.deprovisioning.resolveAssignmentForContractor.queryOptions({ contractorId: contractorId ?? '' }),
  enabled: !directAssignmentId && !!contractorId,
});
const assignmentId = directAssignmentId ?? resolverQuery.data?.assignmentId ?? null;
```
**Worker variant:** add a `workerId?` input path that passes `workerId` straight through (worker path resolves nothing server-side; `assignmentId` stays null). **Convention (Pitfall 5 — web-vite layering):** the hook is the SOLE tRPC boundary; keep server-side resolution to keep `check:web-vite-data-layer` green. `deprovisioning-trigger.tsx` `DeprovisioningTriggerWired` (:142-169) already gates on `permissions.can('idp', ['start_run'])` and renders loading/error/unresolved states — extend props with `workerId?`. Reuse `deprovisioning-run-view.tsx` by `runId` unchanged (subject-agnostic).

**NEW employee on/offboarding surface:** Page (thin composer — Suspense/permissions, no tRPC) → Container (calls domain hook, section states) → Hook (sole tRPC boundary, mirror use-start-deprovisioning) → Component (presentational). Reuse `workflows/workflow-run/*` (`task-checklist.tsx`, `task-card-run.tsx`, `run-header.tsx`) by `runId` — subject-agnostic.

---

## No Analog Found

None. Every file maps to an in-tree analog — this phase is reuse-and-extend by design.

## Metadata

**Analog search scope:** `packages/db/prisma/schema/`, `packages/api/src/{routers,services,pdf-templates,middleware}/`, `packages/validators/src/{,legal}/`, `packages/{offboarding-templates,compliance-policy,feature-flags}/src/`, `apps/web-vite/src/components/idp/`.
**Files scanned (read at HEAD):** idp-deprovisioning.prisma, employee.prisma, worker.prisma, workflow.prisma, contract.prisma, contractor.prisma, workflow-execution-runs.ts, workflow-execution-shared.ts, workflow-shared.ts, deprovisioning.ts, validators/workflow.ts, disclaimers.ts, form-1099-nec-pdf.ts, ir35-sds.tsx, tax-form.service.ts, elstam-stub.ts, post-org-create-hook.ts, offboarding-templates/{upsert-on-boot,seeds}.ts, compliance-policy/{index,types}.ts, require-workforce-flag.ts, root.ts, flags-core.ts, use-start-deprovisioning.ts, deprovisioning-trigger.tsx.
**Pattern extraction date:** 2026-07-01

## PATTERN MAPPING COMPLETE

**Phase:** 93 - Theme B — Employee On/Offboarding
**Files classified:** 23
**Analogs found:** 23 / 23

### Coverage
- Files with exact analog: 20
- Files with role-match analog: 3 (employee-lifecycle-router, StatutoryCertificate model, new web-vite on/offboarding surface)
- Files with no analog: 0

### Key Patterns Identified
- **Extend the generic run, worker-key the coupled saga — never duplicate.** `WorkflowRun`/`DeprovisioningRun` gain a nullable `workerId`; contractor FKs go nullable; the engine, gate (`assertRunCompletable`), step runner, token resolver, and `canStartDeprovisioning` cooldown are reused UNCHANGED. Contractor coupling lives in exactly 4 places (schema FKs, `startDeprovisioningRun` trigger, `resolveAssignmentForContractor`, web-vite hook).
- **Discriminated-union subject input** (`startRunSchema`, `startDeprovisioningRun`) enforces the "exactly one of contractorId | workerId" invariant that Prisma relations cannot; optional raw `CHECK` for defense-in-depth.
- **Boot-upsert idempotency retargeted:** reuse `upsert-on-boot.ts` pattern but seed `WorkflowTemplate` (what `startRun` instantiates), NOT `WorkflowRoleTemplate` (the KT registry) — requires a new `@@unique([organizationId, jurisdiction, type, seedKey])`.
- **Statutory certs = render→immutable-snapshot→R2 CAS** (`form-1099-nec-pdf.ts`) + react-pdf templates (`ir35-sds.tsx`) + LOCKED adviser-verify disclaimer const (`disclaimers.ts`, absent from `messages/*.json`). Snapshots carry `*Last4` only.
- **Gov integrations = typed network-free stub seams** (`elstam-stub.ts`) + manual workflow tasks; no live calls this phase.
- **Cross-cutting:** `withTenantScope` + two-org leak test per new model; `writeAuditLog` on sensitive mutations; `assertWorkforceEnabled` + conditional `root.ts` spread (flag already registered); i18n parity except locked disclaimers; `__`-prefixed drift-safe migrations + `db:generate`; UPPER_SNAKE enums; web-vite Page→Container→Hook→Component; `@contractor-ops/logger` (no `console.*`).

### File Created
`/Users/mateusz.pitura/Repos/projects/contractor-ops/.planning/milestones/v7.0-phases/93-theme-b-employee-on-offboarding/93-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog file paths + line-cited excerpts in each PLAN.md `<read_first>` and `<action>` field.
