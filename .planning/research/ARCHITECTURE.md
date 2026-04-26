# Architecture Research — v6.0 Platform Maturity & Operational Hardening

**Domain:** B2B contractor ops SaaS — adding 4 feature areas to an existing production-grade Turborepo monorepo (Next.js 15, tRPC v11, Prisma 7, Better Auth, Neon multi-region, R2, QStash, Unleash).
**Researched:** 2026-04-26
**Confidence:** HIGH — direct file-level verification against existing schema, routers, services, and adapter contracts.

---

## 0. Existing Architecture Reference (verified by file inspection)

These existing surfaces are the load-bearing extension points for v6.0. Names verified:

| Surface | Location | Relevance to v6.0 |
|---|---|---|
| `WorkflowTaskType` enum (10 values incl. `ACCESS_REVOKE`, `KNOWLEDGE_TRANSFER`) | `packages/db/prisma/schema/workflow.prisma:173` | F2 trigger, F4 task types — already present |
| `ComplianceRequirementTemplate` + `ContractorComplianceItem` + `ComplianceStatus` | `packages/db/prisma/schema/contractor.prisma:209-285` | F1 — extend, do NOT build parallel models |
| `IntegrationProviderAdapter` interface | `packages/integrations/src/types/provider.ts` | F2 — extend with capability mixin |
| `IntegrationProvider` enum (already includes `GOOGLE_WORKSPACE`, `MICROSOFT_365`, `MICROSOFT_TEAMS`, `GITHUB`, `SLACK`) | `packages/db/prisma/schema/integration.prisma:101` | F2 — re-use, add `OKTA`, `ENTRA_ID` (treat distinct from `MICROSOFT_365`) |
| `EInvoiceProfile` country-profile interface | `packages/einvoice/src/types/profile.ts` | F1, F3 — copy-by-pattern for `CompliancePolicyProfile` and `GulfRegulatoryProfile` |
| `ClassificationAssessment` + `outcome Json` per-engagement | `packages/db/prisma/schema/classification.prisma:15` | F1 — input to required-doc rule resolver |
| `paymentRouter.create` mutation | `packages/api/src/routers/payment.ts:352` | F1 — payment-block hook site |
| `notification-service.ts` dispatch with provider iteration | `packages/api/src/services/notification-service.ts` | F1, F4 — reuse for reminder fan-out (no new infra) |
| Feature-flag wrapper with `PENDING → APPROVED` CI gate | `packages/feature-flags/` | All 4 features — gate every legal-sensitive surface |
| `WorkflowRun.status BLOCKED` + `WorkflowTaskStatus.BLOCKED` | `workflow.prisma:205-220` | F4 — IP verification block already representable, no schema change needed |
| `equipment-workflow.ts` auto-completion (shipment status → task DONE) | `packages/api/src/services/equipment-workflow.ts` | F2, F4 — proven pattern for "external event → close task" |
| `Document` + `DocumentLink` (R2 + ClamAV + EntityType-based linking) | `packages/db/prisma/schema/contract.prisma:105` | F1 — uploaded compliance docs already have a home |
| QStash cron + distributed-lock pattern (e.g. `boe-base-rate-poller.ts`, `economic-dependency-scan.ts`) | `packages/integrations/src/services/`, `packages/api/src/services/` | F1, F2, F3 — reuse for expiry sweeps + Saudization recompute + IdP retry |
| `IR35Chain`, `EconomicDependencyAlertState`, `ReassessmentTrigger` band-state-machine cron | `packages/api/src/services/economic-dependency-scan.ts` | F1 — exact analog for 90/60/30/15/7-day reminder state machine |

---

## 1. Feature 1 — Compliance Document Lifecycle Engine

### 1.1 Package boundary decision

**Decision: Extend `packages/db` + `packages/api` + new thin `packages/compliance-policy`. Do NOT duplicate `ComplianceRequirementTemplate`.**

| Concern | Where it lives | Rationale |
|---|---|---|
| Per-country/engagement-type/classification-outcome **rule definitions** (data) | New `packages/compliance-policy/src/profiles/{pl,uk,de,uae,sa}/` | Mirrors proven `packages/einvoice/profiles/*` and `packages/classification/profiles/*` country-profile pattern. Pure functions + static rule sets. Zero DB. |
| **Rule evaluation** (engagement → required-doc list) | `packages/compliance-policy/src/engine/resolve-requirements.ts` | Stateless, testable in isolation; consumes classification outcome JSON + contractor country + engagement type → returns `RequiredDocSpec[]`. |
| **Persisted instances** (uploaded doc → requirement match, expiry, status) | Existing `ContractorComplianceItem` (extended with `severity`, `policyRuleId`, `lastReminderBand`) | The model already exists — reusing eliminates a parallel system. |
| **Templates seeded per-org** | Existing `ComplianceRequirementTemplate` | Same — already has `appliesToContractorType`, `documentType`, `expires`, `defaultValidityDays`. Add `severity ComplianceSeverity` and `appliesToCountry String? @db.Char(2)`. |
| **API surface (CRUD + dashboard + payment-block check)** | New `packages/api/src/routers/compliance.ts` + new `packages/api/src/services/compliance-policy-evaluator.ts` (thin wrapper over `compliance-policy` package) | Routers belong with routers; service layer adapts pure engine to Prisma. |
| **Reminder cron (90/60/30/15/7/expired bands)** | New `packages/api/src/services/compliance-expiry-scan.ts` invoked by new QStash cron `/api/cron/compliance-expiry-scan` | Direct copy of `economic-dependency-scan.ts` band-state-machine pattern with `ReminderInstance` outbox. |

### 1.2 Schema delta (additive, no destructive migration)

```prisma
// contractor.prisma — extend existing models
model ComplianceRequirementTemplate {
  // ... existing fields ...
  severity            ComplianceSeverity @default(STANDARD)   // NEW
  appliesToCountry    String?            @db.Char(2)           // NEW
  appliesToEngagementType ContractType?                        // NEW
  policyRuleId        String?                                  // NEW — references compliance-policy package rule ID
  blocksPayment       Boolean            @default(false)       // NEW (only honoured when severity=CRITICAL)
}

model ContractorComplianceItem {
  // ... existing fields ...
  severity            ComplianceSeverity @default(STANDARD)   // NEW (denormalised from template at create time so policy rotations don't retroactively change history)
  policyRuleId        String?                                  // NEW
  lastReminderBand    ReminderBand?                            // NEW — null|D90|D60|D30|D15|D7|EXPIRED
  lastReminderAt      DateTime?                                // NEW
  blocksPaymentAt     DateTime?                                // NEW — set when status=EXPIRED && severity=CRITICAL
}

enum ComplianceSeverity { CRITICAL STANDARD ADVISORY }
enum ReminderBand      { D90 D60 D30 D15 D7 EXPIRED }
```

**Justification for extension over new models:** The existing `ComplianceRequirementTemplate.expires` + `defaultValidityDays` + `ContractorComplianceItem.expiresAt` already encodes 90% of the policy primitive. Adding parallel `ComplianceDocumentRequirement` would split a single concept across two tables and force every existing query in `contractorRouter` (compliance-health scoring) to be rewritten. Severity + policyRuleId are the only missing primitives.

### 1.3 Payment-block enforcement — TWO hooks (defence in depth)

The existing `paymentRouter.create` mutation at `packages/api/src/routers/payment.ts:352` is the **primary** gate. Approval-engine condition is the **secondary** gate so a stale READY queue can't be force-pushed by an admin who bypasses the run wizard.

**Primary hook (hard gate at run creation):**

```
paymentRouter.create({ invoiceIds }) →
  // existing: idempotency cache + tx
  → preCheck: complianceGate.assertPayable({ contractorIds })
      → query ContractorComplianceItem
        WHERE contractorId IN (…)
          AND status = 'EXPIRED'
          AND severity = 'CRITICAL'
          AND blocksPaymentAt <= now()
      → if any: throw TRPCError({ code: 'PRECONDITION_FAILED',
                                   data: { code: 'COMPLIANCE_EXPIRED',
                                           items: [{contractorId, name, expiredAt}] } })
  → existing logic continues (PaymentRun + PaymentRunItem inserts)
```

**Secondary hook (approval engine condition):**
The existing `ApprovalChainConfig` already supports condition-based routing (per v1.0 ship-list). Add a new condition operator `complianceCritical(EXPIRED) === true` evaluated in `approval-engine.ts`. When approval submits a payment-eligible decision, evaluator queries the same compliance gate; if expired-critical present, decision is held in `PENDING_COMPLIANCE` state with surface notification and inline "view at-risk docs" deep link.

**Rationale for two hooks:** Single hook at `paymentRouter.create` catches the wizard flow but not the auto-`READY` transition that occurs when an approval flow completes. Adding the approval-engine condition closes the loop without requiring callers to remember the gate.

### 1.4 Classification-engine interaction (IR35 / Scheinselbständigkeit)

**Decision: Classification outcome is INPUT to the policy resolver, never the policy itself.**

```
ContractorAssignment created/updated
  → classification submit (existing — packages/api/src/routers/classification.ts)
    → ClassificationAssessment.outcome populated (Json: { verdict: 'OUTSIDE_IR35'|'INSIDE_IR35'|'SELBSTANDIG'|'ABHANGIG'|… })
    → fire-and-forget: complianceGate.reconcileRequirements(assignmentId)
      → load classification outcome + contractor.countryCode + contract.contractType
      → call compliance-policy.resolveRequirements({ country, engagementType, classificationOutcome })
        → returns RequiredDocSpec[] (e.g. for OUTSIDE_IR35: SDS + business-registration; for INSIDE_IR35: PAYE-engagement-letter + employment-rights-acknowledgement; for ABHANGIG: full Statusfeststellungsverfahren bundle)
      → DIFF against existing ContractorComplianceItem rows for that assignment
        → INSERT new requirements with status=MISSING
        → mark superseded ones status=WAIVED with reason='classification_outcome_change'
        → never DELETE (audit trail preserved)
```

The `compliance-policy` package owns the rules (e.g. "UK + B2B_MASTER_SERVICE + OUTSIDE_IR35 → these 4 docs"). Classification owns the verdict. Compliance-engine owns the persisted instances. Each package has one job.

### 1.5 Reminder cron state machine

Direct port of `economic-dependency-scan.ts` band-state-machine:

```
Daily 02:00 UTC → /api/cron/compliance-expiry-scan
  for each ContractorComplianceItem WHERE expiresAt IS NOT NULL AND status IN (SATISFIED, EXPIRED):
    band = computeBand(expiresAt - now)   // D90|D60|D30|D15|D7|EXPIRED|null
    if band !== lastReminderBand:
      dispatchNotification(type=COMPLIANCE_DOC_EXPIRING, band, recipients=[admin, contractor-portal])
      update lastReminderBand=band, lastReminderAt=now
      if band === EXPIRED && severity === CRITICAL:
        update status=EXPIRED, blocksPaymentAt=now
        dispatchNotification(type=COMPLIANCE_PAYMENT_BLOCK, severity=CRITICAL)
```

Idempotency via `NotificationCronDedup` (already exists in `notification.prisma:104`).

### 1.6 Files touched (concrete)

**New:**
- `packages/compliance-policy/` (new package) — `src/profiles/{pl,uk,de,uae,sa}/index.ts`, `src/engine/resolve-requirements.ts`, `src/types/{policy-rule,required-doc}.ts`
- `packages/api/src/routers/compliance.ts`
- `packages/api/src/services/compliance-policy-evaluator.ts`
- `packages/api/src/services/compliance-expiry-scan.ts`
- `apps/web/src/app/api/cron/compliance-expiry-scan/route.ts`
- `apps/web/src/app/[locale]/(app)/compliance/dashboard/page.tsx` (At-Risk Contractors view + drill-down)
- `packages/db/prisma/schema/contractor.prisma` migration (severity / policyRuleId / lastReminderBand / blocksPaymentAt)

**Modified:**
- `packages/api/src/routers/payment.ts:352` — inject `complianceGate.assertPayable` preCheck
- `packages/api/src/services/approval-engine.ts` — register `complianceCritical` condition operator
- `packages/api/src/routers/classification.ts` — fire-and-forget reconcile on submit/reassess
- `packages/api/src/routers/document.ts` (existing — for DocumentLink) — when `DocumentType` matches a missing requirement and document is uploaded, auto-mark `ContractorComplianceItem.status=SATISFIED`, set `expiresAt` from template
- `packages/api/src/routers/contractor.ts` — extend compliance-health scoring with `severity` weighting
- `packages/validators/src/notifications.ts` — register `COMPLIANCE_DOC_EXPIRING_*`, `COMPLIANCE_PAYMENT_BLOCK`
- `packages/feature-flags/src/registry.ts` — add `compliance-policy-engine` flag (legal-sensitive → PENDING)

---

## 2. Feature 2 — Identity Provider Deprovisioning

### 2.1 Adapter pattern decision

**Decision: Extend the existing `IntegrationProviderAdapter` interface with an optional `Deprovisionable` capability mixin. Do NOT create a parallel `packages/deprovisioning` package.**

Rationale:
- `IntegrationProvider` enum already lists `GOOGLE_WORKSPACE`, `MICROSOFT_365`, `MICROSOFT_TEAMS`, `GITHUB`, `SLACK`. Most credentials, OAuth flows, webhook pipelines, and health monitoring are already in place. A new package would force re-implementation of credential resolution, token refresh, and audit logging — exactly the duplication v2.0 fought to eliminate (Key Decision: "Provider adapter pattern — every integration shares credential store, webhook pipeline, health monitoring").
- The country-profile pattern from `einvoice` and `classification` is the **wrong analog** here. Country profiles are pure-data + pure-function (rule sets, validators). IdP deprovisioning is **stateful imperative remote calls** with auth tokens and rate limits — exactly what `IntegrationProviderAdapter` is built for.

```typescript
// packages/integrations/src/types/provider.ts (NEW capability mixin)
export interface DeprovisionResult {
  status: 'SUSPENDED' | 'REMOVED' | 'NOT_FOUND' | 'PARTIAL' | 'FAILED';
  externalUserId?: string;
  durationMs: number;
  rawResponseHash: string;  // SHA-256 of raw API response for audit (no PII in hash)
  errorCode?: string;
}

export interface Deprovisionable {
  /** Idempotent — calling twice MUST return SUSPENDED|NOT_FOUND on second call. */
  deprovision(args: {
    connectionId: string;
    externalIdentifier: { email: string; externalId?: string };
    actorUserId: string;
    reason: 'OFFBOARDING' | 'MANUAL_REVOKE' | 'COMPLIANCE_BREACH';
  }): Promise<DeprovisionResult>;

  /** For dry-run UI preview — what would deprovision do? */
  describeImpact?(args: { externalIdentifier: { email: string } }): Promise<{
    actions: Array<{ kind: string; target: string }>;
  }>;
}

// IntegrationProviderAdapter extended:
export interface IntegrationProviderAdapter {
  // ... existing fields ...
  readonly deprovision?: Deprovisionable;
}
```

### 2.2 New IntegrationProvider enum members

```prisma
enum IntegrationProvider {
  // ... existing ...
  ENTRA_ID    // separate from MICROSOFT_365 — different OAuth scope set, different Graph endpoints for user.disable
  OKTA        // System for Cross-domain Identity Management (SCIM) v2
}
```

Note: **Reuse existing `MICROSOFT_TEAMS`/`MICROSOFT_365`** as the same Azure AD principal — Teams adapter has Graph access; an adapter consolidation pass during v6.0 may DRY this, but is **not** a hard prerequisite for deprovisioning.

### 2.3 Trigger orchestration — workflow-task driven, not bespoke orchestrator

**Decision: Re-use `WorkflowTaskType.ACCESS_REVOKE` (already exists in `workflow.prisma:173`). Build a service `deprovisioning-orchestrator.ts` that listens for ACCESS_REVOKE task starts in the existing offboarding workflow.**

This mirrors exactly how `equipment-workflow.ts` wires `WorkflowTaskType.EQUIPMENT` into the workflow engine. A bespoke orchestrator would split offboarding logic across two places.

```
ContractorAssignment.status = 'ENDED' (via offboarding)
  → existing workflow engine starts run with template `OFFBOARDING`
  → ACCESS_REVOKE task created (TODO)
  → fire-and-forget: deprovisioning-orchestrator.handleAccessRevokeTaskStart(taskRunId)
    → look up contractor.email
    → for each connected IntegrationConnection where adapter.deprovision != null:
        enqueue QStash job /api/queue/deprovision { connectionId, taskRunId, email }
    → store DeprovisioningRun(taskRunId, totalProviders=N, completedProviders=0, status=IN_PROGRESS)
```

### 2.4 Saga / partial-failure pattern

**Decision: Saga with provider-level idempotency, NOT global compensation. Use a new `DeprovisioningRun` + `DeprovisioningStep` audit model. Partial failure = blocking task, never silent.**

Rationale: A "compensating action" for IdP deprovisioning would be **re-provisioning** access — which is operationally unsafe and legally murky (re-granting access to an offboarded contractor). The right model is **idempotent retry with manual escalation** for unrecoverable failures.

```prisma
// New schema file: deprovisioning.prisma
model DeprovisioningRun {
  id                  String   @id @default(cuid())
  organizationId      String
  workflowTaskRunId   String   @unique
  contractorId        String
  contractorEmail     String
  totalProviders      Int
  completedProviders  Int      @default(0)
  failedProviders     Int      @default(0)
  status              DeprovisioningRunStatus @default(IN_PROGRESS)
  startedAt           DateTime @default(now())
  completedAt         DateTime?
  // ... org rel, indexes
}

model DeprovisioningStep {
  id                       String   @id @default(cuid())
  organizationId           String
  deprovisioningRunId      String
  integrationConnectionId  String
  provider                 IntegrationProvider
  status                   DeprovisioningStepStatus @default(PENDING)
  attempts                 Int      @default(0)
  maxAttempts              Int      @default(3)
  lastError                String?
  externalActionResult     Json?
  startedAt                DateTime?
  completedAt              DateTime?
  // ... rels
}

enum DeprovisioningRunStatus  { IN_PROGRESS COMPLETED PARTIAL_FAILURE FAILED }
enum DeprovisioningStepStatus { PENDING IN_PROGRESS SUCCEEDED FAILED SKIPPED MANUAL_ESCALATION }
```

**Failure handling:**
- Provider call fails → step status=FAILED, attempts++. If attempts < maxAttempts, requeue with QStash exponential backoff (existing `qstash-client.ts` pattern).
- Final attempt fails → step status=MANUAL_ESCALATION → `WorkflowTaskRun.status=BLOCKED` → notification dispatched to admin with deep link to manual-revoke page.
- Run status computed: `IN_PROGRESS` while any PENDING/IN_PROGRESS, `COMPLETED` if all SUCCEEDED, `PARTIAL_FAILURE` if some MANUAL_ESCALATION, `FAILED` only if every provider failed (very rare).

The workflow task is **only** marked DONE when run.status=COMPLETED. PARTIAL_FAILURE keeps the offboarding workflow blocked at ACCESS_REVOKE, which is the correct semantic — you cannot complete offboarding while contractor still has GitHub org access.

### 2.5 Audit trail

Every step writes to existing `AuditLog` (`audit.prisma:3`) with action='IDP_DEPROVISION', plus a redacted hash of the provider response. The existing `IntegrationSyncLog` is also written (direction=OUTBOUND, syncType='deprovision'). Re-use, don't duplicate.

### 2.6 Files touched

**New:**
- `packages/integrations/src/types/deprovision.ts` (Deprovisionable interface)
- `packages/integrations/src/adapters/{google-workspace,entra-id,okta,github,slack,teams}-adapter.ts` — extend each with `deprovision: Deprovisionable` (Microsoft Teams already covered if Entra ID adapter consolidates)
- `packages/db/prisma/schema/deprovisioning.prisma`
- `packages/api/src/services/deprovisioning-orchestrator.ts`
- `packages/api/src/routers/deprovisioning.ts` (status query, manual retry, manual mark-complete with admin permission)
- `apps/web/src/app/api/queue/deprovision/route.ts` (QStash worker)

**Modified:**
- `packages/integrations/src/types/provider.ts` — add optional `deprovision` field
- `packages/db/prisma/schema/integration.prisma` — add `ENTRA_ID`, `OKTA` to `IntegrationProvider` enum
- `packages/api/src/services/index.ts` — wire orchestrator into workflow start hook (mirror equipment-workflow.ts)
- `packages/validators/src/permissions.ts` — register `idp_deprovision:execute`, `idp_deprovision:manual_complete` (latter scoped to admin only)
- `packages/feature-flags/src/registry.ts` — `idp-deprovisioning` flag (operational risk → PENDING)

---

## 3. Feature 3 — Gulf Operational Polish

### 3.1 UAE free-zone + Saudization — package boundary

**Decision: Extend `packages/db` + `packages/api` with a small per-jurisdiction profile package `packages/gulf-regulatory`. Country-data (zone codes, Nitaqat thresholds) belongs in code, persisted entities belong in Prisma.**

The country-profile pattern fits here perfectly because zone codes and Saudization band thresholds are **data, not workflow** — same shape as `packages/einvoice/profiles/zatca` exposing static rule data. Putting these inside `packages/api/src/services/saudization.ts` would couple the API server to data that should be unit-testable in isolation and reviewable by Steuerberater-equivalent (Gulf compliance adviser) outside the application code.

### 3.2 UAE Free Zone schema

```prisma
// New schema file: gulf.prisma
model UaeFreeZone {
  // STATIC reference data — seeded at migration time, rarely mutated.
  // Synced from packages/gulf-regulatory/profiles/uae/free-zones.ts catalogue.
  id                  String   @id     // e.g. 'DMCC', 'JAFZA', 'DIFC', 'ADGM'
  displayName         String
  emirate             String   // 'DUBAI' | 'ABU_DHABI' | 'SHARJAH' | …
  permittedActivityCodes Json  // string[] from gulf-regulatory profile
  licenseRenewalIntervalMonths Int @default(12)
  // No organizationId — global reference table
}

model FreeZoneAssignment {
  id                  String   @id @default(cuid())
  organizationId      String
  contractorId        String
  contractorAssignmentId String?     // link to specific engagement, optional
  uaeFreeZoneId       String
  licenseNumber       String
  licenseIssuedAt     DateTime @db.Date
  licenseExpiresAt    DateTime @db.Date
  permittedActivityCodes Json   // subset of UaeFreeZone.permittedActivityCodes — what THIS license covers
  status              FreeZoneAssignmentStatus @default(ACTIVE)
  // ... org/contractor rels, indexes on expiresAt for sweep
}

enum FreeZoneAssignmentStatus { ACTIVE EXPIRING EXPIRED REVOKED }
```

`UaeFreeZone` is global static reference data. `FreeZoneAssignment` is per-org, per-contractor. **Activity-scope validation** runs in the `compliance-policy-evaluator` (Feature 1's engine) — when a contractor with a free-zone assignment is matched against an engagement type, validate that the contract's activity descriptor falls inside `permittedActivityCodes`. This composes Feature 1 + Feature 3 cleanly.

### 3.3 Saudization (Nitaqat) schema

**Decision: Two new models. Do NOT extend `Organization` with a JSON blob — the Nitaqat band is queried frequently for the dashboard and needs to be indexable.**

```prisma
model SaudizationConfig {
  id                  String   @id @default(cuid())
  organizationId      String   @unique
  totalEmployees      Int      @default(0)         // current snapshot — denormalised from headcount table
  saudiEmployees      Int      @default(0)
  nationalisationRate Decimal  @db.Decimal(5,4)    // 0.0000-1.0000
  currentBand         NitaqatBand                  // PLATINUM | HIGH_GREEN | MID_GREEN | LOW_GREEN | YELLOW | RED
  industrySegment     String                       // e.g. 'INFORMATION_TECHNOLOGY' — band thresholds vary per segment
  lastRecomputedAt    DateTime
  // org rel
}

model SaudiHeadcount {
  // Per-engagement nationality + Saudi-status entry.
  id                  String   @id @default(cuid())
  organizationId      String
  contractorAssignmentId String  @unique           // 1:1 with engagement
  nationality         String   @db.Char(2)        // ISO-3166-1 alpha-2
  isSaudi             Boolean
  effectiveFrom       DateTime
  effectiveTo         DateTime?
  // ... rels, index on (organizationId, isSaudi, effectiveTo IS NULL)
}

enum NitaqatBand { PLATINUM HIGH_GREEN MID_GREEN LOW_GREEN YELLOW RED }
```

`SaudizationConfig.currentBand` and `nationalisationRate` are **denormalised** for dashboard read-perf. Recomputed by a daily cron `/api/cron/saudization-recompute` plus event-triggered on `SaudiHeadcount` insert/update (fire-and-forget). The recompute logic lives in `packages/gulf-regulatory/profiles/sa/nitaqat.ts` (pure function: headcount[] + segment → band).

### 3.4 Dashboard composition

**Decision: Reuse the existing `reportRouter` for Gulf reports, NOT a new top-level router. Add a `gulfDashboard` sub-router only if Saudization-specific charts diverge from the standard report shape.**

Inspecting v5.0: per-market compliance dashboard uses 8 tRPC procedures across `classification-dashboard.ts`. v6.0 should add `report.gulf.{nitaqatStatus, freeZoneExpiry, freeZoneActivityViolations}` procedures. Gulf views that need richer chart composition can live in a thin `report.gulf.*` namespace; pure-data queries belong in the existing `report.ts` to keep the report-export pipeline (CSV with formula-injection neutralisation — already proven) consistent.

### 3.5 Free-zone license expiry — re-uses Feature 1's reminder cron

`FreeZoneAssignment.licenseExpiresAt` participates in the Feature 1 expiry-scan by mapping it as a `ContractorComplianceItem` row whose `requirementTemplateId` points at a synthetic "FREE_ZONE_LICENSE" template (severity=CRITICAL, blocksPayment=true). This composition is the entire reason Feature 1 must land first.

### 3.6 Files touched

**New:**
- `packages/gulf-regulatory/src/profiles/uae/free-zones.ts` (static catalogue), `src/profiles/sa/nitaqat.ts` (band thresholds + computeBand fn)
- `packages/db/prisma/schema/gulf.prisma`
- `packages/api/src/routers/gulf.ts`
- `packages/api/src/services/saudization-recompute.ts`
- `apps/web/src/app/api/cron/saudization-recompute/route.ts`
- `apps/web/src/app/[locale]/(app)/dashboard/gulf/page.tsx`
- `packages/db/prisma/seed/uae-free-zones.ts` (seeds `UaeFreeZone` reference data from gulf-regulatory profile)

**Modified:**
- `packages/api/src/routers/report.ts` — add `gulf.*` namespace
- `packages/api/src/routers/contractor.ts` — surface `freeZoneAssignment` and `saudiHeadcount` on contractor profile country-fields tab when `countryCode IN ('AE','SA')`
- `packages/i18n/src/messages/{en,pl,de,ar}/gulf.json` — Nitaqat band names + zone names (Arabic critical)
- `packages/feature-flags/src/registry.ts` — `gulf-operational-polish` flag

---

## 4. Feature 4 — Offboarding Hardening

### 4.1 IP-assignment verification gate

**Decision: New `WorkflowTaskType.IP_VERIFICATION` enum value, NOT a new top-level "blocking task" abstraction. The existing `WorkflowTaskRun.status=BLOCKED` + `WorkflowTaskTemplate.required=true` already provides the gate semantics.**

Adding a `BlockingTaskType` parallel to `WorkflowTaskType` would split the workflow engine. The existing model already supports the gate: `required=true` task in BLOCKED state prevents `WorkflowRun.completedAt` from being set (verified in workflow router logic).

```prisma
enum WorkflowTaskType {
  // ... existing ...
  IP_VERIFICATION    // NEW
  CONTRACT_HEALTH_CHECK  // NEW (drives F4.3)
}
```

**Override RBAC:** Add a new permission `workflow:override_blocking_task` (admin + legal_compliance_viewer). The existing `requirePermission` middleware enforces it. UI surfaces the override only when permission present + user provides a written reason that lands in `WorkflowTaskRun.resultJson` (which already exists, line 106).

### 4.2 Contract clause health check — Claude Vision tool_use

**Decision: Trigger at contract upload AND on demand. Store result on `Contract.complianceFlagsJson` (new field) — NOT on `Document` (because health is per-contract relationship, not per-file).**

```prisma
// contract.prisma
model Contract {
  // ... existing ...
  complianceFlagsJson      Json?       // NEW { ipAssignment: { present: bool, confidence: 0-1, citation?: string }, ... }
  complianceFlagsCheckedAt DateTime?   // NEW
  complianceFlagsModelVer  String?     // NEW — e.g. 'claude-3-5-sonnet-20241022' for replay
}
```

```
contractRouter.uploadDocument(contractId, file) →
  // existing: R2 upload, ClamAV, DocumentLink
  → fire-and-forget: enqueueContractHealthCheck(contractId)
    → QStash /api/queue/contract-health-check { contractId }
      → fetch document from R2 (presigned)
      → call existing OCR adapter (claude-ocr-adapter.ts) but with NEW tool definition
        — input: PDF bytes + system prompt: "Identify whether this contract contains IP assignment language transferring all work-product IP to the engaging party. Cite the clause."
        — output via tool_use: { ipAssignment: { present: bool, confidence: number, citation: string|null } }
      → write Contract.complianceFlagsJson, complianceFlagsCheckedAt, complianceFlagsModelVer
      → if ipAssignment.present === false || confidence < 0.7:
          create open ReassessmentTrigger-like flag → notify legal_compliance_viewer
```

**Reuse `claude-ocr-adapter.ts`** (already in `packages/integrations/src/adapters/`). The adapter contract supports tool_use; only the tool schema changes per use case. New tool registrations live in `packages/api/src/services/contract-health-tools.ts` keeping the OCR adapter pure.

**OCR credits:** Each health check decrements OCR credits via existing `credit-service.ts` (atomic Serializable isolation already proven in v3.0). Fail-open (no block) on credit exhaustion — health check is advisory infrastructure.

### 4.3 Knowledge transfer template — seeded `WorkflowTemplate`, NOT new RoleType taxonomy

**Decision: Seed a small set of role-based `WorkflowTemplate` rows (e.g. `KT_DEVELOPER`, `KT_DESIGNER`, `KT_PROJECT_MANAGER`, `KT_OTHER`) with type=OFFBOARDING and tasks of taskType=KNOWLEDGE_TRANSFER. Pick template at offboarding start based on contractor's primary role tag.**

A new `RoleType` taxonomy table + dynamic template generation would be **overengineering** for v6.0:
- The existing `ContractorTag` system already supports role tagging (verified in `contractor.prisma:185`).
- v1.0 already proved templates are sufficient for COMPLIANCE_REVIEW, ONBOARDING, OFFBOARDING workflows; adding 4 KT seeds reuses that proven mechanism.
- Dynamic generation requires a new template-render engine; templates as data are reviewable by ops without engineering involvement.

Future-proofing: when 4 templates becomes 40, the user can use the existing template builder UI (v1.0) to clone and customise. No engineering required.

### 4.4 Documentation handover

Add `WorkflowTaskTemplate.configJson.credentialLinks` (already JSON, no schema change) — array of `{ label, vaultUrl }`. Display in task UI as click-through links. Org-level setting: `Organization.settingsJson.passwordVaultProvider` (no schema change — settingsJson exists). This is purely a UI feature on top of existing infrastructure.

### 4.5 Files touched

**New:**
- `packages/api/src/services/contract-health-checker.ts`
- `packages/api/src/services/contract-health-tools.ts` (Claude tool_use definitions)
- `apps/web/src/app/api/queue/contract-health-check/route.ts`
- `packages/db/prisma/seed/offboarding-templates.ts` (seeds 4 KT templates per org on creation)

**Modified:**
- `packages/db/prisma/schema/workflow.prisma` — add `IP_VERIFICATION`, `CONTRACT_HEALTH_CHECK` to `WorkflowTaskType`
- `packages/db/prisma/schema/contract.prisma` — add `complianceFlagsJson`, `complianceFlagsCheckedAt`, `complianceFlagsModelVer` to `Contract`
- `packages/api/src/routers/contract.ts` — fire-and-forget health check on upload + new `Contract.runHealthCheck` mutation (manual re-run)
- `packages/api/src/routers/workflow-execution.ts` — add `overrideBlockingTask` mutation gated on `workflow:override_blocking_task`
- `packages/validators/src/permissions.ts` — register the override permission
- `packages/feature-flags/src/registry.ts` — `offboarding-hardening` flag (legal-sensitive — IP-clause AI inference flagged for adviser review → PENDING)

---

## 5. Build Order — Dependency-Honouring

```
                ┌──────────────────────────────────┐
                │ F1: Compliance Document Engine   │  ← FOUNDATION
                │  (extends ComplianceRequirement, │
                │   policy package, payment hook,  │
                │   expiry cron)                   │
                └────────────┬─────────────────────┘
                             │
         ┌───────────────────┼─────────────────────┐
         │                   │                     │
         ▼                   ▼                     ▼
  ┌────────────┐    ┌────────────────┐   ┌────────────────┐
  │ F3: Gulf   │    │ F4: Offboarding│   │ F2: IdP        │
  │ (free-zone │    │ Hardening      │   │ Deprovisioning │
  │  uses F1   │    │ (IP check uses │   │ (independent   │
  │  expiry +  │    │  Doc store +   │   │  of F1; runs   │
  │  block hook│    │  workflow      │   │  in offboarding│
  │  for       │    │  engine; KT    │   │  workflow)     │
  │  licenses) │    │  reuses        │   │                │
  │            │    │  templates)    │   │                │
  └────────────┘    └────────────────┘   └────────────────┘
```

**Hard dependencies:**
1. **F1 must land before F3** — UAE free-zone license expiry composes through F1's `ContractorComplianceItem` + reminder cron. Building F3 first means duplicating the band-state-machine reminder logic.
2. **F1 must land before F4's IP-clause health check** — the failure mode (missing IP assignment language) creates a `ContractorComplianceItem` of severity=STANDARD. Without F1's instance/expiry model, the health check has nowhere to write its findings.
3. **F2 is independent of F1/F3/F4 schema-wise** but shares the offboarding workflow with F4. Build F4's `WorkflowTaskType.IP_VERIFICATION` enum addition before F2 wires `ACCESS_REVOKE` orchestration so a single migration covers both.

**Suggested phase grouping (continuing from v5.0 phase 69):**

| Phase | Feature(s) | Scope |
|---|---|---|
| 70 | F1 Foundation | `packages/compliance-policy` package + schema delta + policy resolver + reconcile-on-classification hook + dashboard skeleton |
| 71 | F1 Reminder + Payment Block | expiry-scan cron + paymentRouter preCheck + approval-engine condition + notification fan-out |
| 72 | F1 UI + i18n | dashboard at-risk view + per-contractor compliance tab refresh + en/pl/de/ar parity |
| 73 | F4 Workflow Foundation | `WorkflowTaskType` additions + `IP_VERIFICATION` blocking semantics + override permission + KT template seeds |
| 74 | F4 Contract Health Check | Claude tool_use service + queue worker + Contract.complianceFlagsJson + advisory UI |
| 75 | F3 UAE Free Zones | gulf-regulatory profiles + UaeFreeZone seed + FreeZoneAssignment + activity-scope validator (composes F1) |
| 76 | F3 Saudization | SaudizationConfig + SaudiHeadcount + recompute cron + Nitaqat band dashboard + Arabic copy review |
| 77 | F2 Adapter Capability + Schema | Deprovisionable mixin + DeprovisioningRun/Step models + ENTRA_ID/OKTA enum + base orchestrator |
| 78 | F2 Provider Implementations | extend GWS + Entra + Okta + GitHub + Slack + Teams adapters with `deprovision` |
| 79 | F2 Workflow Wiring + UI | ACCESS_REVOKE task hook + manual retry + audit + admin manual-complete flow |
| 80 | v6.0 Verification + Hardening | cross-feature integration tests, manual UAT, post-deploy legal sign-off list |

---

## 6. Where Existing Patterns Are LIMITING (justified divergence)

| Pattern | Limit | v6.0 Divergence |
|---|---|---|
| Country-profile (einvoice/classification) | Pure-data + pure-function. Cannot drive remote API calls with auth. | F2 IdP deprovisioning uses `IntegrationProviderAdapter` (stateful) instead. Country profiles are kept for F1 (rules) and F3 (zone catalogue + Nitaqat thresholds). |
| `IntegrationProviderAdapter` | Currently optional methods are OAuth/webhook focused. No retry semantics built-in. | Add `Deprovisionable` capability mixin AND new `DeprovisioningRun/Step` saga state model — adapter contract stays thin, retry orchestration lives in service layer. |
| `WorkflowTaskRun.status=BLOCKED` | Workflow engine treats BLOCKED as informational; nothing prevents `WorkflowRun.completedAt` programmatically except the `required=true` flag check. | F4's IP_VERIFICATION needs an explicit override flow with audit trail, not a status flip. New `overrideBlockingTask` mutation with override permission + reason capture. |
| `ComplianceRequirementTemplate` | Existing model has no `severity` or `appliesToCountry` — was scoped narrowly for v1.0 doc collection. | Extend additively. Do not fork into a new model — that splits the source of truth and breaks compliance-health scoring continuity. |
| `Organization.settingsJson` (Json blob) | Fine for low-frequency config. Bad for indexed queries (Saudization band, query-by-band). | F3 Saudization promotes band + rate to first-class columns on new `SaudizationConfig` model. settingsJson is preserved for vault-provider URL (F4) which is read-once-on-render. |
| `claude-ocr-adapter.ts` tool schema | Adapter is invoice-extraction-shaped today. | Extract tool definition to caller (`contract-health-tools.ts`). Adapter takes a `tool` parameter. Backwards compatible — invoice OCR keeps its tool. This DRYs the Claude Vision integration without forking the adapter. |

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| F1 payment-block rolled out to existing customers locks them out of payments | Feature flag `compliance-policy-engine` + per-org `complianceBlockEnabled` setting; default OFF for existing orgs, ON for new orgs. Migration path: 30-day advisory-only mode before block activates per-org. |
| F2 deprovisioning irreversible — accidentally deprovisions wrong user | Required `describeImpact` dry-run UI before execute. Two-person rule for `idp_deprovision:execute` enforceable via `requireSensitive` middleware (already exists from v1.0). Audit log + slack notification. |
| F3 Saudization recompute cross-org cost | `SaudiHeadcount` is per-org (no cross-org aggregation needed unlike economic-dependency); recompute is O(headcount) per org per day — trivial. |
| F4 Claude Vision false-negative on IP clause → contractor offboarded with unsigned IP | Health check is advisory only — it FLAGS, does not BLOCK. Block lives in `IP_VERIFICATION` task which requires human sign-off. Two-layer defence. |
| Cross-feature legal review burden (PENDING flags) | Stage flags PENDING on first ship; group adviser review in milestone hardening phase 80; do not block per-phase delivery. Aligned with project-local-only deferred legal sign-off memory. |

---

## 8. Confidence Notes

- **F1, F4 — HIGH confidence:** All extension points verified at file-level. `ComplianceRequirementTemplate` schema reviewed in detail; payment router mutation site read at line 352; workflow `BLOCKED` semantics + `resultJson` confirmed.
- **F2 — HIGH confidence on architecture, MEDIUM on per-IdP implementation:** Each provider's deprovisioning API (Google Admin SDK `users.update suspended=true`, Entra Graph `User.AccountEnabled=false`, Okta SCIM DELETE/deactivate, GitHub `orgs/{org}/memberships/{username}` DELETE, Slack SCIM `Users` PATCH `active=false`) needs per-provider Context7 verification before building each adapter. Flagged for phase-77/78 deeper research.
- **F3 — HIGH confidence on schema, MEDIUM on Nitaqat band thresholds:** Saudization band thresholds vary by industry segment and are revised periodically by Saudi MHRSD. The `gulf-regulatory` profile must be reviewed against current MHRSD bulletin before each phase ship; same Steuerberater-equivalent legal-review-deferred posture applies.
- **All features — HIGH confidence on monorepo conventions:** Direct file inspection of routers, services, schema, types, adapters confirms patterns are stable and v6.0 extensions slot in cleanly.
