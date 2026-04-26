# Phase 71 Patterns Map

> Analog files in the codebase that the planner/executor MUST mirror. Every new file in Phase 71 has at least one near-twin already shipped.

---

## D-01..D-04 — Policy Registry Package

### NEW: `packages/compliance-policy/` (new workspace package)

**Closest analogs:**

1. `packages/classification/` — typed-const profile registry with per-country sub-modules. Same `registerProfile` / `getProfileForCountry` shape we mirror via `getPolicyForOutcome(outcome, jurisdiction)`.
2. `packages/feature-flags/` — `as const satisfies` typed registry pattern + deepFreeze. We replicate the deep-frozen tree shape.
3. `packages/einvoice/` — `KOSIT_RULE_SET_VERSION` exported as a single const, persisted on assessments. Direct precedent for `POLICY_RULE_SET_VERSION`.

**Pattern excerpt** (`packages/classification/src/registry.ts` — registry shape we mirror):

```ts
const profiles = new Map<string, ClassificationProfile>();

export function registerProfile(profile: ClassificationProfile): void {
  if (profiles.has(profile.profileId)) {
    throw new Error(`Classification profile already registered: ${profile.profileId}`);
  }
  profiles.set(profile.profileId, profile);
}

export function getProfileForCountry(countryCode: string): ClassificationProfile {
  // ... fail-fast lookup ...
}
```

**Apply to Phase 71:**

```
packages/compliance-policy/
├── package.json                    # @contractor-ops/compliance-policy, ESM, vitest
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                    # public surface
│   ├── types.ts                    # PolicyRule, PolicyRuleSet, EngagementContext, parsePolicyRuleId
│   ├── version.ts                  # POLICY_RULE_SET_VERSION = 'v6.0.0'
│   ├── registry.ts                 # deepFreeze + resolvePolicyRules
│   ├── expiry.ts                   # isExpired(expiresAt, tz, now) — TZ boundary helper
│   ├── policies/
│   │   ├── uk.ts                   # 4 rules
│   │   ├── de.ts                   # 3 rules
│   │   ├── pl.ts                   # 2 rules
│   │   ├── ksa.ts                  # 2 rules
│   │   └── uae.ts                  # 2 rules
│   └── __tests__/
│       ├── registry.test.ts
│       ├── version.test.ts
│       ├── resolve.test.ts
│       └── expiry.test.ts
```

The registry uses **module-import side effects** (each policy file imports from `./registry.ts`'s `registerPolicyRule` at module load) — same pattern `packages/classification/src/profiles/ir35/profile.ts` uses for `registerProfile(IR35_PROFILE)`. The barrel `src/index.ts` imports all 5 policy modules to ensure registration runs.

---

### Typed-const policy rule shape (D-01/D-02)

**Closest analog:** `packages/classification/src/types/profile.ts` (typed profile shape) + `packages/feature-flags/src/registry.ts` (`as const satisfies` deep-freeze).

**Apply to Phase 71:**

```ts
// packages/compliance-policy/src/types.ts
export type Severity = 'BLOCKING' | 'WARNING' | 'INFO';
export type Jurisdiction = 'UK' | 'DE' | 'PL' | 'KSA' | 'UAE';

export type PolicyRuleId = `${Lowercase<string>}.${string}@v${number}`;

export interface EngagementContext {
  jurisdiction: Jurisdiction;
  outcome: string;          // e.g., 'IR35-INSIDE', 'IR35-OUTSIDE', 'ABHANGIG', 'SELBSTANDIG', 'CROSS_BORDER'
  sector: string | null;    // 'construction' | other (read from ContractorAssignment.sector if present)
  contractorNationality: string | null;  // ISO-3166-1 alpha-2; needed for de.aufenthaltstitel
  requiresRegulatedEquipment: boolean;   // for pl.udt
}

export interface PolicyRule {
  policyRuleId: PolicyRuleId;
  jurisdiction: Jurisdiction;
  documentType: string;          // matches Prisma DocumentType enum literal
  displayName: string;           // English display name (Phase 73 i18n covers locales)
  severity: Severity;
  expiryJurisdictionTz: string;  // IANA TZ
  appliesIf: (ctx: EngagementContext) => boolean;
  draftLegalText: string;        // PENDING approval (Standing Constraint)
}

export interface PolicyRuleSet {
  outcome: string;
  jurisdiction: Jurisdiction;
  rules: readonly PolicyRule[];
}
```

```ts
// packages/compliance-policy/src/registry.ts
import { deepFreeze } from './freeze.js';
import type { PolicyRule, EngagementContext } from './types.js';

const REGISTRY: PolicyRule[] = [];

export function registerPolicyRule(rule: PolicyRule): void {
  if (REGISTRY.some(r => r.policyRuleId === rule.policyRuleId)) {
    throw new Error(`Duplicate policyRuleId: ${rule.policyRuleId}`);
  }
  REGISTRY.push(deepFreeze(rule));
}

export function resolvePolicyRules(ctx: EngagementContext): readonly PolicyRule[] {
  return REGISTRY.filter(r => r.jurisdiction === ctx.jurisdiction && r.appliesIf(ctx));
}
```

`deepFreeze` lifted from `packages/feature-flags/src/registry.ts` (lines 11–19) — copy-paste; trivial enough not to be an export-from-shared.

---

### NEW: 13 PENDING signoff entries (D-04)

**Closest analog:** `packages/feature-flags/src/signoff-registry-flags.json` — Phase 70's empty JSON. We APPEND entries.

**Pattern excerpt** (`packages/feature-flags/src/signoff-registry-flags-schema.ts` — schema we extend):

The schema accepts arbitrary string keys with `{status, approvedBy?, approvedAt?, approverRole?, legalTicketRef?, notes?}`. We add 13 entries with `status: 'PENDING'` only — schema's `.refine` clause enforces APPROVED entries need full metadata; PENDING needs nothing.

**Apply to Phase 71** (add to `packages/feature-flags/src/signoff-registry-flags.json`):

```json
{
  "compliance-policy-engine.uk.right_to_work":     { "status": "PENDING", "notes": "UK Right-to-Work share code (90-day generation expiry); legal review deferred per Standing Constraint" },
  "compliance-policy-engine.uk.utr":               { "status": "PENDING", "notes": "HMRC UTR (10-digit); non-expiring" },
  "compliance-policy-engine.uk.business_registration": { "status": "PENDING", "notes": "Companies House registration (8-digit company number)" },
  "compliance-policy-engine.uk.sds":               { "status": "PENDING", "notes": "Status Determination Statement (Chapter 10 ITEPA 2003); required for IR35-INSIDE outcomes" },
  "compliance-policy-engine.de.a1":                { "status": "PENDING", "notes": "A1-Bescheinigung (Deutsche Rentenversicherung); 24-month max per EU Reg 883/2004 Art 12" },
  "compliance-policy-engine.de.aufenthaltstitel":  { "status": "PENDING", "notes": "Aufenthaltstitel residence permit (AufenthG §4); conditional on non-EU nationality" },
  "compliance-policy-engine.de.eight_b_estg":      { "status": "PENDING", "notes": "§48b EStG Freistellungsbescheinigung; conditional on construction-sector engagement" },
  "compliance-policy-engine.pl.zus_a1":            { "status": "PENDING", "notes": "ZUS A1 (zaświadczenie A1 z ZUS); 12-month max per PL implementation" },
  "compliance-policy-engine.pl.udt":               { "status": "PENDING", "notes": "UDT certification; conditional on regulated-equipment engagement" },
  "compliance-policy-engine.ksa.iqama":            { "status": "PENDING", "notes": "Iqama residency permit; 1-year max per Saudi MOI rule; boundary at 00:00 Asia/Riyadh" },
  "compliance-policy-engine.ksa.work_permit_qiwa": { "status": "PENDING", "notes": "Work permit + Qiwa portal authorisation boolean (Phase 79 wires API)" },
  "compliance-policy-engine.uae.emirates_id":      { "status": "PENDING", "notes": "ICA-issued Emirates ID" },
  "compliance-policy-engine.uae.free_zone_license": { "status": "PENDING", "notes": "Free-zone trade license (DMCC, ADGM, etc.); annually renewed" }
}
```

These keys are **JSON-only** — they do NOT appear in `packages/feature-flags/src/registry.ts` `FLAGS` (the runtime registry). The Phase 70 D-10 boot gate iterates `FLAG_KEYS` and matches gated namespaces — JSON-only entries never trip the gate. Verified by a vitest assertion in Plan 71-02.

---

## D-05..D-08 — Schema Migration

### MODIFY: `packages/db/prisma/schema/contractor.prisma`

**Closest analog (and target):** itself — `ContractorComplianceItem` model lines 225–248. We add 4 NULLABLE columns + 2 enums + 1 new index. No DROP/RENAME.

**Pattern excerpt** (current model — lines 225–248):

```prisma
model ContractorComplianceItem {
  id                    String           @id @default(cuid())
  organizationId        String
  contractorId          String
  contractId            String?
  requirementTemplateId String?
  name                  String
  documentType          DocumentType
  status                ComplianceStatus @default(MISSING)
  dueDate               DateTime?        @db.Date
  satisfiedByDocumentId String?
  expiresAt             DateTime?        @db.Date
  notes                 String?
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  contractor   Contractor   @relation(fields: [contractorId], references: [id])
  contract     Contract?    @relation(fields: [contractId], references: [id])

  @@index([organizationId])
  @@index([organizationId, contractorId, status])
  @@index([organizationId, expiresAt])
}
```

**Apply to Phase 71** (D-05/D-06/D-07/D-11) — diff is additive:

```prisma
model ContractorComplianceItem {
  id                    String           @id @default(cuid())
  organizationId        String
  contractorId          String
  contractId            String?
  requirementTemplateId String?
  name                  String
  documentType          DocumentType
  status                ComplianceStatus @default(MISSING)
  severity              Severity?        // Phase 71 D-05 — null pre-backfill
  policyRuleId          String?          // Phase 71 D-06 — value-checked at write against compliance-policy registry
  expiryJurisdictionTz  String?          // Phase 71 D-07 — IANA TZ; set at row-creation, never rewritten
  waivedReason          WaivedReason?    // Phase 71 D-11 — only populated when status = WAIVED
  dueDate               DateTime?        @db.Date
  satisfiedByDocumentId String?
  expiresAt             DateTime?        @db.Date
  notes                 String?
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  contractor   Contractor   @relation(fields: [contractorId], references: [id])
  contract     Contract?    @relation(fields: [contractId], references: [id])

  @@index([organizationId])
  @@index([organizationId, contractorId, status])
  @@index([organizationId, expiresAt])
  @@index([organizationId, policyRuleId])  // Phase 71 — supports drift queries by policyRuleId namespace
}

// New enums appended to the same file
enum Severity {
  BLOCKING
  WARNING
  INFO
}

enum WaivedReason {
  superseded_by_policy_version
  classification_outcome_change
  admin_manual_waive
  contractor_offboarded
}
```

**Closest analog for the schema additive-only pattern:** Phase 70 Plan 70-09 (`scopeCapabilities Json?` added as a sibling of `configJson Json?`). Same `prisma migrate dev --create-only` review-before-apply pattern.

### MODIFY: `packages/db/prisma/schema/classification.prisma`

```prisma
model ClassificationAssessment {
  // ... existing fields (line 15+) ...
  ruleSetVersion           String
  policyRuleSetVersion     String?  // Phase 71 D-03 — null pre-backfill; set on every new submit
  status                   ClassificationAssessmentStatus @default(draft)
  // ... rest unchanged ...
}
```

---

### NEW: `packages/db/scripts/backfill-compliance-policy.ts`

**Closest analog:** `packages/db/scripts/backfill-scope-capabilities.ts` (Phase 70 Plan 70-09) — single-region per invocation, `WHERE policyRuleId IS NULL` precondition, dry-run flag, pino logger. Verbatim shape — adapt only the WHERE clause and the policy resolution logic.

**Pattern excerpt** (the structural sibling):

```ts
#!/usr/bin/env tsx
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../..');
config({ path: resolve(ROOT_DIR, '.env') });
// ... CLI dry-run handling, WHERE precondition, $transaction batch ...
```

**Apply to Phase 71:** Read each contractor's latest `completed` `ClassificationAssessment`, resolve the policy rule set via `resolvePolicyRules({ outcome, jurisdiction, … })`, populate `policyRuleId` + `severity` + `expiryJurisdictionTz` on each existing `ContractorComplianceItem` whose `documentType` matches a rule. Idempotent via `WHERE policyRuleId IS NULL`. Multi-region apply documented as manual run.

---

## D-09..D-12 — Classification Supersession

### MODIFY: `packages/api/src/routers/classification.ts` `submit` mutation (line 389)

**Closest analog (and target):** itself — `recreateDraftAfterDrift` at line 233 already shows the transactional + audit-friendly mutation pattern. We extract `supersedeAndMaterialise(tx, ctx)` as a helper used by both `submit` and the new `recreateComplianceAssessment`.

**Pattern excerpt** (`recreateDraftAfterDrift` lines 233–276 — the transaction shape we mirror, though that mutation does NOT use `$transaction` because it's a single create. We adopt `$transaction` for the multi-row supersession):

```ts
recreateDraftAfterDrift: classificationProcedure
  .input(recreateDraftAfterDriftInput)
  .mutation(async ({ ctx, input }) => {
    // ... preconditions: NOT_FOUND, CONFLICT, PRECONDITION_FAILED ...
    return ctx.db.classificationAssessment.create({ ... });
  }),
```

**Apply to Phase 71** (`submit` body wrapped in `$transaction`):

```ts
submit: contractorUpdateProcedure.input(submitInput).mutation(async ({ ctx, input }) => {
  return ctx.db.$transaction(async (tx) => {
    const row = await tx.classificationAssessment.findFirst({ where: { id: input.assessmentId } });
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    if (row.status !== 'draft') throw new TRPCError({ code: 'CONFLICT', message: 'Assessment already submitted; assessments are append-only (D-04).' });

    const profile = getProfileForCountry(row.countryCode);
    let computed: Outcome;
    try {
      computed = profile.scoreAssessment(row.answers as Parameters<typeof profile.scoreAssessment>[0]);
    } catch (err) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: err instanceof Error ? `Scoring failed: ${err.message}` : 'Scoring failed: unknown engine error.' });
    }
    const validatedOutcome = outcomeSchema.parse(computed);

    const shell = profile.buildAssessment(row.contractorAssignmentId);
    const snapshot = buildQuestionsSnapshot(profile, { profileId: profile.profileId, ruleSetVersion: profile.ruleSetVersion, countryCode: profile.country, questions: shell.questions });

    const now = new Date();

    // Look up prior completed assessment (for outcome-change detection)
    const prior = await tx.classificationAssessment.findFirst({
      where: { contractorAssignmentId: row.contractorAssignmentId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
    });

    const updated = await tx.classificationAssessment.update({
      where: { id: row.id },
      data: {
        status: 'completed',
        outcome: validatedOutcome,
        questionsSnapshot: snapshot,
        completedAt: now,
        immutableAfter: new Date(now),
        policyRuleSetVersion: POLICY_RULE_SET_VERSION,  // Phase 71 D-03
      },
    });

    // Phase 71 D-10 — supersession on outcome change OR first-classification materialisation
    const assignment = await tx.contractorAssignment.findUniqueOrThrow({ where: { id: row.contractorAssignmentId } });
    const engagementCtx: EngagementContext = {
      jurisdiction: row.countryCode as Jurisdiction,
      outcome: extractOutcomeKind(validatedOutcome),
      sector: null,           // TODO Plan 71-04: read from assignment if column exists
      contractorNationality: null,
      requiresRegulatedEquipment: false,
    };

    if (!prior) {
      await materialiseFromPolicy(tx, { organizationId: ctx.organizationId, contractorId: assignment.contractorId, engagement: engagementCtx, contractId: input.contractId ?? null });
    } else if (extractOutcomeKind(prior.outcome) !== extractOutcomeKind(validatedOutcome)) {
      await supersedeAndMaterialise(tx, { organizationId: ctx.organizationId, contractorId: assignment.contractorId, engagement: engagementCtx, reason: 'classification_outcome_change' });
    }
    // Same kind → no row churn (D-10 atomic guarantee maintained)

    if (row.countryCode === 'GB') {
      await tx.reassessmentTrigger.updateMany({
        where: { contractorAssignmentId: row.contractorAssignmentId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
        data: { status: 'RESOLVED', resolvedAt: now },
      });
    }
    return updated;
  });
}),
```

### NEW: `packages/api/src/services/compliance-supersession.ts`

**Closest analogs:**
1. `packages/api/src/services/audit-writer.ts` — same "shared service that writes within a tx" shape. `writeAuditLog(input)` accepts a structural `client` interface that is satisfied by both `ctx.db` and a `tx` from `$transaction`.
2. `packages/api/src/routers/classification.ts` lines 261–275 — pattern of inserting after read-mark-superseded.

**Apply to Phase 71:**

```ts
// packages/api/src/services/compliance-supersession.ts
import type { Prisma } from '@prisma/client';
import { resolvePolicyRules, type EngagementContext } from '@contractor-ops/compliance-policy';

export interface SupersedeContext {
  organizationId: string;
  contractorId: string;
  engagement: EngagementContext;
  reason: 'classification_outcome_change' | 'superseded_by_policy_version' | 'admin_correction';
  contractId?: string | null;
}

export interface MaterialiseContext {
  organizationId: string;
  contractorId: string;
  engagement: EngagementContext;
  contractId: string | null;
}

// Structural client type — works with both tenant tx and a $transaction tx
type SupersessionClient = {
  contractorComplianceItem: {
    findMany: (args: Prisma.ContractorComplianceItemFindManyArgs) => Promise<unknown[]>;
    updateMany: (args: Prisma.ContractorComplianceItemUpdateManyArgs) => Promise<unknown>;
    create: (args: Prisma.ContractorComplianceItemCreateArgs) => Promise<unknown>;
  };
};

export async function materialiseFromPolicy(client: SupersessionClient, ctx: MaterialiseContext): Promise<void> {
  const rules = resolvePolicyRules(ctx.engagement);
  for (const rule of rules) {
    await client.contractorComplianceItem.create({
      data: {
        organizationId: ctx.organizationId,
        contractorId: ctx.contractorId,
        contractId: ctx.contractId,
        documentType: rule.documentType as Prisma.ContractorComplianceItemUncheckedCreateInput['documentType'],
        name: rule.displayName,
        severity: rule.severity,
        policyRuleId: rule.policyRuleId,
        expiryJurisdictionTz: rule.expiryJurisdictionTz,
        status: 'MISSING',
      },
    });
  }
}

export async function supersedeAndMaterialise(client: SupersessionClient, ctx: SupersedeContext): Promise<void> {
  const oldRows = await client.contractorComplianceItem.findMany({
    where: { contractorId: ctx.contractorId, status: { not: 'WAIVED' } },
    select: { id: true, documentType: true, satisfiedByDocumentId: true, expiresAt: true },
  }) as Array<{ id: string; documentType: string; satisfiedByDocumentId: string | null; expiresAt: Date | null }>;

  await client.contractorComplianceItem.updateMany({
    where: { id: { in: oldRows.map(r => r.id) } },
    data: { status: 'WAIVED', waivedReason: ctx.reason },
  });

  const oldByDocType = new Map(oldRows.map(r => [r.documentType, r]));
  const newRules = resolvePolicyRules(ctx.engagement);

  for (const rule of newRules) {
    const carryFrom = oldByDocType.get(rule.documentType);
    await client.contractorComplianceItem.create({
      data: {
        organizationId: ctx.organizationId,
        contractorId: ctx.contractorId,
        contractId: ctx.contractId ?? null,
        documentType: rule.documentType as Prisma.ContractorComplianceItemUncheckedCreateInput['documentType'],
        name: rule.displayName,
        severity: rule.severity,
        policyRuleId: rule.policyRuleId,
        expiryJurisdictionTz: rule.expiryJurisdictionTz,
        status: carryFrom?.satisfiedByDocumentId ? 'SATISFIED' : 'MISSING',
        satisfiedByDocumentId: carryFrom?.satisfiedByDocumentId ?? null,
        expiresAt: carryFrom?.expiresAt ?? null,
      },
    });
  }
}
```

---

## D-13..D-16 — Admin Recompute Mutation

### MODIFY: `packages/api/src/routers/classification.ts` (add new mutation)

**Closest analog (and target):** `recreateDraftAfterDrift` at line 233 — direct sibling. New mutation lives in the same file alongside it.

**Procedure factory:** `packages/api/src/middleware/rbac.ts:67` exports `adminProcedure = tenantProcedure.use(requirePermission({ organization: ['update'] }))`. Reuse this for `recreateComplianceAssessment` — admins with org-update permission qualify.

**Apply to Phase 71:**

```ts
// packages/api/src/routers/classification.ts (after recreateDraftAfterDrift, before getDraft)
const recreateComplianceAssessmentInput = z.object({
  contractorIds: z.array(z.string().cuid()).min(1).max(500),
  reason: z.enum(['policy_version_bump', 'classification_outcome_change', 'admin_correction']),
});

export type RecreateComplianceAssessmentResult =
  | { contractorId: string; noop: true; reason: 'no_completed_assessment' | 'already_current' }
  | { contractorId: string; noop: false; deltas: Array<{ id: string; before: string; after: string }> };

recreateComplianceAssessment: adminProcedure
  .input(recreateComplianceAssessmentInput)
  .mutation(async ({ ctx, input }) => {
    const results: RecreateComplianceAssessmentResult[] = [];
    for (const contractorId of input.contractorIds) {
      const result = await ctx.db.$transaction(async (tx) => {
        const latest = await tx.classificationAssessment.findFirst({
          where: { contractorAssignment: { contractorId, organizationId: ctx.organizationId }, status: 'completed' },
          orderBy: { completedAt: 'desc' },
          include: { contractorAssignment: true },
        });
        if (!latest) return { contractorId, noop: true as const, reason: 'no_completed_assessment' as const };
        if (latest.policyRuleSetVersion === POLICY_RULE_SET_VERSION && input.reason === 'policy_version_bump') {
          return { contractorId, noop: true as const, reason: 'already_current' as const };
        }

        const before = await tx.contractorComplianceItem.findMany({
          where: { contractorId, status: { not: 'WAIVED' } },
          select: { id: true, status: true, policyRuleId: true },
        });

        await supersedeAndMaterialise(tx, {
          organizationId: ctx.organizationId,
          contractorId,
          engagement: buildEngagementContext(latest),
          reason: input.reason === 'policy_version_bump' ? 'superseded_by_policy_version' : 'classification_outcome_change',
        });

        await tx.classificationAssessment.update({
          where: { id: latest.id },
          data: { policyRuleSetVersion: POLICY_RULE_SET_VERSION },
        });

        const after = await tx.contractorComplianceItem.findMany({
          where: { contractorId, status: { not: 'WAIVED' } },
          select: { id: true, status: true, policyRuleId: true },
        });

        return { contractorId, noop: false as const, before, after, policyRuleSetVersionBefore: latest.policyRuleSetVersion };
      });
      results.push(result as RecreateComplianceAssessmentResult);
    }

    // D-15 — single AuditLog row per invocation
    await writeAuditLog({
      client: ctx.db,
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.session.user.id,
      action: 'compliance.recompute',
      resourceType: 'CONTRACTOR',
      resourceId: input.contractorIds.length === 1 ? input.contractorIds[0] : 'BULK',
      metadataJson: {
        reason: input.reason,
        contractorIds: input.contractorIds,
        policyRuleSetVersionAfter: POLICY_RULE_SET_VERSION,
        results,
      },
    });

    return { results };
  }),
```

---

## D-13 (UI Surface) — Per-Contractor + Bulk Recompute Buttons

### NEW: `apps/web/src/components/contractors/compliance/recompute-compliance-button.tsx`

**Closest analog:** `apps/web/src/components/contractors/revalidate-vat-button.tsx` (already in repo per `git status`) — same shape: a button on the contractor profile that calls a tRPC mutation, shows loading state, success toast.

**Apply to Phase 71:** Component renders inside the contractor profile's compliance tab; on click, opens a confirm dialog (reason dropdown + affected-row count placeholder), then calls `trpc.classification.recreateComplianceAssessment.useMutation()` with `contractorIds: [contractorId]` and the selected reason. Success toast: "Compliance recomputed — N rows updated".

### NEW: bulk action wired into contractors-list page

**Closest analog:** Existing bulk-actions pattern on the contractors-list page (look up in `apps/web/src/app/[locale]/(dashboard)/contractors/page.tsx` or sibling — Plan 71-06 read_first task).

**Apply to Phase 71:** A new option in the existing selection-toolbar dropdown ("Recompute compliance"); confirm dialog reuses the same component as the per-contractor button but with `contractorIds: selectedIds`.

---

## Audit Log Emission (D-15)

### REUSE: `packages/api/src/services/audit-writer.ts` `writeAuditLog`

**Closest analog (and target):** itself. Existing helper accepts `{ client, organizationId, actorType, actorId, action, resourceType, resourceId, metadataJson }`.

**Apply to Phase 71:** Single call per invocation (NOT per affected row — D-15). `metadataJson` carries the per-contractor delta list. `resourceId` = contractor ID for single-contractor recomputes; literal `'BULK'` for bulk. Future audit-query consumers grep on `action: 'compliance.recompute'`.

---

## Wave-0 Failing Tests Pattern (Plan 71-01)

### Closest analogs:
1. `packages/lint-guards/src/__tests__/*.test.ts` (Phase 70 Wave 0) — failing-test scaffolds with `it.todo` or `it('...', () => { throw new Error('Not implemented') })` pattern.
2. `packages/api/src/__tests__/classification-submit.test.ts` (if exists) — Prisma test util integration test pattern.

**Apply to Phase 71** — Wave 0 ships these failing tests:

| Test file | Asserts |
|---|---|
| `packages/compliance-policy/src/__tests__/registry.test.ts` | All 13 policy rules registered; `policyRuleId` regex matches; every documentType valid |
| `packages/compliance-policy/src/__tests__/version.test.ts` | `POLICY_RULE_SET_VERSION` matches `package.json.version` (with `v` prefix) |
| `packages/compliance-policy/src/__tests__/resolve.test.ts` | UK B2B → 4 rows (RTW, UTR, business-registration, SDS only when IR35-INSIDE); DE ABHANGIG → A1 + Aufenthaltstitel + §48b (conditional on construction); KSA cross-border → Iqama + work-permit-Qiwa; etc. — 4 ROADMAP success-criteria fixtures |
| `packages/compliance-policy/src/__tests__/expiry.test.ts` | Riyadh contractor's "expires today" boundary at 00:00 Asia/Riyadh (D-07 / success-criterion #2) |
| `packages/feature-flags/src/__tests__/signoff-registry-flags-compliance-entries.test.ts` | All 13 `compliance-policy-engine.<jurisdiction>.<doc>` keys present with status `PENDING` |
| `packages/api/src/__tests__/classification-supersession.test.ts` | `submit` flow: first classification materialises rows; outcome change WAIVES + materialises; same outcome no churn; carry-forward keeps `satisfiedByDocumentId` |
| `packages/api/src/__tests__/classification-recompute.test.ts` | `recreateComplianceAssessment` idempotent; emits exactly 1 AuditLog row per invocation; bulk + single both work |
| `packages/db/src/__tests__/backfill-compliance-policy.test.ts` | Backfill is idempotent (`WHERE policyRuleId IS NULL`); resolves policy rules from latest assessment |
| `apps/web/src/components/contractors/compliance/__tests__/recompute-compliance-button.test.tsx` | Button renders on profile; confirm dialog shows reason dropdown; calls mutation with correct args |

---

## NEW: Top-level workspace registration

### MODIFY: root `pnpm-workspace.yaml` (verify packages/* glob is broad enough)

If `packages/*` is the glob, no change needed — `packages/compliance-policy/` is auto-discovered.

### MODIFY: root `tsconfig.json` references (if used)

Phase 70 added `packages/lint-guards/` — same pattern. Reference is added if other packages use a `references` array; otherwise auto-resolved by pnpm + project tsconfig.

---

## PATTERN MAPPING COMPLETE
