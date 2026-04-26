---
phase: 60-classification-polish
verified: 2026-04-14T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Trigger the economic-dependency cron against a DE contractor with known invoice data and confirm a warning notification fires at exactly 70% billing share and a critical notification fires at 83.33%."
    expected: "Notification of type classification.economic_dependency_warning dispatched when share crosses 0.70; classification.economic_dependency_critical dispatched when share reaches or exceeds 5/6."
    why_human: "Band thresholds and dispatch call exist in code but cross-org aggregate correctness and notification delivery require a live DB + scheduler run to confirm end-to-end."
  - test: "On the classification dashboard page at /[locale]/(dashboard)/classification, verify both market cards (GB and DE) render all 4 tiles with non-empty data, and that the CSV download button produces a well-formed file with a UTF-8 BOM and no formula-injection characters unescaped."
    expected: "CoverageTile, RiskDistributionTile, OverdueReassessmentsTile, ActiveAlertsTile each show real counts; CSV download triggers a file download where cells starting with =, +, -, @ are prefixed with a single quote."
    why_human: "React Query tile independence and signed-R2 CSV URL round-trip cannot be verified statically; requires a running app with seed data."
  - test: "On a DE engagement page, verify the StatusfeststellungsverfahrenPanel renders, the 'File new clearance' CTA opens the DrvClearanceForm dialog, and submitting a clearance with outcome=SELBSTANDIG requires validFrom and validTo to be filled."
    expected: "Panel visible for DE contractors only; form rejects submit when outcome is SELBSTANDIG/ABHANGIG and validFrom or validTo are empty; panel list updates after submit."
    why_human: "Client-side Zod mirror + Dialog open/close interaction requires a browser; server-side validation is unit-tested but client UX needs manual confirmation."
  - test: "Amend a UK contractor's rate on an active engagement, wait for (or manually trigger) the reassessment-triggers cron, and confirm a ReassessmentTrigger row is created with status OPEN and a notification dispatched."
    expected: "AuditLog row written for CONTRACT resourceType; cron scan finds it; ReassessmentTrigger row appears; classification.reassessment_trigger notification delivered to contractor:read-permissioned users."
    why_human: "Audit-writer wiring and cron scan correctness are both unit-tested, but the full integration across router mutation → audit row → cron scan → trigger creation → notification dispatch requires a live environment."
---

# Phase 60: classification-polish Verification Report

**Phase Goal:** Users receive proactive compliance alerts, can track German regulatory procedures, and have a single dashboard view of classification health across UK and German engagements
**Verified:** 2026-04-14
**Status:** human_needed — all automated checks pass; 4 items require human/live-env confirmation
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User receives automated alerts when a German contractor's billing exceeds 70% (warning) or 83.33% (critical) economic dependency thresholds | VERIFIED | `WARNING_THRESHOLD = 0.7` and `CRITICAL_THRESHOLD = 5/6` in `packages/api/src/services/economic-dependency-scan.ts` lines 53–54; `bandFor()` drives `updateBandState()` which calls `dispatch()` with `classification.economic_dependency_warning` / `classification.economic_dependency_critical`; daily cron at `/api/cron/classification-economic-dependency` wired and authenticated |
| 2 | User receives automated reassessment triggers when a UK engagement materially changes, with a link to the previous SDS | VERIFIED | `writeAuditLog` wired in `contractor.ts` (3 call-sites: create/update/archive) and `contract.ts` (3 call-sites: create/update/delete); `runReassessmentTriggerScan` reads `prismaRaw.auditLog.findMany` since `CronScanState.lastScanCompletedAt`; `priorSdsDocumentId` FK on `ReassessmentTrigger` model; cron at `/api/cron/classification-reassessment-triggers` authenticated and wired |
| 3 | User can track Statusfeststellungsverfahren applications with filing date, DRV reference, outcome, validity period, and expiry reminders | VERIFIED | `Statusfeststellungsverfahren` model has all 5 required fields: `filedAt`, `drvReference`, `outcome`, `validFrom`/`validTo`; `detectDrvClearanceExpiries()` appended to existing reminders cron; 3 notification types registered (`classification.drv_expiry_90d/30d/7d`); `StatusfeststellungsverfahrenPanel` mounted on engagement page behind `countryCode === 'DE'` gate |
| 4 | User can view a per-market compliance health dashboard showing IR35 assessment coverage, Scheinselbständigkeit risk distribution, overdue reassessments, and economic dependency alerts | VERIFIED | `classificationDashboardRouter` with 6 query + 1 mutation procedure wired at `appRouter.classificationDashboard`; dashboard page at `/[locale]/(dashboard)/classification` renders `<MarketCard market="GB" />` and `<MarketCard market="DE" />`; `MarketCard` renders all 4 tiles (`CoverageTile`, `RiskDistributionTile`, `OverdueReassessmentsTile`, `ActiveAlertsTile`) with independent tRPC queries; CSV export via signed R2 URL confirmed |

**Score: 4/4 truths verified (automated checks)**

---

### Deferred Items

None.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/prisma/schema/classification.prisma` | EconomicDependencyAlertState + EconomicDependencyBand | VERIFIED | `model EconomicDependencyAlertState` with `@@unique([contractorAssignmentId])` and back-relations on Organization + ContractorAssignment |
| `packages/db/prisma/schema/classification.prisma` | ReassessmentTrigger + ReassessmentTriggerStatus enum | VERIFIED | `model ReassessmentTrigger` with all 5 back-relations (Org, Assignment, ClassificationAssessment as priorAssessment, ClassificationDocument as priorSdsDocument, User x2); `CronScanState` model present |
| `packages/db/prisma/schema/classification.prisma` | Statusfeststellungsverfahren model + StatusfeststellungsverfahrenOutcome enum | VERIFIED | `model Statusfeststellungsverfahren` with `filedAt`, `drvReference`, `outcome`, `validFrom`, `validTo`, `notes`; both indexes present |
| `packages/db/src/raw.ts` | prismaRaw export — non-tenant PrismaClient | VERIFIED | Exported as singleton with `PHASE-60-CROSS-ORG-AGGREGATE` sentinel comment |
| `packages/api/src/services/rbac-recipients.ts` | `resolveRbacRecipients(orgId, permission)` | VERIFIED | `export async function resolveRbacRecipients` present at line 71 |
| `packages/api/src/services/economic-dependency-scan.ts` | `runEconomicDependencyScan()` orchestrator + `computeBillingShare` + `bandFor` + `updateBandState` | VERIFIED | All 4 exports present; `PHASE-60-CROSS-ORG-AGGREGATE` sentinel on all cross-org calls (5 instances) |
| `packages/validators/src/notification.ts` | classification.economic_dependency_warning + classification.economic_dependency_critical | VERIFIED | Both entries present in NOTIFICATION_TYPES |
| `packages/api/src/services/cron-monitor.ts` | `CronMonitors.CLASSIFICATION_ECONOMIC_DEPENDENCY` + `CLASSIFICATION_REASSESSMENT_TRIGGERS` | VERIFIED | Both keys registered with kebab-case values |
| `apps/web/src/app/api/cron/classification-economic-dependency/route.ts` | Bearer CRON_SECRET + Sentry.withMonitor + withCronMonitor | VERIFIED | `verifyCronSecret` gate, `Sentry.withMonitor('classification-economic-dependency', ...)`, `withCronMonitor(CronMonitors.CLASSIFICATION_ECONOMIC_DEPENDENCY, ...)` |
| `packages/api/src/routers/economic-dependency-alert.ts` | tRPC router: list + listByEngagement (contractor:read) | VERIFIED | `contractorReadProcedure` used for both procedures; wired at `appRouter.economicDependencyAlert` |
| `apps/web/src/components/contractors/classification/economic-dependency-alerts/band-chip.tsx` | `EconomicDependencyBandChip` semantic triad | VERIFIED | Uses `bg-[--success]/10`, `bg-[--warning]/10`, `bg-[--destructive]/10` OKLCh tokens; CircleCheck/ShieldAlert/ShieldX icon triad |
| `packages/api/src/schemas/reassessment-trigger-reason.ts` | `triggerReasonsSchema` Zod export | VERIFIED | `export const triggerReasonsSchema = z.array(triggerReasonSchema)` at line 31 |
| `packages/api/src/services/audit-writer.ts` | `export async function writeAuditLog(...)` | VERIFIED | Single write path with optional `tx`, throws on missing orgId/resourceId, logs errors without swallowing |
| `packages/api/src/services/reassessment-trigger-scan.ts` | `runReassessmentTriggerScan()` | VERIFIED | Present; reads `prismaRaw.auditLog.findMany` with `PHASE-60-CROSS-ORG-AGGREGATE` sentinel |
| `packages/api/src/routers/reassessment-trigger.ts` | list + listByEngagement (contractor:read) + acknowledge + dismiss (contractor:update) | VERIFIED | All 4 procedures with correct RBAC; dismiss reason `z.string().min(10).max(1000)` |
| `apps/web/src/app/api/cron/classification-reassessment-triggers/route.ts` | Bearer CRON_SECRET + withCronMonitor + runReassessmentTriggerScan | VERIFIED | `verifyCronSecret`, `Sentry.withMonitor`, `withCronMonitor`, `runReassessmentTriggerScan()` call |
| `apps/web/src/components/contractors/classification/reassessment-trigger/trigger-chip.tsx` | `ReassessmentTriggerChip` | VERIFIED | Badge warning variant + RefreshCcw icon + i18n `chipLabel` key ("Reassessment recommended") |
| `packages/api/src/routers/statusfeststellungsverfahren.ts` | 5-procedure CRUD router | VERIFIED | list + listByEngagement (contractorReadProcedure) + create + update + delete (contractorUpdateProcedure); `statusfeststellungsverfahrenRouter` exported |
| `apps/web/src/app/api/cron/reminders/route.ts` | `detectDrvClearanceExpiries` helper appended | VERIFIED | Function at line 338; called at line 466 alongside existing detectors |
| `apps/web/src/components/contractors/classification/drv-clearance/drv-clearance-panel.tsx` | `StatusfeststellungsverfahrenPanel` | VERIFIED | Exports `StatusfeststellungsverfahrenPanel` at line 38 |
| `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/engagements/[engagementId]/page.tsx` | DE-only conditional mount of StatusfeststellungsverfahrenPanel | VERIFIED | `{countryCode === 'DE' ? <StatusfeststellungsverfahrenPanel ...> : null}` at line 69–74 |
| `packages/api/src/lib/csv.ts` | `escapeCsvField` with formula-prefix neutralisation (=, +, -, @) | VERIFIED | `FORMULA_PREFIXES = new Set(['=', '+', '-', '@'])` at line 16; single-quote prefix applied before RFC 4180 quote-wrapping |
| `packages/api/src/routers/classification-dashboard.ts` | `classificationDashboardRouter` with 6 query + 1 mutation procedures | VERIFIED | `globalHeader`, `coverageByMarket`, `riskDistributionByMarket`, `overdueByMarket`, `activeAlertsByMarket` + `exportMarketCsv`; all behind `contractorReadProcedure`; wired at `appRouter.classificationDashboard` |
| `apps/web/src/app/[locale]/(dashboard)/classification/page.tsx` | Dashboard page — 2 MarketCards | VERIFIED | Renders `<MarketCard market="GB" />` and `<MarketCard market="DE" />` inside a `max-w-5xl` container with `<GlobalHeader />` and `<RefreshDashboardButton />` |
| `apps/web/src/components/contractors/classification/dashboard/risk-distribution-tile.tsx` | Native-flex stacked bar — OKLCh tokens + role=img + aria-label | VERIFIED | `bg-[--success]`, `bg-[--warning]`, `bg-[--destructive]` tokens; `role="img"` at line 72; `aria-label={ariaLabel}` at line 73 |
| `apps/web/src/components/contractors/classification/dashboard/download-csv-button.tsx` | exportMarketCsv mutation trigger | VERIFIED | `trpc.classificationDashboard.exportMarketCsv.useMutation(...)` at line 24 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/src/app/api/cron/classification-economic-dependency/route.ts` | `packages/api/src/services/economic-dependency-scan.ts` | `runEconomicDependencyScan()` inside Sentry.withMonitor + withCronMonitor | WIRED | Import at line 16; call at line 43 |
| `packages/api/src/services/economic-dependency-scan.ts` | `packages/db/src/raw.ts` | `prismaRaw.invoice.aggregate` for cross-org billing-share denominator | WIRED | `PHASE-60-CROSS-ORG-AGGREGATE` sentinel at 5 locations; denominator query omits `organizationId` filter by design |
| `packages/api/src/services/economic-dependency-scan.ts` | notification-service | `dispatch()` call for band up-crossing + resolve notifications | WIRED | `import { dispatch }` at line 45; call at line 326 |
| `packages/api/src/services/economic-dependency-scan.ts` | `packages/api/src/services/rbac-recipients.ts` | `resolveRbacRecipients(organizationId, 'contractor:read')` | WIRED | Pattern confirmed |
| `packages/api/src/root.ts` | `packages/api/src/routers/economic-dependency-alert.ts` | `appRouter.economicDependencyAlert` | WIRED | Line 133 |
| `packages/api/src/routers/contractor.ts` | `packages/api/src/services/audit-writer.ts` | `writeAuditLog(...)` on assignment create/update/archive | WIRED | Import line 18; 3 call-sites at lines 623, 715, 909 |
| `packages/api/src/routers/contract.ts` | `packages/api/src/services/audit-writer.ts` | `writeAuditLog(...)` on contract create/update/delete | WIRED | Import line 16; 3 call-sites at lines 264, 389, 667 |
| `packages/api/src/services/reassessment-trigger-scan.ts` | `packages/db/src/raw.ts` | `prismaRaw.auditLog.findMany` since `lastScanCompletedAt` | WIRED | Line 278 |
| `packages/api/src/routers/classification.ts` | reassessment-trigger-scan auto-resolve helper | `status: 'RESOLVED'` on GB submit | WIRED | Line 434 |
| `apps/web/src/app/api/cron/classification-reassessment-triggers/route.ts` | `packages/api/src/services/reassessment-trigger-scan.ts` | `runReassessmentTriggerScan()` | WIRED | Import line 14; call line 41 |
| `apps/web/src/app/api/cron/reminders/route.ts` | Statusfeststellungsverfahren (via prismaRaw) | `prismaRaw.statusfeststellungsverfahren.findMany` on validTo boundaries | WIRED | Line 349 |
| `apps/web/src/app/api/cron/reminders/route.ts` | `packages/api/src/services/rbac-recipients.ts` | `resolveRbacRecipients(orgId, 'contractor:read')` for DRV expiry recipients | WIRED | Import line 3; call line 367 |
| `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/engagements/[engagementId]/page.tsx` | `drv-clearance-panel.tsx` | Conditional render when `countryCode === 'DE'` | WIRED | Import line 14; render line 71 |
| `apps/web/src/app/[locale]/(dashboard)/classification/page.tsx` | `packages/api/src/routers/classification-dashboard.ts` | RSC/client tRPC calls for all 4 tiles per market via `trpc.classificationDashboard.*` | WIRED | Page renders MarketCard which calls all 4 procedures via `trpc.classificationDashboard.*` |
| `packages/api/src/routers/classification-dashboard.ts` | `packages/api/src/lib/csv.ts` | `encodeCsvUtf8Bom` + `escapeCsvField` for `exportMarketCsv` | WIRED | Import line 24; call line 582 |
| `packages/api/src/routers/classification-dashboard.ts` | `packages/api/src/services/r2.ts` | `putObjectAndSignDownload` for signed 300s CSV URL | WIRED | Import line 28; call line 595 |
| `packages/api/src/root.ts` | `packages/api/src/routers/reassessment-trigger.ts` | `appRouter.reassessmentTrigger` | WIRED | Line 134 |
| `packages/api/src/root.ts` | `packages/api/src/routers/statusfeststellungsverfahren.ts` | `appRouter.statusfeststellungsverfahren` | WIRED | Line 135 |
| `packages/api/src/root.ts` | `packages/api/src/routers/classification-dashboard.ts` | `appRouter.classificationDashboard` | WIRED | Line 129 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `apps/web/src/app/[locale]/(dashboard)/classification/page.tsx` — GlobalHeader | `header.data` | `trpc.classificationDashboard.globalHeader.useQuery()` → DB aggregates on `ClassificationAssessment` + `EconomicDependencyAlertState` + `CronScanState` | Yes — router queries Prisma models with `status: 'completed'` filter; no static fallbacks found | FLOWING |
| `apps/web/src/components/contractors/classification/dashboard/market-card.tsx` — 4 tiles | `coverage.data`, `riskDistribution.data`, `overdue.data`, `activeAlerts.data` | 4 independent `trpc.classificationDashboard.*ByMarket.useQuery({ market })` calls; router procedures use real Prisma queries with `status: 'completed'` | Yes — 5 confirmed `status: 'completed'` filter instances in router; no static returns | FLOWING |
| `apps/web/src/app/[locale]/(dashboard)/classification/page.tsx` — CSV export | `exportMarketCsv` mutation result | `trpc.classificationDashboard.exportMarketCsv` → `buildDashboardRows(ctx, market)` → Prisma join query → `encodeCsvUtf8Bom` + `escapeCsvField` → R2 `putObjectAndSignDownload` | Yes — rows built from real DB data; no hardcoded empty returns | FLOWING |
| `apps/web/src/components/contractors/classification/drv-clearance/drv-clearance-panel.tsx` | listByEngagement query | `trpc.statusfeststellungsverfahren.listByEngagement.useQuery({ contractorAssignmentId })` → DB | Yes — tRPC procedure queries Prisma `statusfeststellungsverfahren` with `contractorAssignmentId` scope | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED (cannot start servers or run cron jobs; unit-test execution requires pnpm install in a non-node_modules worktree environment). Router/service unit tests are documented in SUMMARY files as 36 + 30 + 30 + 31 = 127 new tests, all green per SUMMARY reports.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CLASS-07 | 60-01 | Automated alerts when DE contractor billing exceeds 70%/83.33% economic dependency thresholds | SATISFIED | `bandFor()` + `updateBandState()` + `dispatch()` in `economic-dependency-scan.ts`; thresholds locked at lines 53–54; cron route authenticated and wired |
| CLASS-08 | 60-02 | Automated reassessment triggers when UK engagement materially changes, linking to previous SDS | SATISFIED | `writeAuditLog` wired to 6 contractor/contract mutation call-sites; `runReassessmentTriggerScan` with `CronScanState` cursor; `priorSdsDocumentId` FK on `ReassessmentTrigger`; auto-resolve on GB submit |
| CLASS-09 | 60-03 | Track Statusfeststellungsverfahren with filing date, DRV reference, outcome, validity period, expiry reminders | SATISFIED | All 5 model fields confirmed in schema; `detectDrvClearanceExpiries` in reminders cron; 3 notification types registered; panel mounted on DE engagement page |
| CLASS-10 | 60-04 | Per-market compliance health dashboard — IR35 coverage, Scheinselbständigkeit risk, overdue reassessments, economic dependency alerts | SATISFIED | Dashboard page with 2 MarketCards × 4 tiles; `classificationDashboardRouter` with 6 procedures + exportMarketCsv; all queries filter `status: 'completed'`; CSV injection neutralised |

All 4 requirement IDs declared in plan frontmatter are satisfied. No orphaned requirements found.

---

### Anti-Patterns Found

Anti-pattern scan ran across all created/modified files from SUMMARY frontmatter `key-files` sections.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TODO/FIXME/placeholder/stub patterns found | — | — |

Notable observations (not blockers):
- `apps/web/src/app/api/cron/classification-reassessment-triggers/route.ts` — SUMMARY notes `--no-verify` flag used in commits for parallel execution protocol. This bypasses pre-commit hooks and is an established project pattern for this execution mode, not a defect.
- `packages/api/src/routers/statusfeststellungsverfahren.ts` — router audit writes use post-mutation pattern (not tx-wrapped) as explicitly decided in plan key-decisions. Future refactor opportunity noted by the plan itself.

---

### Human Verification Required

#### 1. Economic-dependency threshold end-to-end

**Test:** Create a DE contractor with invoice data representing 70%+ platform billing share (relative to total cross-org billing), trigger the `/api/cron/classification-economic-dependency` endpoint with a valid `Bearer CRON_SECRET`, and inspect notifications.
**Expected:** `classification.economic_dependency_warning` notification dispatched when share is in [0.70, 5/6); `classification.economic_dependency_critical` when share is ≥ 5/6; no notification when share < 0.70.
**Why human:** Cross-org aggregate correctness (denominator omits `organizationId` by design) and live notification delivery require a seeded database and running environment.

#### 2. Classification dashboard renders real data

**Test:** Navigate to `/[locale]/(dashboard)/classification` in a browser with a tenant that has classification assessments in both GB and DE markets.
**Expected:** Both market cards render with non-zero coverage percentages; risk-distribution stacked bar shows coloured segments with tooltips; overdue tile lists engagement names; CSV download produces a file with UTF-8 BOM and neutralised formula-prefix characters.
**Why human:** React Query tile independence, Suspense boundary behaviour, and signed R2 URL round-trip require a live browser session with real data.

#### 3. DRV clearance panel form validation

**Test:** On a DE engagement page, open the "File new clearance" dialog, select outcome=SELBSTANDIG, and attempt to submit without filling in validFrom/validTo.
**Expected:** Form rejects submission with a visible validation error; once both date fields are populated, submission succeeds and the panel list updates.
**Why human:** Client-side Zod mirror validation and Dialog open/close interaction require a browser session.

#### 4. Reassessment trigger creation on material change

**Test:** Update a UK contractor's contract (e.g. change `dailyRateMinor`) on an engagement that has a completed IR35 ClassificationAssessment, then trigger the `/api/cron/classification-reassessment-triggers` endpoint.
**Expected:** `AuditLog` row written with `resourceType=CONTRACT` and `action=UPDATE_CONTRACT`; cron scan produces a new `ReassessmentTrigger` row with `status=OPEN`; `classification.reassessment_trigger` notification dispatched; submitting a new IR35 assessment auto-sets the trigger to `RESOLVED`.
**Why human:** Audit-writer → audit log → cron scan → trigger creation → notification dispatch spans 4 layers and requires a live environment to confirm atomicity and ordering.

---

### Gaps Summary

No programmatically-verifiable gaps found. All 4 success criteria are structurally satisfied:
- CLASS-07: thresholds locked (70%/83.33%), scan service wired, cron authenticated, notification types registered.
- CLASS-08: audit-writer wired to 6 mutation call-sites, CronScanState present, ReassessmentTrigger model complete with all 5 back-relations, auto-resolve wired in classification.submit.
- CLASS-09: Statusfeststellungsverfahren model has all 5 required fields, detectDrvClearanceExpiries wired into existing reminders cron, DE-only panel on engagement page confirmed.
- CLASS-10: 2-market dashboard page renders 4 tiles per market, 6-procedure + exportMarketCsv router wired, CSV injection neutralised, `status: 'completed'` filter in all 5 assessment query locations.

Status is human_needed rather than passed because 4 live-environment behaviors (threshold end-to-end, dashboard real data, form client validation, trigger creation integration) cannot be verified statically.

---

_Verified: 2026-04-14T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
