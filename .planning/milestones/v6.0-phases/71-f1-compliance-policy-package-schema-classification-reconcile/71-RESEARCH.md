# Phase 71 Research — F1 Compliance — Policy Package + Schema + Classification Reconcile

**Researched:** 2026-04-27
**Phase Goal:** A new contractor whose engagement is classified as IR35 / Scheinselbständigkeit / cross-border immediately gets the correct per-jurisdiction document set materialised as `ContractorComplianceItem` rows; existing rows survive policy rotation; admins can manually trigger a drift recompute.
**Phase Requirements:** COMPL-02, COMPL-08, COMPL-09, COMPL-10
**Confidence:** HIGH on engine shape (every architectural pattern has a sibling: classification snapshot, signoff registry, push-all-regions, recreateDraftAfterDrift, audit-writer). MEDIUM on legal-text accuracy (ROADMAP flags this as `*Needs verification by legal entity before production deploy*`; per Standing Constraint, draft text ships as PENDING and flips post-deploy).

---

## What we already have (foundation we extend, do NOT duplicate)

| Asset | Location | Phase 71 role |
|---|---|---|
| `ContractorComplianceItem` model + `ComplianceStatus` enum (MISSING/PENDING/SATISFIED/EXPIRED/WAIVED) | `packages/db/prisma/schema/contractor.prisma` lines 225–248 | D-05..D-08 add 4 nullable columns + 2 enums; D-09..D-12 use existing WAIVED status |
| `DocumentType` enum (master_contract, business_registration, tax_certificate, …) | `packages/db/prisma/schema/contract.prisma` lines 208–222 | D-12 carry-forward branches on `documentType` equality; new doc-type values added here for jurisdiction-specific docs (UK_RIGHT_TO_WORK_SHARE_CODE, DE_A1_BESCHEINIGUNG, …) |
| `ClassificationAssessment.ruleSetVersion` snapshot + `recreateDraftAfterDrift` mutation | `packages/api/src/routers/classification.ts` lines 219–276; schema `packages/db/prisma/schema/classification.prisma` line 20 | D-03/D-13/D-16 — `policyRuleSetVersion` is a sibling column; `recreateComplianceAssessment` mirrors mutation transactional shape verbatim |
| `buildQuestionsSnapshot` deep-frozen snapshot pattern | `packages/classification/src/snapshot.ts` | D-01/D-02 typed-const policy registry uses the same deep-freeze + `as const satisfies` pattern |
| `getProfileForCountry(countryCode)` | `packages/classification/src/registry.ts` line 48 | D-01 — policy-package exports a parallel `getPolicyForOutcome(outcome, jurisdiction)` lookup |
| Flag-namespace signoff registry (PENDING/APPROVED + `legalTicketRef` + Zod boot validation) | `packages/feature-flags/src/signoff-registry-flags.ts` + `signoff-registry-flags.json` | D-04 — adds 12 PENDING entries (one per jurisdiction-document pair) to existing JSON; `compliance-policy-engine.<jurisdiction>` namespace |
| Multi-region migration runner | `packages/db/scripts/push-all-regions.ts` | D-08 schema migration applied via this runner; LOCAL-ONLY constraint = manual post-deploy step |
| `writeAuditLog` shared helper + `AuditLog.metadataJson` | `packages/api/src/services/audit-writer.ts`; `packages/db/prisma/schema/audit.prisma` lines 3–28 | D-15 — single audit row per recompute invocation, deltas in `metadataJson` |
| `submit` mutation on classification router | `packages/api/src/routers/classification.ts` line 389 | D-10 — supersession-on-outcome-change branch wires INSIDE this mutation's existing transaction (or new transaction wrap) |
| `date-fns@^4.1.0` already a dep on `apps/web` | `apps/web/package.json` | D-07 — TZ-aware boundary computation uses `formatInTimeZone` from `@date-fns/tz` (date-fns v4 split timezone support into a sub-package) |
| Phase 70 D-04/D-10 LOCAL-ONLY bypass `FLAG_SIGNOFF_BYPASS=local` | `packages/feature-flags/src/registry.ts` boot-time gate | D-04 — engineers develop against PENDING entries via this bypass |
| `tenantBound` / `organizationId` mandatory on every multi-tenant model (Phase 70 lint:schema) | `scripts/lint-schema.mjs` | New columns inherit org-scoping via the model's existing `organizationId`; lint:schema passes for free (no new model added) |

---

## Per-Jurisdiction Document Pin (12-Document Baseline)

> **CRITICAL:** All entries ship `PENDING` in `signoff-registry-flags.ts` per D-04. Researcher provides best-effort legal text; production wording flips PENDING→APPROVED post-deploy via individual PRs that set `legalTicketRef`. Standing Constraint = legal review DEFERRED.

The 12 entries below define the initial registry seeds. Each row maps to one `policyRuleId` per outcome and one PENDING signoff entry. Severity assignments per D-05 (BLOCKING = Phase 72 hard payment block; WARNING = dashboard surfaces; INFO = audit only).

| # | Stable ID | Outcome | Document | DocumentType (enum) | Expiry semantics | TZ | Severity | Notes |
|---|-----------|---------|----------|---------------------|------------------|-----|----------|-------|
| 1 | `uk.right_to_work@v1` | UK B2B (any classification) | UK Right-to-Work share code | `UK_RIGHT_TO_WORK_SHARE_CODE` (new) | 90 days from share-code generation date (Home Office contract; the share code itself, not the underlying status) | `Europe/London` | BLOCKING | Border Security Act 2025 reaffirms employer duty. The code is consumed by the employer within 90 days; we re-prompt at 75 days (band logic in Phase 72). Source: gov.uk/right-to-work-checks |
| 2 | `uk.utr@v1` | UK B2B + sole-trader | HMRC UTR (Unique Taxpayer Reference) | `UK_UTR` (new) | Non-expiring (lifetime) — `expiresAt = null`, `expiryJurisdictionTz = null` | n/a | WARNING | 10-digit number; required for off-payroll IR35 split. Validation: regex `/^\d{10}$/`. |
| 3 | `uk.business_registration@v1` | UK B2B (limited company only) | Companies House registration | `BUSINESS_REGISTRATION` (existing) | Non-expiring; we DO re-validate via Companies House API on cadence (Phase 72 cron) | `Europe/London` | WARNING | Carrier ID = 8-digit company number. Phase 71 only persists the requirement; refresh logic = Phase 72. |
| 4 | `uk.sds@v1` | UK B2B classified IR35-INSIDE | Status Determination Statement | `UK_SDS` (new) | Per-engagement (renewal triggered by reassessment, not a calendar interval) | `Europe/London` | BLOCKING | Required by Chapter 10 ITEPA 2003. Without an SDS the deemed-employer rule does not engage; payment cannot proceed. |
| 5 | `de.a1@v1` | DE classified Selbständig OR ABHANGIG with cross-border | A1-Bescheinigung (Deutsche Rentenversicherung) | `DE_A1_BESCHEINIGUNG` (new) | 24 months max (EU Reg 883/2004 Art 12); usually issued for the engagement duration up to 24 mo | `Europe/Berlin` | BLOCKING | Without A1 the receiving country can claim social-security contributions. We band-warn at 90/60/30 days (Phase 72). |
| 6 | `de.aufenthaltstitel@v1` | DE non-EU contractor | Aufenthaltstitel (residence permit) | `DE_AUFENTHALTSTITEL` (new) | Variable (typed in document); we store the document's stated `expiresAt` | `Europe/Berlin` | BLOCKING | AufenthG §4. Required only for non-EU contractors — registry rule conditional on contractor's nationality (resolved via existing `contractor.nationality` field). |
| 7 | `de.eight_b_estg@v1` | DE construction sector ONLY | §48b EStG Freistellungsbescheinigung | `DE_FREISTELLUNGSBESCHEINIGUNG` (new) | Up to 3 years (issued by Finanzamt); typed expiry on document | `Europe/Berlin` | BLOCKING | Without §48b the principal must withhold 15% Bauabzugsteuer. Conditional rule — only applies when `engagement.sector === 'construction'`. |
| 8 | `pl.zus_a1@v1` | PL with cross-border posting | ZUS A1 (zaświadczenie A1 z ZUS) | `PL_ZUS_A1` (new) | 12 months max (PL implementation tighter than the EU 24-mo ceiling) | `Europe/Warsaw` | BLOCKING | ZUS RUS-3 form; verifies social-insurance coverage in PL. |
| 9 | `pl.udt@v1` | PL contractor operating regulated equipment | UDT certification (Urząd Dozoru Technicznego) | `PL_UDT_CERT` (new) | Variable (per equipment class); typed expiry on document | `Europe/Warsaw` | WARNING | Conditional rule — only when `engagement.requiresRegulatedEquipment === true`. |
| 10 | `ksa.iqama@v1` | KSA cross-border (foreign worker in KSA) | Iqama (residency permit) | `KSA_IQAMA` (new) | 1 year max (renewable; Saudi MOI rule) | `Asia/Riyadh` | BLOCKING | Without Iqama foreign worker payments are illegal. Boundary at 00:00 Asia/Riyadh per success-criterion #2. |
| 11 | `ksa.work_permit_qiwa@v1` | KSA cross-border | Work Permit + Qiwa-portal authorisation boolean | `KSA_WORK_PERMIT` (new) | 1 year max | `Asia/Riyadh` | BLOCKING | Two artefacts in one row: the work-permit document + a verifiable boolean from Qiwa. Phase 71 stores the boolean as `notes: 'qiwa_authorised:true'`; Phase 79 wires the Qiwa API check. |
| 12 | `uae.emirates_id@v1` | UAE cross-border | Emirates ID | `UAE_EMIRATES_ID` (new) | Variable (typed on document; usually 1–3 years) | `Asia/Dubai` | BLOCKING | ICA-issued. |
| 13 | `uae.free_zone_license@v1` | UAE freelancer in a free zone | Free-zone trade license (e.g. DMCC, ADGM) | `UAE_FREE_ZONE_LICENSE` (new) | 1 year (annually renewed) | `Asia/Dubai` | WARNING | License *number* is the canonical identifier; renewal cadence is yearly. |

> **Note:** ROADMAP lists "12 documents" but the canonical breakdown above totals **13 rule rows** (UK has 4 separate documents; the UK SDS-on-IR35-inside is counted as a 13th conditional row). PLAN.md frontmatter for the registry plan should declare 13 PENDING signoff entries.

### Conditional rules (apply only when predicate matches)

The registry's `appliesIf` predicate (TS lambda) per `policyRuleId` keeps the conditional logic inside the typed-const tree, not in the consumer. Examples:

```ts
// packages/compliance-policy/src/policies/de.ts
{
  policyRuleId: 'de.eight_b_estg@v1',
  documentType: 'DE_FREISTELLUNGSBESCHEINIGUNG',
  severity: 'BLOCKING',
  expiryJurisdictionTz: 'Europe/Berlin',
  appliesIf: (engagement: EngagementContext) => engagement.sector === 'construction',
}
```

The classification router calls `resolvePolicyRules({ outcome, jurisdiction, engagement, contractor })` and the registry's pure function filters by `appliesIf`. No outcome-time DB reads beyond the engagement+contractor row already in scope.

---

## Technical Approach Per Decision

### Area 1 — Policy Package Shape (D-01..D-04)

**D-01 — `@contractor-ops/compliance-policy` workspace package layout:**

```
packages/compliance-policy/
├── package.json                    # ESM, name = @contractor-ops/compliance-policy
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                    # Public surface: getPolicyForOutcome, POLICY_RULE_SET_VERSION, types
│   ├── types.ts                    # PolicyRule, PolicyRuleSet, EngagementContext, Severity
│   ├── version.ts                  # POLICY_RULE_SET_VERSION = 'v6.0.0' (matches package.json semver)
│   ├── registry.ts                 # Top-level deepFreeze + resolver
│   ├── policies/
│   │   ├── uk.ts                   # 4 rules (right-to-work, UTR, business-registration, SDS)
│   │   ├── de.ts                   # 3 rules (A1, Aufenthaltstitel, §48b EStG)
│   │   ├── pl.ts                   # 2 rules (ZUS A1, UDT)
│   │   ├── ksa.ts                  # 2 rules (Iqama, work permit + Qiwa)
│   │   └── uae.ts                  # 2 rules (Emirates ID, free-zone license)
│   └── __tests__/
│       ├── registry.test.ts        # asserts every PENDING entry present in signoff JSON
│       ├── version.test.ts         # asserts POLICY_RULE_SET_VERSION matches package.json
│       └── resolve.test.ts         # 4 ROADMAP success criteria fixtures (UK B2B → 4 rows; DE ABHANGIG → 3 rows; etc.)
```

**D-02 — `policyRuleId` shape:**

```ts
export type PolicyRuleId = `${string}.${string}@v${number}`;
// Examples: 'uk.right_to_work@v1', 'de.a1@v1', 'ksa.iqama@v1'
```

Stable namespace = everything before `@v`. Drift comparison (D-09) groups by stable namespace.

**D-03 — `POLICY_RULE_SET_VERSION` semver-from-package.json:**

Single const exported from `packages/compliance-policy/src/version.ts`. Generated at build time via a tiny build script reading `package.json.version`. Mirrors how `KOSIT_RULE_SET_VERSION` is defined in `packages/einvoice` (referenced from `packages/api/src/services/einvoice-finalize.ts:58`).

```ts
// packages/compliance-policy/src/version.ts (committed; updated when package.json version bumps)
export const POLICY_RULE_SET_VERSION = 'v6.0.0' as const;
```

A vitest assertion (`version.test.ts`) cross-checks `version.ts` against `package.json` to catch out-of-sync bumps.

**D-04 — 13 PENDING entries in `signoff-registry-flags.json`:**

Append (not replace) to the existing Phase 70 JSON. Keys use `compliance-policy-engine.<jurisdiction>.<doc-stable-id>`:

```json
{
  "compliance-policy-engine.uk.right_to_work": { "status": "PENDING" },
  "compliance-policy-engine.uk.utr": { "status": "PENDING" },
  "compliance-policy-engine.uk.business_registration": { "status": "PENDING" },
  "compliance-policy-engine.uk.sds": { "status": "PENDING" },
  "compliance-policy-engine.de.a1": { "status": "PENDING" },
  "compliance-policy-engine.de.aufenthaltstitel": { "status": "PENDING" },
  "compliance-policy-engine.de.eight_b_estg": { "status": "PENDING" },
  "compliance-policy-engine.pl.zus_a1": { "status": "PENDING" },
  "compliance-policy-engine.pl.udt": { "status": "PENDING" },
  "compliance-policy-engine.ksa.iqama": { "status": "PENDING" },
  "compliance-policy-engine.ksa.work_permit_qiwa": { "status": "PENDING" },
  "compliance-policy-engine.uae.emirates_id": { "status": "PENDING" },
  "compliance-policy-engine.uae.free_zone_license": { "status": "PENDING" }
}
```

Each entry's `compliance-policy-engine.<jurisdiction>.<doc>` flag key is **NOT** registered in `packages/feature-flags/src/registry.ts` — these signoff entries gate **legal text approval**, not runtime flag toggling. The Phase 70 D-10 boot gate iterates `FLAG_KEYS` (the runtime registry) and matches against `GATED_FLAG_NAMESPACE_PREFIXES` (`compliance-`); since these legal-signoff keys live ONLY in the JSON and not in `FLAGS`, they don't trigger the boot gate. They are surfaced by Phase 73's compliance-admin dashboard via `getAllPendingFlags()` (already exported by `signoff-registry-flags.ts`).

> **Discrepancy note:** This deviates slightly from CONTEXT.md D-04's wording which says "compliance-policy-engine flag stays PENDING". Two ways to reconcile:
> 1. Treat each `compliance-policy-engine.<jurisdiction>.<doc>` as a **legal-text signoff entry only** (in JSON), not a runtime flag. — RECOMMENDED. Keeps the PENDING/APPROVED legal lifecycle separate from feature gating.
> 2. Also register a single umbrella `compliance-policy-engine` entry in the runtime FLAGS registry (default `true` since this is enforcement infrastructure, not a feature toggle).
>
> Plan 71-02 (registry seeds) ships approach 1. If reviewers prefer approach 2, the umbrella flag is a one-line addition; the 13 per-document signoff entries stay in JSON either way.

**Local dev:** Engineers set `FLAG_SIGNOFF_BYPASS=local` (Phase 70) to develop against PENDING entries without boot failure. CI sets `FLAG_SIGNOFF_BYPASS=` (empty).

### Area 2 — Schema Migration (D-05..D-08)

**Single migration adds:**

```prisma
// packages/db/prisma/schema/contractor.prisma — ContractorComplianceItem additions
model ContractorComplianceItem {
  // ... existing fields ...
  severity                Severity?       // D-05 — null pre-backfill
  policyRuleId            String?         // D-06 — value-checked at write against registry
  expiryJurisdictionTz    String?         // D-07 — IANA TZ string
  waivedReason            WaivedReason?   // D-11 — populated only when status = WAIVED
  // ... existing relations + indexes ...
  @@index([organizationId, policyRuleId])  // new — supports drift queries by stable namespace
}

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

**ClassificationAssessment addition (D-03 snapshot):**

```prisma
// packages/db/prisma/schema/classification.prisma — ClassificationAssessment addition
model ClassificationAssessment {
  // ... existing fields ...
  policyRuleSetVersion String?  // D-03 — null pre-backfill, set on every new submit
}
```

**D-08 two-step migration:**
- Step 1 (Plan 71-04): Single Prisma migration `add_compliance_policy_columns_v6` adds 4 cols + 2 enums to `ContractorComplianceItem` + 1 col to `ClassificationAssessment`. All NULLABLE. `pnpm lint:schema` (Phase 70) verifies no missing `organizationId` on existing models.
- Step 2 (Plan 71-07 backfill): Idempotent script re-runs classification logic over each contractor's last `completed` `ClassificationAssessment` to populate `policyRuleId`, `severity`, `expiryJurisdictionTz` on existing `ContractorComplianceItem` rows. `WHERE policyRuleId IS NULL` precondition makes it safe to re-run.

**Migration runner:** Author the schema migration in a Plan marked `autonomous: false` (mirrors Phase 70 Plan 70-09 precedent — multi-region apply + visual review of generated SQL). Backfill script lives at `packages/db/scripts/backfill-compliance-policy.ts`, structurally identical to `packages/db/scripts/backfill-scope-capabilities.ts` shape (single-region per invocation; documented multi-region usage).

### Area 3 — Classification Supersession (D-09..D-12)

**D-10 — supersession-on-outcome-change inside `submit` mutation:**

The existing `submit` (line 389 of `classification.ts`) is NOT currently wrapped in a transaction. We wrap the existing mutation body (lines 390–460) in `ctx.db.$transaction(async (tx) => { ... })` and add the supersession branch:

```ts
// packages/api/src/routers/classification.ts — `submit` mutation refactor
submit: contractorUpdateProcedure.input(submitInput).mutation(async ({ ctx, input }) => {
  return ctx.db.$transaction(async (tx) => {
    // ... existing read of `row`, scoring, snapshot building ...

    // Find the prior completed assessment (if any) on the same engagement.
    const prior = await tx.classificationAssessment.findFirst({
      where: {
        contractorAssignmentId: row.contractorAssignmentId,
        status: 'completed',
      },
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
        policyRuleSetVersion: POLICY_RULE_SET_VERSION,  // D-03 snapshot
      },
    });

    // D-10 supersession on outcome change.
    const outcomeChanged =
      prior &&
      // discriminated outcome equality — see notes below
      !outcomesEqual(prior.outcome, validatedOutcome);

    if (outcomeChanged) {
      await supersedeAndMaterialise(tx, {
        organizationId: ctx.organizationId,
        contractorId: assignment.contractorId,
        engagement: { id: assignment.id, jurisdiction: profile.country, sector: assignment.sector ?? null },
        outcome: validatedOutcome,
        reason: 'classification_outcome_change',
      });
    } else if (!prior) {
      // First classification ever — no supersession needed; just materialise.
      await materialiseFromPolicy(tx, {
        organizationId: ctx.organizationId,
        contractorId: assignment.contractorId,
        engagement: { id: assignment.id, jurisdiction: profile.country, sector: assignment.sector ?? null },
        outcome: validatedOutcome,
      });
    }

    // ... existing reassessment-trigger update ...
    return updated;
  });
}),
```

`outcomesEqual()` is a shallow equality on `outcome.kind` (the discriminator, e.g. `'IR35-INSIDE'` vs `'IR35-OUTSIDE'`). If the kind matches, no row churn even when sub-fields differ.

**D-12 carry-forward shape (inside `supersedeAndMaterialise`):**

```ts
async function supersedeAndMaterialise(tx, ctx) {
  const oldRows = await tx.contractorComplianceItem.findMany({
    where: { contractorId: ctx.contractorId, status: { not: 'WAIVED' } },
  });
  const newRules = resolvePolicyRules({ ... });

  const oldByDocType = new Map(oldRows.map(r => [r.documentType, r]));

  // Mark every existing row WAIVED with reason
  await tx.contractorComplianceItem.updateMany({
    where: { id: { in: oldRows.map(r => r.id) } },
    data: { status: 'WAIVED', waivedReason: ctx.reason },
  });

  // Insert new rows; carry forward satisfiedByDocumentId when documentType matches
  for (const rule of newRules) {
    const carryFrom = oldByDocType.get(rule.documentType);
    await tx.contractorComplianceItem.create({
      data: {
        organizationId: ctx.organizationId,
        contractorId: ctx.contractorId,
        contractId: ctx.engagement.id,
        documentType: rule.documentType,
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

### Area 4 — Admin Recompute (D-13..D-16)

**D-13/D-14/D-15/D-16 — `recreateComplianceAssessment` mutation:**

Sibling of `recreateDraftAfterDrift` at the same line range (~line 233 of `classification.ts`). New file location is debatable — three options:

1. Same router file (`classification.ts`) — RECOMMENDED, keeps the architectural twin visible. Phase 73 may extract to a `compliance-admin.ts` router when more admin actions land.
2. New `compliance-admin.ts` router — premature factoring at Phase 71 (only 1 mutation).
3. New `compliance.ts` router — confusing because the data model already uses "compliance" for `ContractorComplianceItem`.

**Decision: option 1.** Mutation lives next to `recreateDraftAfterDrift` in `classification.ts`. The naming makes the parallel obvious to future readers.

```ts
// packages/api/src/routers/classification.ts — new mutation
const recreateComplianceAssessmentInput = z.object({
  contractorIds: z.array(z.string().cuid()).min(1).max(500),  // bulk cap
  reason: z.enum(['policy_version_bump', 'classification_outcome_change', 'admin_correction']),
});

recreateComplianceAssessment: complianceAdminProcedure  // new procedure with admin role check
  .input(recreateComplianceAssessmentInput)
  .mutation(async ({ ctx, input }) => {
    const results = await Promise.all(
      input.contractorIds.map(contractorId =>
        ctx.db.$transaction(async (tx) => {
          // D-16 idempotent precondition
          const latest = await tx.classificationAssessment.findFirst({
            where: { contractorAssignment: { contractorId }, status: 'completed' },
            orderBy: { completedAt: 'desc' },
          });
          if (!latest) return { contractorId, noop: true, reason: 'no_completed_assessment' };
          if (
            latest.policyRuleSetVersion === POLICY_RULE_SET_VERSION &&
            input.reason === 'policy_version_bump'
          ) {
            return { contractorId, noop: true, reason: 'already_current' };
          }

          // Read deltas BEFORE the supersede (for audit log)
          const before = await tx.contractorComplianceItem.findMany({
            where: { contractorId, status: { not: 'WAIVED' } },
            select: { id: true, status: true, policyRuleId: true },
          });

          await supersedeAndMaterialise(tx, { ... });

          const after = await tx.contractorComplianceItem.findMany({
            where: { contractorId, status: { not: 'WAIVED' } },
            select: { id: true, status: true, policyRuleId: true },
          });

          return { contractorId, before, after, policyRuleSetVersionBefore: latest.policyRuleSetVersion };
        }),
      ),
    );

    // D-15 — single audit row per invocation
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

**`complianceAdminProcedure`:** new tRPC procedure factory in `packages/api/src/trpc.ts` (or wherever procedures live) that requires `session.user.role` ∈ `{ 'OWNER', 'ADMIN' }` AND a feature-flag check for `compliance-admin-tools` (registered in Phase 73; Phase 71 falls back to existing `adminProcedure` if it already exists).

**Existing admin procedure:** Quick check during planning — search for `adminProcedure` in `packages/api/src/trpc.ts` and reuse if available; else introduce `complianceAdminProcedure` as an aliased export.

### Area 5 — TZ Boundary Computation (D-07)

**Library choice:** `date-fns` v4 with the `@date-fns/tz` sub-package (the v4 split moved TZ helpers out of the core to keep tree-shake budgets tight). Already present in repo via `apps/web/package.json: "date-fns": "^4.1.0"`. The new package adds `@date-fns/tz` as a dep.

```ts
// packages/compliance-policy/src/expiry.ts
import { TZDate } from '@date-fns/tz';
import { isAfter, startOfDay } from 'date-fns';

/**
 * Resolves whether `expiresAt` (a calendar date stored as `@db.Date`) has
 * already passed in the contractor's jurisdiction TZ. "Expires today" boundary
 * is 00:00 in `expiryJurisdictionTz`, NOT in the org HQ TZ.
 *
 * Success criterion #2: a Riyadh contractor's "expires today" must resolve at
 * 00:00 Asia/Riyadh, regardless of where the org's HQ is. The TZ is set on
 * row-creation (D-07) from the engagement's jurisdiction; never rewritten.
 */
export function isExpired(expiresAt: Date, expiryJurisdictionTz: string, now: Date = new Date()): boolean {
  const startOfToday = startOfDay(new TZDate(now, expiryJurisdictionTz));
  // expiresAt is @db.Date — already a calendar boundary; treat as 00:00 of that day in the TZ
  const expiryBoundary = startOfDay(new TZDate(expiresAt, expiryJurisdictionTz));
  // Expired iff today is strictly after the expiry boundary
  return isAfter(startOfToday, expiryBoundary);
}
```

The function is pure; tested with fixed `now` against three boundary cases:
- `now = 2026-04-27T00:30:00Z`, contractor in `Asia/Riyadh` (UTC+3 → 03:30 local), `expiresAt = 2026-04-27` → NOT expired (still today).
- `now = 2026-04-27T22:30:00Z` (= 01:30 next-day Riyadh), `expiresAt = 2026-04-27` → expired.
- `now = 2026-04-27T00:30:00Z`, contractor in `Pacific/Honolulu` (UTC-10 → 14:30 prev-day), `expiresAt = 2026-04-27` → NOT expired.

### Area 6 — Schema Lint Compatibility

The Phase 70 `pnpm lint:schema` guard enforces `organizationId` on multi-tenant models. We are NOT adding new models — only columns + enums. The lint guard passes unchanged. The new index `@@index([organizationId, policyRuleId])` is a recommended addition for D-13's drift queries; it satisfies the existing tenant-scoping rule (org-id-prefixed).

---

## Validation Architecture (Nyquist sampling)

> Every plan in this phase ships failing tests in Wave 0; subsequent waves turn them green. Per-package vitest runtime <3s. Multi-region migration apply is the only manual step (mirrors Phase 70 Plan 09 precedent).

| Guard / Behaviour | Sample point | Sample rate | Detection latency |
|---|---|---|---|
| Policy registry shape (D-01/D-02) | `pnpm --filter @contractor-ops/compliance-policy test registry` — asserts every rule has `policyRuleId` matching `^[a-z]+\.[a-z_]+@v\d+$` | <1s | Per-PR CI + pre-push |
| `POLICY_RULE_SET_VERSION` matches package.json | `pnpm --filter @contractor-ops/compliance-policy test version` | <1s | Per-PR CI |
| Resolver returns correct rule set per outcome | `pnpm --filter @contractor-ops/compliance-policy test resolve` — 4 ROADMAP success-criteria fixtures | <2s | Per-PR CI |
| Schema migration adds 4 cols + 2 enums + 1 col on ClassificationAssessment | `pnpm --filter @contractor-ops/db db:generate && grep -q 'severity' packages/db/generated/...` | <3s | Per-PR CI |
| Migration SQL has no DROP/RENAME (T-71-04-04) | grep on generated `migration.sql` | <1s | Pre-PR (manual review per `autonomous: false`) |
| TZ boundary correctness (D-07) | `pnpm --filter @contractor-ops/compliance-policy test expiry` — 6 fixed-now fixtures across 5 jurisdictions | <2s | Per-PR CI |
| Supersession on outcome change (D-10) | `pnpm --filter @contractor-ops/api test classification-supersession` — integration test with Prisma test util, asserts old rows WAIVED, new rows inserted, transactional atomicity | <5s | Per-PR CI |
| Document carry-forward on supersession (D-12) | Same integration test — asserts `satisfiedByDocumentId` copied when `documentType` matches | <5s | Per-PR CI |
| Idempotency precondition (D-16) | `pnpm --filter @contractor-ops/api test classification-recompute` — second invocation returns `noop: true` | <5s | Per-PR CI |
| Audit log emission (D-15) | Same recompute test — asserts exactly 1 `auditLog.create` call per invocation, deltas in `metadataJson` | <2s | Per-PR CI |
| Backfill is idempotent | `pnpm --filter @contractor-ops/db test backfill-compliance-policy` — `WHERE policyRuleId IS NULL` precondition | <2s | Per-PR CI |
| 13 PENDING signoff entries present | `pnpm --filter @contractor-ops/feature-flags test signoff-registry-flags` extension — asserts every `compliance-policy-engine.<jurisdiction>.<doc>` key exists with status `PENDING` | <1s | Per-PR CI |
| Web UI: per-contractor recompute button | RTL test on contractor profile compliance tab — clicking button calls mutation with single contractorId | <2s | Per-PR CI |
| Web UI: bulk recompute action | RTL test on contractors-list page — selection + action calls mutation with N contractorIds | <2s | Per-PR CI |

**Sample artefact (Nyquist Dimension 8):** the 4 ROADMAP success criteria are encoded as 4 vitest fixtures committed in `packages/api/src/__tests__/classification-supersession.test.ts` — these serve as both the audit record AND the regression baseline.

---

## Plan Sequencing (proposed)

Strategy: **failing tests first** (Wave 0) → **package + registry seeds in parallel** (Wave 1) → **schema + classification mutation refactor** (Wave 2, depends on Wave 1's TS contracts) → **admin recompute mutation + UI surfaces + backfill** (Wave 3, depends on Wave 2's transactional helper).

| Wave | Plan | Title | Decisions covered | Requirements covered | autonomous |
|---|---|---|---|---|---|
| 0 | 71-01 | Failing test scaffolds + 13 PENDING signoff entries + new `@contractor-ops/compliance-policy` package skeleton | D-01 D-04 | All — RED state for COMPL-02/08/09/10 | true |
| 1 | 71-02 | `@contractor-ops/compliance-policy` typed-const tree (5 jurisdiction modules + resolver + version + expiry helper) | D-01 D-02 D-03 D-07 | COMPL-09 | true |
| 2 | 71-03 | `ContractorComplianceItem` + `ClassificationAssessment` schema migration (4 cols + 2 enums + 1 col + index) | D-05 D-06 D-07 D-08 D-11 | COMPL-08 | **false** (multi-region apply per push-all-regions; manual review of generated SQL per Plan 70-09 precedent) |
| 2 | 71-04 | `submit` mutation transactional refactor + supersession-on-outcome-change branch + `materialiseFromPolicy` helper + `supersedeAndMaterialise` helper | D-09 D-10 D-11 D-12 | COMPL-02 | true |
| 3 | 71-05 | `recreateComplianceAssessment` tRPC mutation + idempotency precondition + audit-log emission | D-13 D-14 D-15 D-16 | COMPL-10 | true |
| 3 | 71-06 | Per-contractor "Recompute compliance" button (profile compliance tab) + bulk action on contractors-list page (functional UI; Phase 73 polishes) | D-13 | COMPL-10 | true |
| 3 | 71-07 | Idempotent backfill script for existing rows + multi-region usage docs | D-08 | COMPL-08 (backfill side) | **false** (manual per-region run) |

**Why this sequencing:**
- Wave 0 establishes failing tests for every acceptance criterion — Nyquist requires test-first.
- Wave 1's package + seeds are independent of schema; can land before the Prisma migration.
- Wave 2's schema migration is gated by `autonomous: false` — multi-region apply mirrors Phase 70 Plan 09 precedent. The mutation refactor is a separate plan because the surface area (transactional wrap, supersession helper) is large.
- Wave 3's admin mutation depends on the supersession helper from Plan 71-04; the UI surface depends on the mutation contract; the backfill depends on the schema columns existing.

Plan count: **7 plans** across **4 waves**. Estimated executor effort: ~2–3 hours per plan, ~16h total — proportionate for first-feature delivery in v6.0.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Legal text drift — production wording changes after `signoff-registry-flags.ts` is APPROVED, but registry seeds have already been bumped to `@v2`-suffixed IDs | MEDIUM | LOW | The `@vN` suffix is **engineering versioning**, not legal versioning. Legal text changes flip the JSON's `legalTicketRef` to a new ticket; only structurally-meaningful changes (different `documentType`, different `severity`, different `appliesIf` predicate) bump the `@vN`. Documented in 71-PATTERNS.md. |
| `submit` mutation transactional wrap breaks an existing caller that relied on partial commit semantics | LOW | MEDIUM | Wave 0 ships an integration test asserting the existing `submit` happy path works unchanged (UK B2B fresh draft, no prior assessment). Defensive: existing test in `packages/api/src/__tests__/classification-submit.test.ts` if present; new fixture if not. |
| Carry-forward map's `documentType` equality misses a renamed enum value | LOW | LOW | The carry-forward is keyed by `documentType` enum literal — renames would be a breaking schema change caught at compile time. New doc-type values (UK_RIGHT_TO_WORK_SHARE_CODE, DE_A1_BESCHEINIGUNG, …) are introduced in this same phase, so the map is internally consistent. |
| Multi-region migration applies to EU but not ME (or vice versa) | LOW | HIGH | LOCAL-ONLY constraint means there's no production multi-region today. Plan 71-03 marked `autonomous: false`; Plan 71-07 backfill documented as manual per-region run mirroring Phase 70 Plan 09. Verification post-deploy. |
| `complianceAdminProcedure` does not exist; new procedure factory needed | MEDIUM | LOW | Plan 71-05 has a sub-task to introduce or alias the procedure factory if missing. Existing `adminProcedure` likely exists from Phase 5x onboarding work. |
| 13 PENDING flags trip the Phase 70 boot gate | LOW | HIGH (boots fail in CI/dev) | The 13 entries are signoff-only (in JSON), not flag-registry entries (in `FLAGS`). Phase 70 boot gate iterates `FLAG_KEYS` (registry) and matches against `GATED_FLAG_NAMESPACE_PREFIXES` — JSON-only entries never pass through the gate. Verified by a vitest assertion in Plan 71-02. |
| `outcomesEqual` shallow comparison misses semantic equivalence (e.g., IR35-INSIDE with different sub-fields but same kind) | LOW | LOW | We compare on `outcome.kind` only — the rule-set is keyed by kind, so kind equality = same rule set = no churn. Documented in 71-PATTERNS.md. |
| Conditional rules (`appliesIf`) read fields not yet present on `engagement` (e.g., `sector`, `requiresRegulatedEquipment`) | MEDIUM | MEDIUM | Quick check during Plan 71-02: `ContractorAssignment.sector` and `nationality` fields' presence. If absent, plan adds nullable string columns or treats `appliesIf` predicate as `false` (conservative — no rule applies, no enforcement). Documented in plan acceptance criteria. |

---

## Open Questions (resolved during planning, not blocking)

1. **Should the `@v1` suffix be omitted in stable namespace mapping (D-09)?**
   → No. Stable namespace = `'uk.right_to_work'` (no version). `@v1` is the version. Drift compares stable namespace; the version is a property of the rule, not part of the namespace. Encoded as a parsing helper `parsePolicyRuleId(id)` in `packages/compliance-policy/src/types.ts`.

2. **Can the schema migration land with the registry package empty (PENDING flags only)?**
   → Yes. The schema is independent of the registry's content. The migration ships in Plan 71-03 (Wave 2) with the columns nullable; the registry's typed-const seeds ship in Plan 71-02 (Wave 1). They land in either order without conflict.

3. **Does `submitClassification` exist as a separate mutation, or is `submit` (line 389) the right hook?**
   → CONTEXT.md D-10 says "submitClassification" but the actual router has it as `submit`. Both names appear acceptable; we use the existing name. Plan 71-04 wires the supersession branch into `submit`.

4. **Does `ContractorAssignment` have a `sector` field?**
   → To be confirmed during Plan 71-02 read_first. If absent, the `de.eight_b_estg@v1` rule's `appliesIf` predicate falls back to `false` (no §48b rule emitted). A separate phase or follow-up plan would add the column.

5. **Does the codebase have an `adminProcedure` factory?**
   → To be confirmed in Plan 71-05 read_first. Common pattern in tRPC monorepos; likely exists via auth-gating middleware.

---

## RESEARCH COMPLETE
