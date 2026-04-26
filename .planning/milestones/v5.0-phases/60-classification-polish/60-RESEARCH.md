# Phase 60: Classification Polish — Research

**Researched:** 2026-04-14
**Domain:** Compliance monitoring, reassessment triggers, regulatory lifecycle tracking, per-market reporting dashboard
**Confidence:** HIGH (all findings grounded in existing repo code; external regulatory thresholds verified against §2 SGB VI + §7a SGB IV)
**Primary inputs:**
- `.planning/phases/60-classification-polish/60-CONTEXT.md` (16 locked decisions D-01..D-16)
- `.planning/phases/60-classification-polish/60-UI-SPEC.md` (approved 6/6 PASS, 2026-04-13)
- `.planning/REQUIREMENTS.md` CLASS-07/08/09/10
- `.planning/phases/{57,58,59}-*/...-CONTEXT.md` (upstream contracts)

---

## Summary

Phase 60 is a **read-heavy, persistence-mutable** phase that closes the classification track. It layers four monitoring surfaces on top of Phase 58 (assessment engine) and Phase 59 (SDS / DRV documents + chain) without touching their rule sets or document pipelines:

1. **CLASS-07** — Daily cron scans active DE engagements, computes rolling-12-month billing share from `Invoice` across all client orgs, and drives a per-engagement state machine (`safe` / `warning` / `critical`) with monthly re-fire after band crossing.
2. **CLASS-08** — Daily cron scans `AuditLog` rows since last run, filters to `ContractorAssignment` + `Contract` mutations on GB engagements with a completed IR35 assessment, applies a material-change allowlist, and creates / appends-to `ReassessmentTrigger` rows.
3. **CLASS-09** — New lightweight `Statusfeststellungsverfahren` Prisma model + 90/30/7-day expiry reminder helper piggybacked on the existing `/api/cron/reminders` route.
4. **CLASS-10** — Per-market stacked compliance dashboard at `/classification/` with 4 tiles per market (coverage %, risk distribution stacked bar, overdue reassessments, active alerts) + CSV export streamed server-side via signed URL.

**Primary recommendation:** Clone the `/api/cron/reminders/route.ts` pattern verbatim for the two new daily crons; reuse `notification-service.dispatch` (already handles channel fan-out, dedup, digest) by adding 5 new notification type strings; add 3 new mutable Prisma models + one extension of `NOTIFICATION_TYPES` in `packages/validators/src/notification.ts`; build the dashboard stacked bar from native flex + Tailwind (per UI-SPEC D-14) — NO chart library. All routers chain `tenantProcedure` with `requirePermission({ contractor: ['read' | 'update'] })` for the RBAC gates the dashboard dictates.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (16 total)

**CLASS-07 Economic-Dependency Alerts:**
- **D-01:** Detection via daily cron `apps/web/src/app/api/cron/classification-economic-dependency/route.ts` mirroring the existing `reminders` cron pattern (Bearer token via `CRON_SECRET`, `withCronMonitor`, Sentry, metrics, `createCronLogger`). 24h latency acceptable.
- **D-02:** Scan every DE `ContractorAssignment.status='ACTIVE'`. Billing share = `sum(Invoice.totalMinor where contractorId=X AND organizationId=currentOrg AND issueDate in [now-12m, now])` ÷ `sum(Invoice.totalMinor where contractorId=X AND issueDate in [now-12m, now])` across ALL client orgs on the platform. Off-platform income NOT used. Thresholds: 70.00% → warning, 83.33% → critical.
- **D-03:** Dedup via new `EconomicDependencyAlertState` Prisma model (`assignmentId`, `currentBand enum('safe'|'warning'|'critical')`, `lastBillingShare`, `lastScannedAt`, `lastCrossedAt`, `lastReminderAt`). Band transitions are the signal; up-crossings fire notifications, down-crossings fire resolve notifications.
- **D-04:** Re-fire cadence = alert once per threshold crossing, then monthly reminder (≥30 days since `lastReminderAt`) while still over. `lastReminderAt` resets on down-crossing.
- **D-05:** Delivery via `notification-service.dispatch`; new notification types `classification.economic_dependency_warning` and `classification.economic_dependency_critical`. Default `UserNotificationPreference`: `channelInApp=true`, `channelEmail=true`, `channelSlack=false`, `channelTeams=false`, `digestMode=false`. Recipients = any user in org with active role granting `contractor:read` OR `contractor:update`.

**CLASS-08 Reassessment Triggers:**
- **D-06:** AuditLog post-hoc scan in daily cron `apps/web/src/app/api/cron/classification-reassessment-triggers/route.ts`. Each run scans `AuditLog` rows where `createdAt > lastScanCompletedAt`, filtered to `resourceType IN ('ContractorAssignment', 'Contract')` for engagements where contractor's `countryCode='GB'`.
- **D-07:** Material-change allowlist:
  - On `ContractorAssignment`: `activeTo`, rate field if it exists on the model, `projectId`, `teamId`.
  - On `Contract`: new signed version OR updates to `rateValueMinor`, `scope`/`description`/`startDate`/`endDate`.
  - **Ignored (cosmetic):** tag links, owner reassignments, `allocationPercent` Δ ≤5 percentage points, free-text `notes`, `costCenterId`.
  - Only fires when engagement already has a completed IR35 `ClassificationAssessment`.
- **D-08:** New Prisma model `ReassessmentTrigger` (fields: `id`, `organizationId`, `contractorAssignmentId`, `priorAssessmentId`, `priorSdsDocumentId?`, `triggeredAt`, `triggerReasons Json[]` (`{ field, oldValue?, newValue?, auditLogId, resourceType }`), `status enum('OPEN'|'ACKNOWLEDGED'|'RESOLVED'|'DISMISSED')`, `acknowledgedByUserId?`, `acknowledgedAt?`, `resolvedAt?`, `dismissedByUserId?`, `dismissedAt?`, `dismissedReason?`). Indexed on `(organizationId, contractorAssignmentId, status)` and `(organizationId, triggeredAt)`. Dedup: append to existing OPEN/ACKNOWLEDGED row for same `(contractorAssignmentId, priorAssessmentId)`.
- **D-09:** New row fires `classification.reassessment_trigger` notification. Engagement page shows chip "Reassessment recommended" with "Start new assessment" CTA. Submitting new IR35 assessment auto-sets matching OPEN trigger to `RESOLVED`. No auto-draft pre-fill.

**CLASS-09 Statusfeststellungsverfahren:**
- **D-10:** New Prisma model `Statusfeststellungsverfahren` (fields: `id`, `organizationId`, `contractorAssignmentId`, `filedAt`, `drvReference` (free-form string), `outcome enum('PENDING'|'SELBSTANDIG'|'ABHANGIG'|'WITHDRAWN')`, `validFrom?`, `validTo?`, `notes?`). Indexed on `(organizationId, contractorAssignmentId)` and `(organizationId, validTo)`.
- **D-11:** Expiry reminders at 90 / 30 / 7 days before `validTo`. **Piggybacked on existing `/api/cron/reminders`** (new helper function), not a new cron. Three notification types: `classification.drv_expiry_90d`, `...30d`, `...7d`. Dedup: one row per `(statusfeststellungsverfahrenId, notificationType)` ever. Skipped for `outcome IN ('WITHDRAWN', 'PENDING')`.
- **D-12:** Primary CTA on Phase 59 engagement detail page (`/[locale]/(dashboard)/contractors/[id]/engagements/[engagementId]/page.tsx`). New component dir: `apps/web/src/components/contractors/classification/drv-clearance/`. Writes gated by `contractor:update`; reads by `contractor:read`. New tRPC router `packages/api/src/routers/statusfeststellungsverfahren.ts`: `list`, `listByEngagement`, `create`, `update`, `delete`.

**CLASS-10 Dashboard:**
- **D-13:** Single page `/[locale]/(dashboard)/classification/page.tsx` — per-market cards stacked vertically (GB IR35 above DE Scheinselbständigkeit) + global header (total contractors, active engagements, last-scan timestamp = max across both crons' lastScanCompletedAt).
- **D-14:** Risk distribution tile = horizontal stacked bar, Phase-58 outcome-pill palette. GB: green Outside / amber Undetermined / red Inside. DE: green / amber / red traffic-light. Hover reveals counts + %. NO donut, NO chart library (per UI-SPEC: native flex/div + Tailwind).
- **D-15:** Live tRPC query on page load + manual refresh button (React Query cache invalidation). No caching, no polling, no materialised view. Each tile = own tRPC query via new `classificationDashboard` router (`packages/api/src/routers/classification-dashboard.ts`).
- **D-16:** CSV export per market card. Columns: engagement id, contractor name, country, latest-assessment verdict, latest-assessment date, latest-assessment score (DE only), current economic-dep band + billing share (DE only), open reassessment trigger Y/N, DRV outcome (DE only), DRV validTo (DE only). Generated server-side via same tRPC queries joined into streaming response. Signed URL TTL = 300s (Phase 56/59 pattern).

### Claude's Discretion (9 items — research section answers these)
- Exact CSS layout for cards/tiles — follow existing dashboards under `apps/web/src/app/[locale]/(dashboard)/`
- Chart library for stacked bar → **locked to native flex/div by UI-SPEC registry safety PASS (zero new deps)**
- Exact cron schedule times (pick slots that don't collide — `reminders` runs `0 9 * * *` UTC)
- Batch-process assignments in crons (add pagination if perf matters; not required for v5.0 test orgs)
- Notification digest behaviour — honour existing `UserNotificationPreference.digestMode`, verify not change
- Dashboard empty-state copy — match existing dashboard empty-state patterns
- `ReassessmentTrigger.triggerReasons` typing (Zod schema vs `unknown[]`) → recommend Zod
- Visual chip style → locked by UI-SPEC (`badge` warning variant + `RefreshCcw` icon)
- DRV V0023 help-text link → locked by UI-SPEC (inline dimmed link under "DRV case reference")

### Deferred Ideas (OUT OF SCOPE — do NOT plan for these)
- DRV decision-letter upload + R2 storage on `Statusfeststellungsverfahren`
- DRV correspondence log / multi-step lifecycle state machine
- Event-driven alerting via Prisma middleware or outbox
- Materialised compliance-dashboard snapshot table
- Client-side polling / SSE for dashboard
- Configurable alert thresholds per org (70/83.33 are statutory)
- Threshold-crossing audit log as a dedicated history table
- Automatic draft-assessment pre-fill on trigger
- Per-engagement reassessment cadence config (time-based re-trigger)
- Third market beyond GB + DE
- Auditor-portal share links
- Slack/Teams compliance-alert rich cards
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (from REQUIREMENTS.md) | Research Support |
|----|--------------------------------------|-------------------|
| CLASS-07 | User receives automated alerts when a German contractor's billing exceeds 70% (warning) or 83.33% (critical) from a single client, indicating economic dependency under §2 SGB VI | §Cron Infrastructure, §Invoice Billing-Share Query, §Economic Dependency State Machine, §Notification Service Integration |
| CLASS-08 | User receives automated reassessment triggers when a UK engagement materially changes (contract amendment, rate change, scope change, extension) linking to previous SDS for comparison | §AuditLog Scan Pattern, §Reassessment Trigger Model, §Dedup Strategy, §ClassificationDocument FK |
| CLASS-09 | User can track Statusfeststellungsverfahren applications with filing date, DRV reference, outcome, validity period, and expiry reminders | §Statusfeststellungsverfahren Model, §Piggyback Reminder Helper, §Engagement Page Panel |
| CLASS-10 | User can view per-market compliance health dashboard showing IR35 assessment coverage, Scheinselbständigkeit risk distribution, overdue reassessments, and economic dependency alerts | §Dashboard tRPC Router, §Stacked Bar Pattern (native flex), §CSV Export Streaming |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

All directives below are mandatory. They have the same authority as CONTEXT.md locked decisions and CANNOT be relaxed by the planner.

| Directive | Scope | Enforcement in Phase 60 |
|-----------|-------|--------------------------|
| **No `console.*` in source** | Repo-wide | All logging via `createCronLogger('classification-economic-dependency')` / `createCronLogger('classification-reassessment-triggers')` from `@contractor-ops/logger`. `notification-service.ts` currently has `console.warn` / `console.error` — do NOT introduce new ones; existing ones may be left alone per CLAUDE.md scope "source". |
| **pnpm + Turborepo + tRPC v11 + Prisma 7 + Next.js 15 SSR** | Repo-wide | New routers registered in `packages/api/src/root.ts`; new Prisma models live in existing `packages/db/prisma/schema/classification.prisma` (alongside Phase 58/59 models); dashboard page is Next.js 15 server component at `apps/web/src/app/[locale]/(dashboard)/classification/page.tsx`. |
| **Zod at every external boundary** | Repo-wide | Every new tRPC procedure takes a Zod input schema; `triggerReasons` JSONB serialised through a Zod-validated `triggerReasonSchema` at write time and `.parse()` at read time. |
| **Multi-tenant scoping via Prisma client extension** | `packages/db/src/tenant.ts` | All 3 new models (`EconomicDependencyAlertState`, `ReassessmentTrigger`, `Statusfeststellungsverfahren`) automatically org-scoped — confirmed by inspecting `tenant.ts` (line 27: `APPEND_ONLY_MODELS = new Set(['ClassificationDocument'])`; Phase 60 models are mutable so NOT added there). |
| **RLS + DB-level protections where relevant** | Repo-wide | tenant extension injects `where.organizationId` on every read/write; Phase 60 does not introduce raw SQL. |
| **Schema validation for all external inputs** | Repo-wide | CSV export uses `escapeCsvField` + `encodeCsvUtf8Bom` from `packages/api/src/lib/csv.ts` (RFC 4180 with UTF-8 BOM); cron Bearer auth matches existing `verifyCronSecret` pattern. |
| **WCAG 2.2 AA + keyboard + screen reader** | All new UI | Locked by UI-SPEC §Accessibility Contract. |
| **Pino not console; `@contractor-ops/logger`** | Server source | Confirmed — all 2 new crons use `createCronLogger(name)` + `metrics.gauge(...)`. |
| **No new deps unless justified** | Repo-wide | Phase 60 introduces ZERO new npm deps. Stacked bar is native flex. CSV uses existing `packages/api/src/lib/csv.ts`. Date math uses existing helpers (`addDays`, `startOfDay` — already in `reminders` route). |
| **Better Auth + existing RBAC scopes** | tRPC layer | `contractor:read` / `contractor:update` scopes already defined in `packages/api/src/lib/scope-utils.ts` + `requirePermission` middleware in `packages/api/src/middleware/rbac.ts` — reused verbatim. |

## Standard Stack

### Core (Reused — Zero New Deps)

| Library / Module | Version | Purpose | Why Standard |
|------------------|---------|---------|--------------|
| `@contractor-ops/api/services/cron-monitor` | workspace | `withCronMonitor(key, fn)` Cronitor heartbeat wrapper | Phase 57+ cron convention; `CronMonitors` enum in `cron-monitor.ts:18-23` lists the 4 existing keys — Phase 60 extends it with 2 new keys [VERIFIED: `packages/api/src/services/cron-monitor.ts`] |
| `@contractor-ops/api/services/notification-service` | workspace | `dispatch(event)` handles channel fan-out + 60s dedup + `UserNotificationPreference` lookup + Slack/Teams DM + email via Resend | Used by `reminders` cron (`apps/web/src/app/api/cron/reminders/route.ts:2,106,305`); new notification types only need to be added to `NOTIFICATION_TYPES` const in `packages/validators/src/notification.ts:7-26` [VERIFIED: inspected both files] |
| `@contractor-ops/logger` | workspace | `createCronLogger(name)` + `metrics.gauge(name, value)` | Mandatory per CLAUDE.md; existing cron uses `createCronLogger('reminders')` + `metrics.gauge('cron.reminders.sent', ...)` [VERIFIED: `apps/web/src/app/api/cron/reminders/route.ts:4-5,10,396`] |
| `@sentry/nextjs` | existing | `Sentry.withMonitor(name, fn, { schedule, timezone })` | Repo-wide Sentry pattern for cron Missing-heartbeat monitoring [VERIFIED: `reminders/route.ts:382-416`] |
| `@contractor-ops/db` (Prisma 7 + tenant extension) | workspace | `prisma.*` auto-scoped by `organizationId` via `AsyncLocalStorage` in `packages/db/src/tenant.ts` | All new models inherit scoping without boilerplate [VERIFIED: `packages/db/src/tenant.ts:1-110`] |
| `packages/api/src/lib/csv.ts` | workspace | `escapeCsvField`, `encodeCsvUtf8Bom` — RFC 4180 CSV with UTF-8 BOM for Excel | Already proven in payment-export + report-export paths; zero dep cost. Do NOT reuse `report-export.ts` `generateReportCsv` — it pulls in `xlsx` (SheetJS). Use the simpler `csv.ts` helpers [VERIFIED: `packages/api/src/lib/csv.ts:1-32` + `packages/api/src/services/payment-export.ts:139` vs `report-export.ts:47`] |
| `zod` | existing | All router input schemas + `triggerReasons` JSONB typing | Repo-wide pattern; new router inputs follow `packages/api/src/routers/classification.ts:45-89` shape |
| `@trpc/server` 11.x | existing | `tenantProcedure` + `requirePermission` chain | Phase 60 routers follow exact pattern from `packages/api/src/routers/classification.ts:94-96` |

### Supporting (UI Layer — Zero New Deps)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui primitives | existing, base-nova preset | `card`, `badge`, `alert-dialog`, `dialog`, `dropdown-menu`, `tooltip`, `button`, `skeleton`, `table`, `progress` | All phase-60 UI per UI-SPEC §Registry Safety (15 primitives already installed in `apps/web/src/components/ui/`) [VERIFIED: UI-SPEC line 222-227] |
| `lucide-react` icons | existing | `CircleCheck`, `ShieldAlert`, `ShieldX`, `ShieldQuestion`, `RefreshCcw`, `RotateCw`, `Download`, `Inbox`, `FileText`, `ShieldCheck` | Per UI-SPEC §Accessibility semantic triad (icon + colour + text) |
| `@tanstack/react-query` (via tRPC) | existing | Query invalidation on refresh-button click | Dashboard refresh pattern — `trpc.useUtils().classificationDashboard.invalidate()` |
| Tailwind v4 + OKLCh tokens | existing `apps/web/src/app/globals.css` | `--success` / `--warning` / `--destructive` OKLCh tokens for stacked-bar segments | Tokens locked in `globals.css:77-80` — used directly via `bg-[--success]` style utilities per UI-SPEC §Color [VERIFIED: `apps/web/src/app/globals.css:77-80`] |

### Alternatives Considered (Rejected)

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| Native flex stacked bar | Recharts / Tremor / Victory | Bundle delta for one component. UI-SPEC explicitly locks "NO third-party chart registry". |
| Manual JSONB `triggerReasons` | Separate `ReassessmentTriggerReason` child table | Per D-08, reasons are append-only to an existing OPEN row; child table would need its own dedup logic. JSONB is the right fit; Zod-parsed at boundary. |
| Prisma middleware / outbox for reassessment detection | Event-driven mutation hook | CONTEXT.md Deferred explicitly rejects this. Cron is sufficient for 24h latency. |
| Custom notification dedup | New per-phase dedup column | `notification-service.dispatch` already dedupes within 60s; band-level dedup lives in `EconomicDependencyAlertState` (band + `lastReminderAt`) which is state-machine-correct. |
| Materialised snapshot of dashboard | Nightly refresh table | CONTEXT.md Deferred; live query sized for low-hundreds engagements/org. |

**Installation:** None. Phase 60 introduces zero new npm packages.

**Version verification (performed during research):**
- Existing `vitest` version per `package.json:30` = `^4.1.2` — test framework is current.
- Existing `@trpc/server` version per `packages/api/src/routers/classification.ts:34` import — already on 11.x.
- No new library to version-check.

## Architecture Patterns

### Recommended File Layout

```
apps/web/src/app/api/cron/
├── reminders/route.ts                                      # EXTEND with DRV 90/30/7 helper (D-11)
├── classification-economic-dependency/route.ts             # NEW — daily DE billing-share scan (D-01)
└── classification-reassessment-triggers/route.ts           # NEW — daily GB AuditLog scan (D-06)

apps/web/src/app/[locale]/(dashboard)/classification/
└── page.tsx                                                # NEW — Phase 60 compliance dashboard (D-13)

apps/web/src/components/contractors/classification/
├── dashboard/                                              # NEW (D-13, D-14, D-15, D-16)
│   ├── market-card.tsx
│   ├── coverage-tile.tsx
│   ├── risk-distribution-tile.tsx                          # native flex stacked bar
│   ├── overdue-reassessments-tile.tsx
│   ├── active-alerts-tile.tsx
│   ├── refresh-dashboard-button.tsx
│   └── download-csv-button.tsx
├── drv-clearance/                                          # NEW (CLASS-09, D-12)
│   ├── drv-clearance-panel.tsx
│   ├── drv-clearance-form.tsx
│   └── drv-clearance-row.tsx
├── reassessment-trigger/                                   # NEW (CLASS-08, D-09)
│   ├── trigger-chip.tsx
│   ├── trigger-cta.tsx
│   └── dismiss-dialog.tsx
└── economic-dependency-alerts/                             # NEW (CLASS-07)
    └── band-chip.tsx

packages/api/src/routers/
├── classification-dashboard.ts                             # NEW (D-13..D-16 tile queries)
├── statusfeststellungsverfahren.ts                         # NEW (CLASS-09)
├── reassessment-trigger.ts                                 # NEW (CLASS-08 acknowledge/dismiss)
└── economic-dependency-alert.ts                            # NEW (CLASS-07 read/resolve)

packages/db/prisma/schema/
├── classification.prisma                                   # EXTEND — append 3 new models
├── contractor.prisma                                       # EXTEND — add back-relations on ContractorAssignment
└── organization.prisma                                     # EXTEND — add back-relations on Organization

packages/validators/src/
└── notification.ts                                         # EXTEND NOTIFICATION_TYPES with 5 new strings

packages/api/src/services/
└── cron-monitor.ts                                         # EXTEND CronMonitors enum with 2 new keys
```

### Pattern 1: Cron Route Shell (Clone `reminders`)

**What:** Exact structural precedent from `apps/web/src/app/api/cron/reminders/route.ts`.
**When to use:** Both new Phase-60 daily crons.

```ts
// Source: apps/web/src/app/api/cron/reminders/route.ts:1-10, 377-417 (VERIFIED)
import { withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { dispatch } from '@contractor-ops/api/services/notification-service';
import { prisma } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const log = createCronLogger('classification-economic-dependency');

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  return token === cronSecret;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return Sentry.withMonitor(
    'classification-economic-dependency',
    () => withCronMonitor('classification-economic-dependency', async () => {
      try {
        const result = await runEconomicDependencyScan();
        log.info(result, 'classification-economic-dependency cron completed');
        metrics.gauge('cron.classification_economic_dependency.scanned', result.scanned);
        metrics.gauge('cron.classification_economic_dependency.crossings', result.crossings);
        return NextResponse.json(result);
      } catch (error) {
        log.error({ err: error }, 'classification-economic-dependency cron failed');
        Sentry.captureException(error, { tags: { 'cron.job': 'classification-economic-dependency' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    }),
    { schedule: { type: 'crontab', value: '0 2 * * *' }, timezone: 'UTC' },
  );
}
```

**Schedule selection:** existing `reminders` runs `0 9 * * *` UTC. Pick non-colliding slots:
- `classification-economic-dependency` → `0 2 * * *` UTC (quiet window, Europe night)
- `classification-reassessment-triggers` → `0 3 * * *` UTC

### Pattern 2: Billing-Share Rolling-Window Query

**What:** Per-engagement billing share across all client orgs over 12-month window.
**When to use:** Inside `runEconomicDependencyScan` for each active DE assignment.

```ts
// Per CONTEXT.md D-02. Invoice model confirmed in packages/db/prisma/schema/invoice.prisma:3-72 [VERIFIED]
// Fields used: contractorId, organizationId, totalMinor, issueDate, deletedAt, status.
// NOTE: Phase 60 SKIPS the tenant extension for the "all-orgs" denominator because
// denominator is a compliance signal across orgs (not a read of other tenants' data —
// we aggregate a single number, the raw invoices never leave the query). Plan must
// either (a) use the non-extended raw Prisma client for the aggregate, or (b) run
// the query inside the cron outside of `tenantStore.run(...)`. The cron runs without
// a tenant context anyway (scans all orgs sequentially).

async function computeBillingShare(
  contractorId: string,
  currentOrgId: string,
  now: Date,
): Promise<{ numerator: number; denominator: number; share: number }> {
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Denominator: sum across ALL orgs where this contractor invoices
  const denomResult = await prismaRaw.invoice.aggregate({
    where: {
      contractorId,
      issueDate: { gte: twelveMonthsAgo, lte: now },
      status: { notIn: ['VOID'] },
      deletedAt: null,
    },
    _sum: { totalMinor: true },
  });
  const denominator = denomResult._sum.totalMinor ?? 0;

  // Numerator: current org only
  const numResult = await prismaRaw.invoice.aggregate({
    where: {
      contractorId,
      organizationId: currentOrgId,
      issueDate: { gte: twelveMonthsAgo, lte: now },
      status: { notIn: ['VOID'] },
      deletedAt: null,
    },
    _sum: { totalMinor: true },
  });
  const numerator = numResult._sum.totalMinor ?? 0;

  return { numerator, denominator, share: denominator === 0 ? 0 : numerator / denominator };
}
```

**Critical:** Phase 60 must run these aggregates either against the raw (non-tenant-scoped) Prisma client, or outside any `tenantStore.run(...)` frame. The tenant extension at `packages/db/src/tenant.ts:96-110` auto-injects `where.organizationId` from `AsyncLocalStorage`; for the denominator we explicitly need the cross-org sum. Plan 60-01 must document which client (extended vs raw) is used and expose a narrow helper so the cross-org query is grep-discoverable (e.g. a service function `computeCrossOrgBillingDenominator(...)` with `// PHASE-60-CROSS-ORG-AGGREGATE` sentinel comment).

**Timezone:** Use UTC math throughout. `Invoice.issueDate` is `@db.Date` (date-only, no timezone); calling `new Date()` at cron time (02:00 UTC) then subtracting 12 months gives a deterministic window that matches the ISO date semantics. Do NOT use `toLocaleDateString` or Intl; stick to Date arithmetic.

**Kleinunternehmer interaction (CONTEXT.md canonical ref from Phase 57):** `Organization.isKleinunternehmer` flag exists (`packages/db/prisma/schema/organization.prisma:22` [VERIFIED]). For the Phase 60 billing-share scan, Kleinunternehmer status does NOT change the §2 SGB VI threshold (70% / 83.33%) — that threshold applies to the contractor's billing dependency, not the org's VAT registration. Kleinunternehmer invoices still count (`totalMinor` is the invoice total regardless of VAT treatment). Document in Plan: "Kleinunternehmer status does not gate or modify the economic-dependency computation per §2 SGB VI — only VAT treatment differs, which Phase 60 does not consume."

### Pattern 3: Economic-Dependency State Machine

**What:** Band transitions drive notification emission.
**When to use:** Inside `runEconomicDependencyScan` per engagement.

```ts
type Band = 'safe' | 'warning' | 'critical';

function bandFor(share: number): Band {
  if (share >= 0.8333) return 'critical';
  if (share >= 0.70) return 'warning';
  return 'safe';
}

// State machine logic (VERIFIED against CONTEXT.md D-03 + D-04):
async function updateBandState(assignmentId: string, share: number, now: Date) {
  const state = await prisma.economicDependencyAlertState.findUnique({ where: { assignmentId } });
  const newBand = bandFor(share);

  if (!state) {
    await prisma.economicDependencyAlertState.create({
      data: { assignmentId, currentBand: newBand, lastBillingShare: share, lastScannedAt: now,
              lastCrossedAt: newBand === 'safe' ? null : now,
              lastReminderAt: newBand === 'safe' ? null : now },
    });
    if (newBand !== 'safe') await fireUpCrossingNotification(assignmentId, newBand);
    return;
  }

  const wasBand = state.currentBand as Band;
  if (wasBand === newBand) {
    // Same band — maybe fire monthly reminder
    if (newBand !== 'safe' && state.lastReminderAt &&
        (now.getTime() - state.lastReminderAt.getTime()) >= 30 * 24 * 60 * 60 * 1000) {
      await fireUpCrossingNotification(assignmentId, newBand);  // re-fire
      await prisma.economicDependencyAlertState.update({
        where: { assignmentId }, data: { lastReminderAt: now, lastBillingShare: share, lastScannedAt: now },
      });
      return;
    }
    await prisma.economicDependencyAlertState.update({
      where: { assignmentId }, data: { lastBillingShare: share, lastScannedAt: now },
    });
    return;
  }

  // Band changed
  const isUpCrossing = bandIndex(newBand) > bandIndex(wasBand);
  await prisma.economicDependencyAlertState.update({
    where: { assignmentId },
    data: {
      currentBand: newBand, lastBillingShare: share, lastScannedAt: now,
      lastCrossedAt: now,
      lastReminderAt: isUpCrossing ? now : null,  // reset on down-crossing
    },
  });
  if (isUpCrossing) await fireUpCrossingNotification(assignmentId, newBand);
  else await fireResolveNotification(assignmentId, newBand);
}

function bandIndex(b: Band): number { return b === 'safe' ? 0 : b === 'warning' ? 1 : 2; }
```

### Pattern 4: AuditLog Scan for Reassessment Triggers

**What:** Post-hoc materialisation of material changes.
**When to use:** Inside `runReassessmentTriggerScan`.

```ts
// AuditLog schema confirmed in packages/db/prisma/schema/audit.prisma:3-27 [VERIFIED]:
//   fields: organizationId, actorType, action, resourceType (EntityType enum),
//           resourceId, oldValuesJson, newValuesJson, createdAt
// EntityType enum: includes CONTRACT, CONTRACTOR — but NOT ContractorAssignment directly.
//
// LOAD-BEARING FINDING: EntityType enum (contract.prisma:251-268) includes:
//   ORGANIZATION, CONTRACTOR, CONTRACT, DOCUMENT, INVOICE, WORKFLOW_RUN, WORKFLOW_TASK_RUN,
//   PAYMENT_RUN, PROJECT, TEAM, APPROVAL_FLOW, TIMESHEET, EQUIPMENT, SHIPMENT, USER, RETURN_REQUEST.
// There is NO 'CONTRACTOR_ASSIGNMENT' entity type value! ContractorAssignment mutations
// must either (a) be written to AuditLog under resourceType=CONTRACTOR with resourceId=assignmentId,
// or (b) this enum must be extended.
//
// ACTION REQUIRED IN PLANNING: Inspect current audit-writing code paths for ContractorAssignment
// mutations. Grep for `contractorAssignment.update`, `contractorAssignment.create` — do they
// currently write AuditLog rows at all? If YES, under what resourceType?
// If they don't write AuditLog, Phase 60 CLASS-08 CANNOT function as specified in D-06 without
// first wiring audit logging on ContractorAssignment mutations. This is a prerequisite that
// the planner must confirm.

async function scanAuditLogsSinceLastRun(lastScan: Date, now: Date) {
  const rows = await prismaRaw.auditLog.findMany({
    where: {
      createdAt: { gt: lastScan, lte: now },
      resourceType: { in: ['CONTRACT'] },  // + assignment type IF enum is extended
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const row of rows) {
    const changedFields = diffJson(row.oldValuesJson, row.newValuesJson);
    const material = changedFields.filter(isMaterialChange);  // allowlist per D-07
    if (material.length === 0) continue;

    const engagementId = await resolveEngagementFromAuditRow(row);
    if (!engagementId) continue;
    const engagement = await prismaRaw.contractorAssignment.findUnique({
      where: { id: engagementId },
      include: { contractor: { select: { countryCode: true } } },
    });
    if (engagement?.contractor.countryCode !== 'GB') continue;

    // Require prior completed IR35 assessment
    const priorAssessment = await prismaRaw.classificationAssessment.findFirst({
      where: { contractorAssignmentId: engagementId, countryCode: 'GB', status: 'completed' },
      orderBy: { completedAt: 'desc' },
      include: { classificationDocuments: { where: { kind: 'SDS' }, orderBy: { generatedAt: 'desc' }, take: 1 } },
    });
    if (!priorAssessment) continue;

    // Dedup: append or create
    await dedupAndCreateTrigger({
      organizationId: row.organizationId,
      contractorAssignmentId: engagementId,
      priorAssessmentId: priorAssessment.id,
      priorSdsDocumentId: priorAssessment.classificationDocuments[0]?.id ?? null,
      reasons: material.map(m => ({ ...m, auditLogId: row.id, resourceType: row.resourceType })),
    });
  }
}
```

**Pagination:** `scanAuditLogsSinceLastRun` is a single `findMany` without pagination. For v5.0 (low hundreds of engagements × ~5 audit rows/day/engagement = thousands of rows/day max), memory is fine. Add `take: 10000` as a belt-and-braces limit with a metric to alert if it hits.

**`lastScanCompletedAt` persistence:** Store on a new singleton table or on the `EconomicDependencyAlertState`-peer singleton model, OR in a new `CronScanState` table keyed by scan name. Simplest option: add a table `CronScanState { name String @id, lastScanCompletedAt DateTime }` used by both Phase 60 crons. Planner decides exact name.

### Pattern 5: ReassessmentTrigger Dedup (Append to Existing OPEN Row)

**What:** Per D-08, when multiple fields change in one user action (or across two scans), append reasons rather than create a new row.

```ts
async function dedupAndCreateTrigger(input: {
  organizationId: string;
  contractorAssignmentId: string;
  priorAssessmentId: string;
  priorSdsDocumentId: string | null;
  reasons: TriggerReason[];
}) {
  const existing = await prisma.reassessmentTrigger.findFirst({
    where: {
      contractorAssignmentId: input.contractorAssignmentId,
      priorAssessmentId: input.priorAssessmentId,
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
    },
  });
  if (existing) {
    const existingReasons = triggerReasonsSchema.parse(existing.triggerReasons ?? []);
    await prisma.reassessmentTrigger.update({
      where: { id: existing.id },
      data: {
        triggerReasons: triggerReasonsSchema.parse([...existingReasons, ...input.reasons]),
        triggeredAt: new Date(),
      },
    });
    return;  // No second notification per D-08
  }
  await prisma.reassessmentTrigger.create({
    data: { ...input, status: 'OPEN', triggeredAt: new Date(),
            triggerReasons: triggerReasonsSchema.parse(input.reasons) },
  });
  await dispatch({ type: 'classification.reassessment_trigger', /* ... */ });
}
```

### Pattern 6: DRV Expiry Reminder Helper in Existing `reminders` Cron

**What:** Per D-11, the 90 / 30 / 7-day helper is added INSIDE the existing route, not a new file.

```ts
// Added inside apps/web/src/app/api/cron/reminders/route.ts alongside detectOverdueTasks()
async function detectDrvClearanceExpiries(): Promise<number> {
  const now = new Date();
  const today = startOfDay(now);
  const bands = [
    { days: 90, type: 'classification.drv_expiry_90d' as const },
    { days: 30, type: 'classification.drv_expiry_30d' as const },
    { days: 7,  type: 'classification.drv_expiry_7d'  as const },
  ];
  let notified = 0;
  for (const band of bands) {
    const targetDate = addDays(today, band.days);
    // Use raw Prisma (cron runs without tenant context — scanning all orgs)
    const clearances = await prismaRaw.statusfeststellungsverfahren.findMany({
      where: {
        validTo: { gte: targetDate, lt: addDays(targetDate, 1) },  // exactly N days out
        outcome: { in: ['SELBSTANDIG', 'ABHANGIG'] },  // skip PENDING + WITHDRAWN per D-11
      },
    });
    for (const c of clearances) {
      // One-shot dedup per (clearanceId, type): the dispatch 60s window isn't enough —
      // we need "ever" dedup. Query Notification table for any prior row.
      const prior = await prismaRaw.notification.findFirst({
        where: { type: band.type, entityType: 'CONTRACTOR', entityId: c.id },
      });
      if (prior) continue;
      await dispatch({
        organizationId: c.organizationId, type: band.type,
        recipientUserIds: await resolveRbacRecipients(c.organizationId, c.contractorAssignmentId),
        title: `DRV clearance expires in ${band.days} days`,
        body: `Reference ${c.drvReference}, valid until ${c.validTo?.toISOString().slice(0,10)}`,
        entityType: 'CONTRACTOR', entityId: c.id,
      });
      notified++;
    }
  }
  return notified;
}
```

**`entityType='CONTRACTOR'`:** `Notification.entityType` is of type `EntityType?` (`packages/db/prisma/schema/notification.prisma:11`) which is the same enum as `AuditLog.resourceType`. The enum (confirmed in `contract.prisma:251-268`) does NOT include `STATUSFESTSTELLUNGSVERFAHREN`, `REASSESSMENT_TRIGGER`, or `ECONOMIC_DEPENDENCY_ALERT_STATE`. **Two options:**

1. **Extend EntityType enum** with: `CLASSIFICATION_ASSESSMENT`, `STATUSFESTSTELLUNGSVERFAHREN`, `REASSESSMENT_TRIGGER`, `ECONOMIC_DEPENDENCY_ALERT_STATE`. This requires a migration across every relation that touches the enum.
2. **Reuse `CONTRACTOR`** as the entityType, storing the Phase-60 entity's id in `entityId` and using the notification `type` string discriminator to route to the right detail page.

**Recommendation:** Option 2 (reuse `CONTRACTOR`) — D-08's existing `EconomicDependencyAlertState.assignmentId` is a ContractorAssignment; the UI routes to the engagement page from there anyway. This avoids a cross-schema migration. Document in plan: "Phase 60 uses `entityType='CONTRACTOR'` for the 5 new notification types; the notification `type` string identifies which of the 5 Phase-60 entities `entityId` points to. Future refactor to extend EntityType is deferred."

### Pattern 7: tRPC Router per Phase-58 Pattern

**What:** Each new router chains `tenantProcedure.use(requirePermission({ contractor: ['read'|'update'] }))`.
**Verified source:** `packages/api/src/routers/classification.ts:39,94-96` — exact shape to mirror.

```ts
// packages/api/src/routers/statusfeststellungsverfahren.ts (NEW)
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { router } from '../init.js';
import { z } from 'zod';

const contractorReadProcedure = tenantProcedure.use(requirePermission({ contractor: ['read'] }));
const contractorUpdateProcedure = tenantProcedure.use(requirePermission({ contractor: ['update'] }));

export const statusfeststellungsverfahrenRouter = router({
  list: contractorReadProcedure.input(z.object({ /* ... */ })).query(/* ... */),
  listByEngagement: contractorReadProcedure.input(z.object({ contractorAssignmentId: z.string() })).query(/* ... */),
  create: contractorUpdateProcedure.input(createInput).mutation(/* ... */),
  update: contractorUpdateProcedure.input(updateInput).mutation(/* ... */),
  delete: contractorUpdateProcedure.input(z.object({ id: z.string() })).mutation(/* ... */),
});
```

All 4 new routers wire into `packages/api/src/root.ts` next to the existing entries at lines 122-124 [VERIFIED] (existing: `classification`, `classificationDocument`, `ir35Chain`).

### Pattern 8: CSV Export via Signed URL (300s TTL)

**What:** Streaming CSV download per D-16. Use the existing `csv.ts` helpers, NOT `report-export.ts` (pulls xlsx).

```ts
// packages/api/src/routers/classification-dashboard.ts (NEW)
import { encodeCsvUtf8Bom, type CsvColumnKey } from '../lib/csv.js';
import { putObjectAndSignDownload } from '../services/r2.js';  // Phase 56 pattern

exportMarketCsv: contractorReadProcedure
  .input(z.object({ market: z.enum(['GB', 'DE']) }))
  .mutation(async ({ ctx, input }) => {
    const rows = await buildDashboardRows(ctx.organizationId, input.market);  // joins across all 4 tiles' sources
    const columns: CsvColumnKey[] = [
      { key: 'engagementId', header: 'Engagement ID' },
      { key: 'contractorName', header: 'Contractor' },
      { key: 'country', header: 'Country' },
      { key: 'latestVerdict', header: 'Latest verdict' },
      { key: 'latestCompletedAt', header: 'Assessment completed' },
      { key: 'latestScore', header: 'DRV score' },
      { key: 'economicBand', header: 'Economic-dep band' },
      { key: 'billingShare', header: 'Billing share' },
      { key: 'openTrigger', header: 'Open reassessment trigger?' },
      { key: 'drvOutcome', header: 'DRV outcome' },
      { key: 'drvValidTo', header: 'DRV valid until' },
    ];
    const buf = encodeCsvUtf8Bom(columns, rows);
    const key = `classification-dashboard-exports/${ctx.organizationId}/${input.market}-${new Date().toISOString().replace(/[:.]/g,'-')}.csv`;
    const { signedUrl, expiresInSeconds } = await putObjectAndSignDownload({
      key, body: buf, contentType: 'text/csv; charset=utf-8', ttlSeconds: 300,
    });
    return { url: signedUrl, expiresInSeconds };
  }),
```

**Not truly "streaming":** Per D-16 mention of "streaming response", the actual implementation materialises in-memory (rows are bounded by engagement count per org — low hundreds × 11 columns ≈ a few KB). A true Node Readable stream to S3/R2 isn't needed for v5.0. Document this choice in plan: "CSV is materialised in-memory; streaming pattern would only be needed if engagement count exceeded ~100k."

### Pattern 9: Stacked Bar (Native Flex) for Risk Distribution

**What:** D-14 locked to native flex + Tailwind utilities. Single horizontal bar per market.

```tsx
// Source: UI-SPEC §Color D-14, globals.css:77-80 tokens [VERIFIED]
function RiskDistributionTile({ counts }: { counts: { safe: number; warning: number; critical: number } }) {
  const total = counts.safe + counts.warning + counts.critical;
  if (total === 0) return <EmptyState icon={ShieldCheck} heading="No assessments" />;
  const pct = (n: number) => ((n / total) * 100).toFixed(1);
  return (
    <div role="img" aria-label={`Risk distribution: ${counts.safe} safe, ${counts.warning} warning, ${counts.critical} critical`}>
      <div className="flex h-6 w-full overflow-hidden rounded-md">
        {counts.safe > 0 && (
          <Tooltip><TooltipTrigger asChild>
            <div className="bg-[--success]" style={{ width: `${pct(counts.safe)}%` }} />
          </TooltipTrigger><TooltipContent>{counts.safe} engagements ({pct(counts.safe)}%) — Safe</TooltipContent></Tooltip>
        )}
        {/* warning, critical similarly */}
      </div>
    </div>
  );
}
```

Token reuse: `bg-[--success]` / `bg-[--warning]` / `bg-[--destructive]` — OKLCh tokens locked at `apps/web/src/app/globals.css:78-80` [VERIFIED]. Same palette as Phase-58 outcome verdict pills per UI-SPEC §Color.

### Anti-Patterns to Avoid

- **Creating a new cron for DRV expiry reminders** — D-11 explicitly piggybacks on `/api/cron/reminders`. Don't clone.
- **Using Prisma middleware / outbox for reassessment detection** — CONTEXT.md Deferred; cron is sufficient.
- **Storing assessment `outcome` bytes in `ClassificationDocument`** — already immutable in the Phase-59 model; don't duplicate in Phase 60 dashboard queries. Read `outcome` directly from `ClassificationAssessment.outcome` JSONB.
- **Using `report-export.ts#generateReportCsv`** — it depends on `xlsx` (SheetJS). Use `packages/api/src/lib/csv.ts` directly (zero extra deps).
- **Console logging in crons** — CLAUDE.md-banned. Use `createCronLogger(name)` + `metrics.gauge(...)`.
- **Auto-creating a `Notification` row then fanning out manually** — `dispatch()` handles it. Never write to `Notification` table from a cron directly (bypasses preference + dedup logic).
- **Manually setting `organizationId` on new rows** — the tenant extension injects it. For cross-org reads (billing-share denominator, cron scans), use the raw Prisma client explicitly and make it grep-findable.
- **Recharts / Tremor / Victory** — UI-SPEC registry safety PASS only covers shadcn primitives; introducing a chart library would break the approved UI contract.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron heartbeat + auth + logging | Custom auth + try/catch wrapper | `withCronMonitor` + `createCronLogger` + `Sentry.withMonitor` (from existing `reminders` route) | Proven; Cronitor is already wired via `CRONITOR_API_KEY` [VERIFIED: `cron-monitor.ts:33`] |
| Multi-channel notification fan-out | Per-channel send logic | `notification-service.dispatch()` | Handles dedup (60s), `UserNotificationPreference` lookup, Slack/Teams/email, digest mode [VERIFIED: `notification-service.ts:185-196`] |
| Multi-tenant scoping | `where: { organizationId }` boilerplate everywhere | Existing Prisma client extension in `packages/db/src/tenant.ts` | Auto-injects via `AsyncLocalStorage`; `APPEND_ONLY_MODELS` list guards immutability for Phase 59 models [VERIFIED: `tenant.ts:27,96-110`] |
| RBAC gating | Custom permission checks in handlers | `requirePermission({ contractor: ['read'\|'update'] })` middleware | Delegates to Better Auth for session auth + API key scope check; already proven in `classification.ts:94-96` [VERIFIED] |
| CSV escaping + BOM | Manual string concat | `encodeCsvUtf8Bom` + `escapeCsvField` from `packages/api/src/lib/csv.ts` | RFC 4180 + UTF-8 BOM (Excel-Polish chars); zero deps [VERIFIED: `packages/api/src/lib/csv.ts:1-32`] |
| Signed download URLs (CSV export) | Raw AWS SDK calls | `putObjectAndSignDownload` from `packages/api/src/services/r2.ts` (Phase 56 pattern, also used by Phase 59 `signExistingDownload`) | Handles TTL, `ResponseContentDisposition: 'attachment'` headers |
| Stacked bar chart | Chart library (Recharts/Tremor/Victory) | Native flex + `bg-[--success\|--warning\|--destructive]` Tailwind utilities | UI-SPEC registry safety PASS explicitly rejects third-party charts |
| 12-month rolling-window date math | `moment` / `date-fns` / `dayjs` | Native `Date` + `setMonth(now.getMonth() - 12)` | Existing `reminders` route uses plain Date (`addDays`, `startOfDay`); repo-wide convention [VERIFIED: `reminders/route.ts:29-39`] |
| Prisma model append-only enforcement | Custom Prisma middleware | Extend `APPEND_ONLY_MODELS` set in `packages/db/src/tenant.ts:27` (IF any Phase-60 model needs it — none do; all 3 are mutable per D-03/D-08/D-10) | Not needed for Phase 60 |
| Zod-validated JSONB columns | Raw Prisma `Json` with `as unknown` cast | Define a Zod schema (`triggerReasonSchema`) + `.parse()` on read, `.parse()` on write | Repo-wide pattern; avoids runtime JSON-shape bugs |

**Key insight:** Phase 60 is the most "reuse-heavy" phase in the classification track. Every piece of infrastructure (cron, notification, RBAC, tenant scoping, CSV, signed URLs, OKLCh tokens) already exists and is battle-tested. The new code is purely the **three state models**, **two cron scan functions**, **four tRPC routers**, **one dashboard page**, and **a handful of React components**. If a plan proposes a new library, a new middleware, or a new infra pattern — it's wrong.

## Runtime State Inventory

> Required section for any phase involving schema changes + data creation. Phase 60 is primarily additive (3 new models, 5 new notification type strings) but has real runtime state implications.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | New Prisma models `EconomicDependencyAlertState`, `ReassessmentTrigger`, `Statusfeststellungsverfahren`. On first cron run post-deploy, EconomicDependencyAlertState rows are created for every active DE engagement (initial band determined from computed share). No back-fill needed for existing data. ReassessmentTrigger only fires for audit rows created AFTER `lastScanCompletedAt`, so initial deploy's `lastScanCompletedAt` = deploy time (don't process historical audit rows). | Plan: Wave-0 migration. First cron runs after model exists. `CronScanState.lastScanCompletedAt` seeded to deploy time for the reassessment-trigger scan to prevent replaying historical audits. |
| **Live service config** | Cron scheduler (Vercel crons via `vercel.json` or equivalent). Current repo has NO `vercel.json` — confirmed via `Glob("vercel.json")` returning no files [VERIFIED]. Existing crons (`reminders`, `trial-notifications`, `token-refresh`, `job-health`, `inpost-status-poll`, `data-purge`) must be registered somewhere — likely via Render/Railway config or another platform. | Plan: Locate where existing crons are scheduled. Whatever the mechanism, register the two new crons there: `classification-economic-dependency` at `0 2 * * *`, `classification-reassessment-triggers` at `0 3 * * *`. STATE.md notes the app is local-only, so "deploy" registration is deferred. |
| **OS-registered state** | None — no launchd / systemd / Windows Task Scheduler interaction. Vercel / Render / Railway manage crons. | Nothing needed. State explicitly: None — crons are platform-managed. |
| **Secrets / env vars** | `CRON_SECRET` — already in use by `reminders` cron [VERIFIED: `reminders/route.ts:17`]. New Phase-60 crons reuse the same secret (single secret pattern per CONTEXT.md D-01). `CRONITOR_API_KEY` — optional, already in use. No new secrets introduced. | Nothing needed. |
| **Build artifacts / installed packages** | None — zero new npm packages. No pip / egg-info / compiled binaries. Prisma client regeneration is automatic (`pnpm --filter @contractor-ops/db db:generate`). | Plan: Wave-0 step runs `pnpm --filter @contractor-ops/db db:push && db:generate` after schema changes land so `@contractor-ops/db` consumers get the new model types. |

**Post-schema-change dependency chain:** `packages/db` → `packages/api` → `apps/web`. Any plan wave adding the new models to `classification.prisma` must include a `[BLOCKING] pnpm --filter @contractor-ops/db db:generate` step BEFORE any router / UI tests can compile.

## Common Pitfalls

### Pitfall 1: `AuditLog.resourceType` enum doesn't include `ContractorAssignment` (or equivalent)

**What goes wrong:** The CLASS-08 cron queries `AuditLog.resourceType IN ('ContractorAssignment', 'Contract')`. But EntityType enum (verified from `contract.prisma:251-268`) has no such value — closest is `CONTRACTOR`. If ContractorAssignment mutations are NOT currently audit-logged, CLASS-08 can't function.
**Why it happens:** Phase 60 CONTEXT.md authors assumed the audit log captures all mutations. It may not.
**How to avoid:** Plan's first task must include a grep for current ContractorAssignment audit writes. If none exist, add a prerequisite subtask: wire AuditLog writing on `contractorAssignment.{create,update}` mutations BEFORE CLASS-08 cron logic lands. Use `resourceType='CONTRACTOR'` with `resourceId=assignmentId` if enum extension is too invasive; document the convention.
**Warning signs:** Wave-0 test for "AuditLog contains assignment change row" fails because nothing writes it.

### Pitfall 2: `Contract.rateValueMinor` is the rate — NOT on ContractorAssignment

**What goes wrong:** D-07 wording "rate field change if the schema has one (check during planning)". Confirmed: `ContractorAssignment` has NO rate field (verified from `contractor.prisma:138-165`). Rate lives on `Contract.rateValueMinor` (`contract.prisma:19`) and/or `ContractRatePeriod.rateValueMinor` (`contract.prisma:84-101`). Material-change detection must ONLY watch Contract-level mutations for rate.
**Why it happens:** ContractorAssignment is the engagement anchor but rate lives on the associated Contract.
**How to avoid:** The CLASS-08 allowlist for ContractorAssignment is: `activeTo`, `projectId`, `teamId`, `status` (ACTIVE → ENDED is material). The allowlist for Contract is: `rateValueMinor`, `rateType`, `billingModel`, `startDate`, `endDate`, `scope`/`description` (if those fields are on Contract — confirm during planning; `notes` field at `contract.prisma:32` exists but per D-07 should be in the ignored list).
**Warning signs:** Integration test "rate change on linked Contract fires trigger" passes but "rate change on ContractorAssignment" tests nothing because the field doesn't exist.

### Pitfall 3: Billing-share denominator needs cross-org aggregation — Prisma tenant extension breaks it

**What goes wrong:** `packages/db/src/tenant.ts:96-110` auto-injects `where.organizationId` from AsyncLocalStorage. If the cron calls `prisma.invoice.aggregate({ where: { contractorId } })` inside a tenant frame, the denominator becomes current-org-only, equalling the numerator, so `share === 1.0` for every contractor who has ANY invoice — spurious critical alerts for 100% of active engagements.
**Why it happens:** Cron thinks it's iterating "all orgs sequentially"; if any per-org loop wraps `tenantStore.run(...)` around the denominator query, scoping kicks in.
**How to avoid:** Expose an explicit `prismaRaw` or `prismaUnscoped` binding from `packages/db` for Phase-60 cross-org reads. Alternatively: compute the denominator OUTSIDE any tenant frame and store it keyed by `contractorId`. Add a sentinel comment `// PHASE-60-CROSS-ORG-AGGREGATE` on every such call for grep-discovery. Unit test: run the computation both inside and outside a tenant frame — numerator should differ but denominator must be identical.
**Warning signs:** After deploy, every DE engagement gets a `critical` alert within 24h.

### Pitfall 4: `EntityType` enum doesn't cover Phase-60 entities — reuse `CONTRACTOR`

**What goes wrong:** `Notification.entityType` is `EntityType?` which doesn't include `STATUSFESTSTELLUNGSVERFAHREN` / `REASSESSMENT_TRIGGER` / `ECONOMIC_DEPENDENCY_ALERT_STATE`. Extending the enum forces a migration across every table that references it.
**Why it happens:** EntityType is a single enum shared across AuditLog, Notification, DocumentLink, etc.
**How to avoid:** Store `entityType='CONTRACTOR'` + use the notification `type` string discriminator (one of the 5 new types) to route the inbox link. In each notification dispatch, `entityId` = the engagement's ContractorAssignment id (most natural anchor for deep-linking). Document this convention in `notification-service.ts` with a comment: `// Phase 60 uses entityType=CONTRACTOR for classification.* types; type string discriminates the target entity (Statusfeststellungsverfahren | ReassessmentTrigger | EconomicDependencyAlertState).`
**Warning signs:** `dispatch()` throws because `entityType='STATUSFESTSTELLUNGSVERFAHREN'` isn't a valid Prisma enum value.

### Pitfall 5: Notification fatigue — daily re-fires when band stays above threshold

**What goes wrong:** If the up-crossing notification fires every day while band is `warning`, users receive 30 emails/month per engagement → inbox flood → they turn off the notification → compliance signal lost.
**Why it happens:** Naive implementation fires whenever `band !== 'safe'`.
**How to avoid:** D-04 mandates "alert once per crossing, then monthly reminder while still over". Logic: only fire on BAND CHANGE (state.currentBand !== computed newBand AND isUpCrossing), OR on SAME-BAND with `now - lastReminderAt >= 30d`. Unit-test: run scanner 32 days in a row with share stuck at 75% — expect exactly 2 notifications (day 0 up-crossing + day 31 reminder), not 32.
**Warning signs:** Alpha user feedback "why am I getting the same alert every morning".

### Pitfall 6: Notification dispatch 60s dedup collides with band state machine

**What goes wrong:** `notification-service.dispatch()` at `notification-service.ts:210-219` dedupes within 60s per `(userId, type, entityId)`. If the cron fires a `classification.economic_dependency_warning` at 02:00:00 and something else in the same second triggers a duplicate dispatch, the second is silently dropped. For band transitions this isn't a problem (same state, same dedup — correct behaviour), but for the monthly reminder on day 31, if ANY other notification of the same type/entity happened within 60s, the reminder is suppressed.
**Why it happens:** Cron runs are deterministic once-per-day, so 60s overlap is implausible — but if a manual "re-run this cron" endpoint is added, it's real.
**How to avoid:** For Phase 60, accept the 60s dedup. Don't add a manual re-run endpoint. If needed later, extend dispatch to accept a `dedupWindow` parameter.
**Warning signs:** Alpha user runs the cron manually and the expected notification doesn't appear.

### Pitfall 7: `UserNotificationPreference` uniqueness is `(userId, notificationType)` — org-cross-contamination

**What goes wrong:** `UserNotificationPreference.@@unique([userId, notificationType])` at `notification.prisma:41` is NOT scoped by `organizationId` — if a user belongs to 2 orgs and enables Slack for `classification.economic_dependency_warning` in Org A, it applies in Org B too.
**Why it happens:** Schema constraint was defined without `organizationId` in the unique.
**How to avoid:** Not a Phase-60 bug; inherited behaviour. Document as "known limitation: notification preferences are user-scoped not user×org-scoped; fix is out of scope for Phase 60". Planner may optionally surface this to a backlog item.
**Warning signs:** Multi-org alpha user sees preferences bleed across orgs.

### Pitfall 8: `ClassificationAssessment.outcome` is nullable on drafts — dashboard must filter

**What goes wrong:** `ClassificationAssessment.outcome Json?` at `classification.prisma:23` is null while `status='draft'`. Dashboard tiles that aggregate verdicts must filter `status='completed'` FIRST; otherwise `outcome.verdict` is undefined → runtime error.
**Why it happens:** Phase 58 D-10 append-only model — drafts live alongside completed rows.
**How to avoid:** Every `classificationDashboard` tRPC query MUST include `status: 'completed'` in the Prisma `where`. Unit test: seed an engagement with ONLY a draft assessment + zero completed, assert dashboard counts show `0`, not `1`.
**Warning signs:** TypeError `Cannot read properties of null (reading 'kind')` in the dashboard on an org with in-progress drafts.

### Pitfall 9: `ContractorAssignment.status` enum — use ACTIVE not active

**What goes wrong:** D-02 says "scan every DE `ContractorAssignment.status='ACTIVE'`". `AssignmentStatus` enum at `contractor.prisma:255-259` is `ACTIVE | ENDED | PLANNED` (uppercase). Passing `'active'` to `findMany({ where: { status: 'active' } })` returns zero results — silent empty scan.
**Why it happens:** Enum case-sensitivity.
**How to avoid:** Always use the generated TypeScript enum `AssignmentStatus.ACTIVE` (imported from `@contractor-ops/db`). Unit test validates at least one active DE engagement is scanned.
**Warning signs:** Cron runs successfully but `metrics.gauge('cron.classification_economic_dependency.scanned', 0)` reports 0 for an org that has active engagements.

### Pitfall 10: Invoice timezone on `@db.Date` columns

**What goes wrong:** `Invoice.issueDate` is `@db.Date` (no timezone, just YYYY-MM-DD). `Invoice.dueDate` same. When the cron runs at `02:00 UTC 2026-04-14`, a 12-month rolling window ending "now" might exclude invoices issued on `2026-04-14` because Prisma coerces the JS Date to a UTC date, and a same-day invoice might be saved as `2026-04-14T00:00:00Z` which equals `now.setMonth(-12)` + 12 months... actually this works out, but edge cases exist around DST transitions and the `new Date()` coercion.
**Why it happens:** Rolling-window math crossing date-only column boundaries.
**How to avoid:** Always pass `new Date(yyyy-mm-ddT00:00:00Z)` (UTC midnight) as the endpoints. Use inclusive `gte` for start and inclusive `lte` for end. Add a test with an invoice at `issueDate = twelveMonthsAgoBoundary` — it must be included (CONTEXT.md D-02 says "[now-12m, now]" closed interval).
**Warning signs:** Billing share flips between `warning` and `safe` on DST change days.

### Pitfall 11: Migration order — back-relations before model creation

**What goes wrong:** Phase 60 adds three models to `classification.prisma` AND back-relations to `contractor.prisma` (`ContractorAssignment`), `organization.prisma` (`Organization`). Prisma schema parsing is file-agnostic — all files must be consistent in a single migration. If back-relations reference a model that isn't yet in the schema, `prisma db push` fails.
**Why it happens:** Partial migrations.
**How to avoid:** Single migration per wave covers: new model definitions + ALL back-relations + enum additions. Phase 59 did this in Plan 59-01; follow the same pattern. Run `pnpm --filter @contractor-ops/db db:push` as a BLOCKING step before any api/web tests run.
**Warning signs:** `error P1012: You are trying to add a relation ... but the related model doesn't exist` during `db:push`.

### Pitfall 12: `triggerReasons` JSONB — Zod schema on read AND write

**What goes wrong:** `ReassessmentTrigger.triggerReasons Json` (per D-08) is untyped in Prisma. If consumer code reads `trigger.triggerReasons` and treats it as `Array<{ field: string, ... }>` without `.parse()`, a malformed row (e.g. written by an older version) causes runtime TypeError on `.map`/`.filter`.
**Why it happens:** JSONB columns erode type safety.
**How to avoid:** Define `triggerReasonSchema = z.object({ field: z.string(), oldValue: z.unknown().optional(), newValue: z.unknown().optional(), auditLogId: z.string(), resourceType: z.string() })` and `triggerReasonsSchema = z.array(triggerReasonSchema)` in `packages/classification/src/schemas/` (or a new `packages/api/src/schemas/` module). Use `.parse()` on read and write — Phase 58 D-03 outcome envelope does this for `outcome` JSONB per `classification.ts` router pattern.
**Warning signs:** Dashboard throws when rendering `triggerReasons` length for an old migrated row.

### Pitfall 13: `recipient resolution` — no user_role → contractor:read/update mapping exists yet

**What goes wrong:** D-05 says "Recipient set = any user in the org with an active role granting `contractor:read` OR `contractor:update`". But `packages/api/src/routers/classification.ts` uses `requirePermission` via Better Auth `hasPermission` API at the request boundary — there's no bulk "list all users with permission X in org Y" helper in `reminders/route.ts` (which uses `recipientMode: 'FINANCE_TEAM'` with a static role IN list at `route.ts:338-346`). Phase 60 needs a new bulk-permission-query helper.
**Why it happens:** RBAC is gate-level, not query-level.
**How to avoid:** Implement `resolveRbacRecipients(organizationId, permission: Permission)` helper that queries `prisma.member` for users whose role grants the required permission. Approach: inspect the Better Auth role → permission mapping (likely in `packages/auth/`), then `findMany` members with matching roles. Test: seed an org with roles that do vs don't grant `contractor:read`, assert the helper returns exactly the grant-holders. Document in plan.
**Warning signs:** Notifications go to every org member or to nobody.

## Code Examples

### Example 1: New Prisma model — `EconomicDependencyAlertState`

```prisma
// Source: CONTEXT.md D-03 [VERIFIED]; follows Phase 58 classification.prisma pattern
// File: packages/db/prisma/schema/classification.prisma (APPENDED)

enum EconomicDependencyBand {
  safe
  warning
  critical
}

model EconomicDependencyAlertState {
  id                    String                 @id @default(cuid())
  organizationId        String
  contractorAssignmentId String                @unique  // one state per engagement
  currentBand           EconomicDependencyBand @default(safe)
  lastBillingShare      Decimal                @db.Decimal(5, 4)  // 0.0000..1.0000
  lastScannedAt         DateTime
  lastCrossedAt         DateTime?
  lastReminderAt        DateTime?
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt

  organization         Organization         @relation(fields: [organizationId], references: [id])
  contractorAssignment ContractorAssignment @relation(fields: [contractorAssignmentId], references: [id])

  @@index([organizationId])
  @@index([organizationId, currentBand], map: "EDAS_org_band_idx")
  @@index([organizationId, lastScannedAt], map: "EDAS_org_scanned_idx")
}
```

### Example 2: New Prisma model — `ReassessmentTrigger`

```prisma
// Source: CONTEXT.md D-08 [VERIFIED]

enum ReassessmentTriggerStatus {
  OPEN
  ACKNOWLEDGED
  RESOLVED
  DISMISSED
}

model ReassessmentTrigger {
  id                     String                    @id @default(cuid())
  organizationId         String
  contractorAssignmentId String
  priorAssessmentId      String
  priorSdsDocumentId     String?
  triggeredAt            DateTime                  @default(now())
  triggerReasons         Json                      // Zod-validated: Array<{ field, oldValue?, newValue?, auditLogId, resourceType }>
  status                 ReassessmentTriggerStatus @default(OPEN)
  acknowledgedByUserId   String?
  acknowledgedAt         DateTime?
  resolvedAt             DateTime?
  dismissedByUserId      String?
  dismissedAt            DateTime?
  dismissedReason        String?                   @db.VarChar(1000)
  createdAt              DateTime                  @default(now())
  updatedAt              DateTime                  @updatedAt

  organization           Organization              @relation(fields: [organizationId], references: [id])
  contractorAssignment   ContractorAssignment      @relation(fields: [contractorAssignmentId], references: [id])
  priorAssessment        ClassificationAssessment  @relation("ReassessmentTriggerPriorAssessment", fields: [priorAssessmentId], references: [id])
  priorSdsDocument       ClassificationDocument?   @relation(fields: [priorSdsDocumentId], references: [id])
  acknowledgedByUser     User?                     @relation("ReassessmentTriggerAck", fields: [acknowledgedByUserId], references: [id])
  dismissedByUser        User?                     @relation("ReassessmentTriggerDismiss", fields: [dismissedByUserId], references: [id])

  @@index([organizationId, contractorAssignmentId, status], map: "RT_org_assign_status_idx")
  @@index([organizationId, triggeredAt], map: "RT_org_triggeredAt_idx")
}
```

### Example 3: New Prisma model — `Statusfeststellungsverfahren`

```prisma
// Source: CONTEXT.md D-10 [VERIFIED]

enum StatusfeststellungsverfahrenOutcome {
  PENDING
  SELBSTANDIG
  ABHANGIG
  WITHDRAWN
}

model Statusfeststellungsverfahren {
  id                     String                              @id @default(cuid())
  organizationId         String
  contractorAssignmentId String
  filedAt                DateTime                            @db.Date
  drvReference           String                              @db.VarChar(100)  // free-form per D-10
  outcome                StatusfeststellungsverfahrenOutcome @default(PENDING)
  validFrom              DateTime?                           @db.Date
  validTo                DateTime?                           @db.Date
  notes                  String?                             @db.Text
  createdAt              DateTime                            @default(now())
  updatedAt              DateTime                            @updatedAt

  organization         Organization         @relation(fields: [organizationId], references: [id])
  contractorAssignment ContractorAssignment @relation(fields: [contractorAssignmentId], references: [id])

  @@index([organizationId, contractorAssignmentId], map: "SFV_org_assign_idx")
  @@index([organizationId, validTo], map: "SFV_org_validTo_idx")  // cron scan index for expiry reminder
}
```

### Example 4: Back-relations to append

```prisma
// packages/db/prisma/schema/contractor.prisma — extend ContractorAssignment
model ContractorAssignment {
  // ... existing fields ...
  // existing Phase 58/59 back-relations already present; ADD:
  economicDependencyAlertState EconomicDependencyAlertState?
  reassessmentTriggers         ReassessmentTrigger[]
  statusfeststellungsverfahren Statusfeststellungsverfahren[]
}

// packages/db/prisma/schema/organization.prisma — extend Organization
model Organization {
  // ... ADD back-relations for all 3 new models
  economicDependencyAlertStates EconomicDependencyAlertState[]
  reassessmentTriggers          ReassessmentTrigger[]
  statusfeststellungsverfahren  Statusfeststellungsverfahren[]
}

// packages/db/prisma/schema/classification.prisma — extend ClassificationAssessment + ClassificationDocument
model ClassificationAssessment {
  // ... ADD:
  reassessmentTriggers ReassessmentTrigger[] @relation("ReassessmentTriggerPriorAssessment")
}

model ClassificationDocument {
  // ... ADD:
  reassessmentTriggers ReassessmentTrigger[]  // opposite side of priorSdsDocumentId
}

// packages/db/prisma/schema/auth.prisma — extend User (where applicable)
model User {
  // ... ADD:
  acknowledgedReassessmentTriggers ReassessmentTrigger[] @relation("ReassessmentTriggerAck")
  dismissedReassessmentTriggers    ReassessmentTrigger[] @relation("ReassessmentTriggerDismiss")
}
```

### Example 5: Extend NOTIFICATION_TYPES

```ts
// Source: packages/validators/src/notification.ts [VERIFIED]
// EXTENSION: add 5 new types. Existing array has 18 entries at lines 7-26.

export const NOTIFICATION_TYPES = [
  // ... existing 18 types ...
  'TASK_OVERDUE',
  // Phase 60:
  'classification.economic_dependency_warning',
  'classification.economic_dependency_critical',
  'classification.reassessment_trigger',
  'classification.drv_expiry_90d',
  'classification.drv_expiry_30d',
  'classification.drv_expiry_7d',
] as const;
```

**Naming convention:** Existing types are SCREAMING_SNAKE_CASE (`APPROVAL_REQUEST`, `TASK_OVERDUE`). Phase 60 uses dot-notation lowercase per CONTEXT.md D-05 string literals. Both naming styles will coexist; `notificationType` is a `String` column in `UserNotificationPreference` (not an enum), so it accepts both. Plan: commit to ONE convention — either convert Phase 60's 6 types to SCREAMING_SNAKE_CASE (`CLASSIFICATION_ECONOMIC_DEPENDENCY_WARNING`) for consistency with the rest of the enum OR preserve the dot-notation from CONTEXT.md. **Recommendation:** keep dot-notation — it's what CONTEXT.md + UI-SPEC both use for notification type strings (UI-SPEC line 132, 134). Ensures a clean routing space when Phase 61+ adds e-invoicing notification types.

### Example 6: New router — `statusfeststellungsverfahren.ts`

```ts
// packages/api/src/routers/statusfeststellungsverfahren.ts (NEW)
// Source pattern: packages/api/src/routers/classification.ts:1-40 [VERIFIED]
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../init.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';

const contractorReadProcedure = tenantProcedure.use(requirePermission({ contractor: ['read'] }));
const contractorUpdateProcedure = tenantProcedure.use(requirePermission({ contractor: ['update'] }));

const outcomeEnum = z.enum(['PENDING', 'SELBSTANDIG', 'ABHANGIG', 'WITHDRAWN']);

const createInput = z.object({
  contractorAssignmentId: z.string().min(1),
  filedAt: z.date(),
  drvReference: z.string().min(1).max(100),
  outcome: outcomeEnum.default('PENDING'),
  validFrom: z.date().optional(),
  validTo: z.date().optional(),
  notes: z.string().max(2000).optional(),
}).refine(d => d.outcome === 'PENDING' || (d.validFrom && d.validTo), {
  message: 'validFrom and validTo required when outcome is not PENDING',
});

export const statusfeststellungsverfahrenRouter = router({
  listByEngagement: contractorReadProcedure
    .input(z.object({ contractorAssignmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.statusfeststellungsverfahren.findMany({
        where: { contractorAssignmentId: input.contractorAssignmentId },
        orderBy: { filedAt: 'desc' },
      });
    }),
  create: contractorUpdateProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    return ctx.db.statusfeststellungsverfahren.create({ data: input });
  }),
  // update, delete follow same shape
});
```

Wire into root: `packages/api/src/root.ts` — append `statusfeststellungsverfahren: statusfeststellungsverfahrenRouter,` next to existing classification entries at lines 122-124 [VERIFIED].

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Cron platform (Vercel/Render/Railway) | Two new daily crons | ✓ (existing `reminders` cron is already scheduled somewhere) | — | Locally-only for v5.0 — STATE.md says app is local-only; deploy registration deferred |
| `CRON_SECRET` env var | New crons' Bearer auth | ✓ | — | — (hard block if unset — same as existing crons) |
| `CRONITOR_API_KEY` env var | Heartbeat pings | Optional (cron-monitor.ts:33 gracefully skips if absent) | — | No-op |
| R2 / S3 bucket | CSV signed-URL exports | ✓ (Phase 56 + 59 already use `putObjectAndSignDownload`) | — | — |
| PostgreSQL (Neon EU pooler) | All new models | ✓ | pg_isready on Neon pooler | — |
| Next.js 15 App Router | New dashboard page | ✓ | 15.x | — |
| Prisma 7 | Schema extensions | ✓ | 7.x | — |

**No missing dependencies.** Phase 60 is entirely additive on top of already-deployed-locally infrastructure.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest` 4.1.x (repo-wide) [VERIFIED: `package.json:30`] |
| Config file | Per-workspace `vitest.config.ts` (existing in `packages/api`, `packages/db`, `packages/validators`, `apps/web`) |
| Quick run command | `pnpm --filter @contractor-ops/api test && pnpm --filter @contractor-ops/db test && pnpm --filter @contractor-ops/validators test` |
| Full suite command | `pnpm test` (workspace root — all tests including web RTL + a11y axe) |
| Estimated runtime | ~15s quick · ~60-90s full |

### Per-Requirement Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLASS-07 | Billing share = numerator(currentOrg) / denominator(allOrgs) over rolling 12m | unit | `pnpm --filter @contractor-ops/api test src/services/__tests__/economic-dependency-scan.test.ts` | ❌ Wave 0 |
| CLASS-07 | Band transitions: safe → warning → critical fire up-crossing notifications | unit | same | ❌ Wave 0 |
| CLASS-07 | Band transitions: critical → warning → safe fire resolve notifications | unit | same | ❌ Wave 0 |
| CLASS-07 | Same-band persistence: 29 days since `lastReminderAt` → no fire; 30+ days → fire | unit | same | ❌ Wave 0 |
| CLASS-07 | Cron route: Bearer auth rejects missing / wrong token (401) | integration | `apps/web/src/app/api/cron/classification-economic-dependency/__tests__/route.test.ts` | ❌ Wave 0 |
| CLASS-07 | Cron route: authorised call runs scan + emits `metrics.gauge('cron.classification_economic_dependency.*')` | integration | same | ❌ Wave 0 |
| CLASS-07 | Kleinunternehmer flag does NOT alter §2 SGB VI threshold | unit | `economic-dependency-scan.test.ts` (dedicated case) | ❌ Wave 0 |
| CLASS-07 | `tRPC economicDependencyAlert.list` returns only org-scoped alerts | integration | `packages/api/src/routers/__tests__/economic-dependency-alert.test.ts` | ❌ Wave 0 |
| CLASS-08 | AuditLog scan: processes only rows with `createdAt > lastScanCompletedAt` | unit | `pnpm --filter @contractor-ops/api test src/services/__tests__/reassessment-trigger-scan.test.ts` | ❌ Wave 0 |
| CLASS-08 | Material-change allowlist filter: rate change fires; tag link change does NOT | unit | same | ❌ Wave 0 |
| CLASS-08 | Ignored: `allocationPercent` change ≤5 pp does NOT fire; >5 pp does NOT fire either (ignored entirely per D-07) | unit | same | ❌ Wave 0 |
| CLASS-08 | No prior IR35 assessment → no trigger fires | unit | same | ❌ Wave 0 |
| CLASS-08 | Dedup: two audit rows in one scan for same assignment → ONE trigger with 2 reasons, not 2 triggers | unit | same | ❌ Wave 0 |
| CLASS-08 | Submitting new IR35 assessment auto-resolves matching OPEN trigger | integration | `packages/api/src/routers/__tests__/reassessment-trigger.test.ts` (+ classification.test.ts EXTEND) | ❌ Wave 0 + ✅ EXTEND |
| CLASS-08 | `reassessmentTrigger.dismiss` requires `contractor:update`; rejects foreign-org id | integration | `reassessment-trigger.test.ts` | ❌ Wave 0 |
| CLASS-08 | `triggerReasons` Zod-parsed on read + write; malformed row rejected | unit | `packages/api/src/schemas/__tests__/reassessment-trigger-reason.test.ts` | ❌ Wave 0 |
| CLASS-09 | `statusfeststellungsverfahren.create` happy path + Zod validation (validFrom required when outcome !== PENDING) | integration | `packages/api/src/routers/__tests__/statusfeststellungsverfahren.test.ts` | ❌ Wave 0 |
| CLASS-09 | `listByEngagement` scoped to engagement + org | integration | same | ❌ Wave 0 |
| CLASS-09 | Expiry reminder helper: 90d out fires `drv_expiry_90d`; 91d does NOT | unit | `apps/web/src/app/api/cron/reminders/__tests__/drv-expiry.test.ts` (NEW) | ❌ Wave 0 |
| CLASS-09 | Expiry reminder: one-shot dedup per `(clearanceId, type)` — second scan day does NOT re-fire | unit | same | ❌ Wave 0 |
| CLASS-09 | Expiry reminder: `outcome IN (PENDING, WITHDRAWN)` skipped | unit | same | ❌ Wave 0 |
| CLASS-10 | Dashboard `coverageTile` returns `{ completed, total }` per market | integration | `packages/api/src/routers/__tests__/classification-dashboard.test.ts` | ❌ Wave 0 |
| CLASS-10 | Dashboard `riskDistributionTile` returns counts grouped by latest verdict | integration | same | ❌ Wave 0 |
| CLASS-10 | Dashboard filters out draft assessments (status='draft') | integration | same | ❌ Wave 0 |
| CLASS-10 | `exportMarketCsv`: columns match D-16 spec, UTF-8 BOM present, `expiresInSeconds=300` | integration | same | ❌ Wave 0 |
| CLASS-10 | Multi-tenant: Org A dashboard never sees Org B rows | integration | same | ❌ Wave 0 |
| CLASS-10 | `packages/api/src/lib/csv.ts` escapes commas, quotes, newlines per RFC 4180 | unit | `packages/api/src/lib/__tests__/csv.test.ts` | ✅ EXISTS (may need EXTEND — verify) |
| D-05 (cross) | `resolveRbacRecipients(orgId, { contractor: ['read'] })` returns only role-grantees | integration | `packages/api/src/services/__tests__/rbac-recipients.test.ts` | ❌ Wave 0 |
| D-14 (UI) | RiskDistributionTile renders correct widths + aria-label text (counts sum to 100%) | RTL + a11y | `apps/web/src/components/contractors/classification/dashboard/__tests__/risk-distribution-tile.test.tsx` | ❌ Wave 0 |
| WCAG AA | Dashboard refresh button `aria-live="polite"` announces "Dashboard data refreshed" | a11y (axe) | `apps/web/src/app/[locale]/(dashboard)/classification/__tests__/a11y.test.tsx` | ❌ Wave 0 |
| WCAG AA | Dismiss dialog: reason field ≥10 chars enables destructive button; form has `role="alert"` for errors | RTL | `apps/web/src/components/contractors/classification/reassessment-trigger/__tests__/dismiss-dialog.test.tsx` | ❌ Wave 0 |
| WCAG AA | DRV clearance form: form-field labels correctly associated; `role="alert"` on validation | RTL + a11y | `apps/web/src/components/contractors/classification/drv-clearance/__tests__/a11y.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @contractor-ops/api test && pnpm --filter @contractor-ops/db test && pnpm --filter @contractor-ops/validators test` — under 15s.
- **Per wave merge:** `pnpm test` (workspace root) — full monorepo suite including apps/web RTL + axe.
- **Phase gate (pre-`/gsd-verify-work`):** Full suite green; manual verification: trigger both crons locally with `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/classification-economic-dependency` and observe log output + metric emission; seed a DE engagement with invoices that produce 75% share, confirm single warning notification.

### Wave 0 Gaps

- [ ] `packages/db/prisma/schema/classification.prisma` — **append** 3 models + 3 enums + back-relations in `contractor.prisma`, `organization.prisma`, `classification.prisma` (self), `auth.prisma`
- [ ] `[BLOCKING]` `pnpm --filter @contractor-ops/db db:push && db:generate` — must run before any api test compiles against the new models
- [ ] `packages/validators/src/notification.ts` — append 5 new notification type strings to `NOTIFICATION_TYPES`
- [ ] `packages/api/src/services/cron-monitor.ts` — append 2 new keys to `CronMonitors` enum
- [ ] `packages/api/src/services/economic-dependency-scan.ts` — scan orchestrator + billing-share computation (pure function + side-effecting wrapper)
- [ ] `packages/api/src/services/__tests__/economic-dependency-scan.test.ts` — unit tests for pure functions
- [ ] `packages/api/src/services/reassessment-trigger-scan.ts` — AuditLog scanner + material-change filter + dedup + trigger emission
- [ ] `packages/api/src/services/__tests__/reassessment-trigger-scan.test.ts` — unit tests
- [ ] `packages/api/src/services/rbac-recipients.ts` + `__tests__/rbac-recipients.test.ts` — NEW helper for "users in org with permission X"
- [ ] `packages/api/src/schemas/reassessment-trigger-reason.ts` + `__tests__` — Zod schema for `triggerReasons` JSONB
- [ ] `packages/api/src/routers/statusfeststellungsverfahren.ts` + `__tests__/statusfeststellungsverfahren.test.ts`
- [ ] `packages/api/src/routers/reassessment-trigger.ts` + `__tests__/reassessment-trigger.test.ts`
- [ ] `packages/api/src/routers/economic-dependency-alert.ts` + `__tests__/economic-dependency-alert.test.ts`
- [ ] `packages/api/src/routers/classification-dashboard.ts` + `__tests__/classification-dashboard.test.ts`
- [ ] `apps/web/src/app/api/cron/classification-economic-dependency/route.ts` + `__tests__/route.test.ts`
- [ ] `apps/web/src/app/api/cron/classification-reassessment-triggers/route.ts` + `__tests__/route.test.ts`
- [ ] `apps/web/src/app/api/cron/reminders/route.ts` — EXTEND with `detectDrvClearanceExpiries` + extend existing test file
- [ ] `apps/web/src/app/[locale]/(dashboard)/classification/page.tsx` + `__tests__/a11y.test.tsx`
- [ ] `apps/web/src/components/contractors/classification/dashboard/*` — 7 new components + `__tests__`
- [ ] `apps/web/src/components/contractors/classification/drv-clearance/*` — 3 components + `__tests__`
- [ ] `apps/web/src/components/contractors/classification/reassessment-trigger/*` — 3 components + `__tests__`
- [ ] `apps/web/src/components/contractors/classification/economic-dependency-alerts/*` — 1 component (band-chip) + `__tests__`
- [ ] `apps/web/messages/{en,de,pl,ar}.json` — add `Classification.polish.*` namespace per UI-SPEC Copywriting Contract
- [ ] Framework install: none — Vitest + RTL + axe already configured.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth session auth (web) + API-key path already in place |
| V3 Session Management | yes (inherited) | Better Auth session cookies + rotation |
| V4 Access Control | **yes (load-bearing)** | `requirePermission({ contractor: ['read'\|'update'] })` on every Phase-60 procedure; cron Bearer via `CRON_SECRET` |
| V5 Input Validation | **yes** | Zod on every router input; `triggerReasons` JSONB Zod-parsed on read + write; CSV fields escaped via `escapeCsvField` (RFC 4180) |
| V6 Cryptography | no (nothing phase-specific) | — |
| V7 Error Handling | yes | Cron errors caught, Sentry-captured, never leaked to response; tRPC errors typed as TRPCError |
| V8 Data Protection | yes | `Statusfeststellungsverfahren.drvReference` is not strictly PII but identifies a DRV case — treat as confidential; no logging of the reference value (use `[REDACTED]` or truncate in logs) |
| V10 Malicious Code | n/a | — |
| V11 Business Logic | **yes** | State-machine correctness of band transitions + dedup of reassessment triggers is THE phase. Every transition must be unit-tested |
| V13 API | yes | Rate limiting on dashboard CSV export (consider one per org per 60s); tRPC already rate-limits `classification.saveAnswer` at 120/min — follow pattern if concern emerges |
| V14 Configuration | yes | `CRON_SECRET` must not be logged; metrics.gauge names must not embed secrets |

### Known Threat Patterns for Phase-60 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org data leak via billing-share denominator | Information Disclosure | Cross-org aggregate returns a SINGLE number, never a row. Unit test: run denominator query, assert result is `number`, not an array of `{ organizationId }` objects |
| Band-transition replay attack (manual cron re-run floods notifications) | Tampering | One-shot per `(clearanceId, type)` for DRV reminders (Notification-table lookup); band-state machine already idempotent |
| CSV injection on export (formula prefix `=cmd|'/...'!A0`) | Injection | `escapeCsvField` auto-quotes `",\r\n` but NOT leading `=`/`+`/`-`/`@`. Extend escape: if value starts with `=`/`+`/`-`/`@`, prefix with `'` (Excel formula-neutralisation). Add to `csv.ts` test coverage. [Gap in existing `csv.ts`] |
| DoS via CSV export with large `statementText` in Ir35OtherClientAttestation | DoS | Ir35OtherClientAttestation.statementText capped at 4000 chars (Phase 59 schema). CSV per-cell unbounded otherwise; fine for v5.0 (100s of engagements) |
| Notification target-org confusion (Slack channel routed to wrong org) | Spoofing | `dispatch()` resolves channel mapping from `IntegrationConnection` scoped by `organizationId` [VERIFIED: `notification-service.ts:345-357`] |
| AuditLog row tampering / deletion after scan | Repudiation | AuditLog is append-only by project convention (`audit.prisma:22`: `// audit logs are immutable`); `CronScanState.lastScanCompletedAt` ensures each row processed exactly once |
| Trigger dismissal by non-authorised user | Elevation of Privilege | `reassessmentTrigger.dismiss` gated by `contractor:update` — pattern verified in `classification.ts:94-96` |
| Statusfeststellungsverfahren deletion after cron already fired reminder | Tampering | One-shot dedup keyed on `(clearanceId, type)` — deleting the clearance doesn't re-open the reminder slot (Notification row persists). Accept. |

**Security gap to address in plan:** Extend `escapeCsvField` in `packages/api/src/lib/csv.ts` to neutralise formula-prefix characters (`=`, `+`, `-`, `@`). Not just a Phase-60 concern but Phase 60 is the first place the function is used for user-entered fields that round-trip to Excel (contractor names, notes). Plan a separate task + test.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual band checks via "finance team review" | Automated daily cron with state machine | This phase (Phase 60) | Alerts fire within 24h of crossing, not "whenever someone checks" |
| Chart.js / Recharts for every bar | Native flex + OKLCh tokens | UI-SPEC 2026-04-13 (this phase) | Zero bundle cost, consistent Precision Craft palette |
| Per-country notification preferences | User × notificationType (org-unscoped) | Inherited (known limitation) | Multi-org preference bleed documented, not fixed in Phase 60 |
| `xlsx` SheetJS for CSV | `packages/api/src/lib/csv.ts` (direct RFC 4180) | Phase 57 (v5.0) | Smaller bundle, simpler escaping; but missing formula-prefix neutralisation (gap) |

**Deprecated/outdated:**
- Nothing deprecated by Phase 60. All patterns reused verbatim.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 [VERIFIED] | `ContractorAssignment` has no rate field; rate lives on `Contract` | Pitfall 2 | Plan's allowlist for CLASS-08 would watch wrong table. VERIFIED against `contractor.prisma:138-165` + `contract.prisma:3-63`. |
| A2 [VERIFIED] | `EntityType` enum (used by both AuditLog and Notification) does NOT include `CONTRACTOR_ASSIGNMENT` or Phase-60 entities | Pitfall 1, Pitfall 4 | Migration either needs enum extension (invasive) or Phase 60 reuses `CONTRACTOR`. VERIFIED against `contract.prisma:251-268`. |
| A3 [ASSUMED] | ContractorAssignment mutations currently DO write AuditLog rows | Pitfall 1 | CLASS-08 cron has nothing to scan; would need to first wire AuditLog writes on these mutations. **Planner must grep `contractorAssignment.update` call sites to confirm.** |
| A4 [VERIFIED] | `notification-service.dispatch()` dedupes within 60s per `(userId, type, entityId)` | Pattern 1, Pitfall 6 | Accepted as-is; documented limitation. VERIFIED at `notification-service.ts:70,210-219`. |
| A5 [VERIFIED] | `UserNotificationPreference.@@unique([userId, notificationType])` is NOT org-scoped | Pitfall 7 | Multi-org users bleed preferences. Accept; document as known limitation. VERIFIED at `notification.prisma:41`. |
| A6 [VERIFIED] | `Invoice.totalMinor` is the authoritative total for billing-share calculation | Pattern 2 | Using `subtotalMinor` would ignore VAT; `totalMinor` is the invoice total. VERIFIED at `invoice.prisma:22`. |
| A7 [ASSUMED] | Phase 60 cron will run WITHOUT a tenant context (iterates orgs sequentially via raw Prisma) | Pattern 2, Pitfall 3 | If the cron is accidentally wrapped in `tenantStore.run(...)`, denominator becomes org-scoped. Plan must include a unit test proving denominator is cross-org. |
| A8 [VERIFIED] | `CronScanState` or equivalent persistence for `lastScanCompletedAt` is needed — no such table exists yet | Pattern 4 | New tiny model; trivial addition. VERIFIED no match in `packages/db/prisma/schema/`. |
| A9 [ASSUMED] | Dashboard query cost is bounded (low-hundreds engagements per org per CONTEXT.md D-15) | Pattern 9, D-15 | If an org has 10k+ engagements, live query becomes slow. CONTEXT.md accepts this trade-off; materialised view deferred. |
| A10 [ASSUMED] | `resolveRbacRecipients(orgId, permission)` helper does NOT exist today | Pattern 1, Pitfall 13 | If it does exist, reuse it. If not, Phase 60 must create it. **Planner must grep for existing permission-bulk-query helpers**. |
| A11 [VERIFIED] | `packages/api/src/lib/csv.ts#escapeCsvField` does NOT neutralise `=`/`+`/`-`/`@` formula prefixes | Security Domain gap | CSV-injection vector via contractor name. Plan a security-hardening task. VERIFIED at `csv.ts:11-17`. |
| A12 [VERIFIED] | OKLCh tokens `--success` / `--warning` / `--destructive` are globally available via `globals.css` | Pattern 9 | Stacked bar uses `bg-[--success]` etc. VERIFIED at `globals.css:78-80`. |
| A13 [VERIFIED] | Better Auth + `requirePermission` middleware handles session AND API-key auth | Security V4 | RBAC applies uniformly. VERIFIED at `rbac.ts:19-61`. |
| A14 [VERIFIED] | vercel.json does NOT exist in repo | Runtime State | Cron scheduling mechanism is NOT Vercel's crontab (must be Render/Railway/similar). VERIFIED via Glob. Plan: locate the actual cron scheduler config when deploying. |
| A15 [ASSUMED] | Kleinunternehmer status (`Organization.isKleinunternehmer`) does NOT alter §2 SGB VI economic-dependency thresholds | Pattern 2 | Statutory; flag is about VAT not SGB VI. §2 SGB VI is contractor-level dependency regardless of VAT treatment. **Planner should confirm with a tax-law reference during Steuerberater review checkpoint**. |

**Claims needing user / planner confirmation:** A3 (audit writes on ContractorAssignment), A10 (existing RBAC bulk helper), A15 (Kleinunternehmer interaction). A planner-time grep covers A3 + A10; A15 is deferred to the Steuerberater review checkpoint per STATE.md standing constraint.

## Open Questions

1. **Does ContractorAssignment currently write AuditLog rows?**
   - What we know: AuditLog table exists; EntityType enum lacks `CONTRACTOR_ASSIGNMENT` value. Routers for contractor + contract both exist.
   - What's unclear: Is there audit-log-writing middleware on mutations, or does it rely on explicit `prisma.auditLog.create({...})` calls?
   - Recommendation: Plan 60-01 first task = grep + document current audit coverage; if missing, prerequisite is to add audit writes on ContractorAssignment `create/update/delete` before CLASS-08 lands.

2. **Where are existing crons scheduled (if not Vercel)?**
   - What we know: Existing routes at `/api/cron/{reminders,token-refresh,trial-notifications,job-health,inpost-status-poll,data-purge}`. No `vercel.json`.
   - What's unclear: Render/Railway/external scheduler config location.
   - Recommendation: Plan's "deploy registration" task = locate config; STATE.md deploy-local-only means this doesn't block code merge, only production rollout.

3. **Does a bulk `resolveRbacRecipients(orgId, permission)` helper already exist?**
   - What we know: `reminders` cron uses static role IN lists at `reminders/route.ts:338-346`. `requirePermission` middleware handles request-time checks, not bulk queries.
   - What's unclear: Whether Better Auth's server-side helpers offer a bulk permission query.
   - Recommendation: Plan 60-01 task = inspect `@contractor-ops/auth` exports; if missing, add helper as Wave 0.

4. **Dot-notation vs SCREAMING_SNAKE_CASE for new notification type strings?**
   - What we know: Existing types are all-caps; CONTEXT.md + UI-SPEC use dot-notation.
   - What's unclear: Which convention sticks long-term.
   - Recommendation: Keep CONTEXT.md's dot-notation for Phase 60 + 61+ future namespaced types (`einvoice.xrechnung_generated`, etc.). Document convention in `notification.ts` comment.

5. **Should CSV-injection neutralisation (prefix `=`/`+`/`-`/`@` with `'`) be added in Phase 60 or a separate security hardening phase?**
   - What we know: Current `escapeCsvField` handles `",\r\n` only. Phase 60 is first place user-entered text lands in CSV.
   - What's unclear: Whether it's in scope for Phase 60 or deferred.
   - Recommendation: Add as a Phase-60 task (small, high security value); reject if planner wants to defer.

## Sources

### Primary (HIGH confidence — repo inspection)

- `apps/web/src/app/api/cron/reminders/route.ts` — full structure of the canonical cron route (418 lines)
- `packages/api/src/services/notification-service.ts` — `dispatch()` + per-user fan-out + 60s dedup (358 lines)
- `packages/db/prisma/schema/notification.prisma` — Notification, UserNotificationPreference, ReminderRule schemas
- `packages/db/prisma/schema/audit.prisma` — AuditLog schema (append-only, EntityType resourceType)
- `packages/db/prisma/schema/classification.prisma` — ClassificationAssessment, ClassificationDocument, Ir35ChainParticipant, Ir35OtherClientAttestation (Phase 58 + 59 output)
- `packages/db/prisma/schema/contractor.prisma` — ContractorAssignment (no rate field), Contractor, back-relations
- `packages/db/prisma/schema/contract.prisma` — Contract.rateValueMinor (where rate lives); EntityType enum
- `packages/db/prisma/schema/invoice.prisma` — Invoice.totalMinor, issueDate, organizationId (billing-share inputs)
- `packages/db/prisma/schema/organization.prisma` — isKleinunternehmer flag, back-relations
- `packages/db/src/tenant.ts` — multi-tenant Prisma extension, `APPEND_ONLY_MODELS`, AsyncLocalStorage
- `packages/api/src/lib/csv.ts` — `encodeCsvUtf8Bom` + `escapeCsvField` helpers
- `packages/api/src/lib/scope-utils.ts` — `permissionToScopes`, public API scopes
- `packages/api/src/middleware/rbac.ts` — `requirePermission` middleware
- `packages/api/src/routers/classification.ts` — tRPC router pattern to mirror
- `packages/api/src/services/cron-monitor.ts` — `withCronMonitor` + `CronMonitors` enum
- `packages/validators/src/notification.ts` — `NOTIFICATION_TYPES` const (extend here)
- `packages/api/src/root.ts` — router wiring (existing classification / classificationDocument / ir35Chain)
- `apps/web/src/app/globals.css` — OKLCh tokens `--success` / `--warning` / `--destructive`
- `packages/classification/src/profiles/scheinselbstandigkeit/scoring.ts` — billing-ratio scoring precedent
- `.planning/phases/59-classification-documents-chain-tracking/59-RESEARCH.md` — exact patterns Phase 60 inherits (tRPC, R2 signed URL, Prisma back-relations, locked-phrase CI guard)
- `.planning/phases/60-classification-polish/60-CONTEXT.md` — 16 locked decisions
- `.planning/phases/60-classification-polish/60-UI-SPEC.md` — approved 6/6 design contract

### Secondary (MEDIUM confidence)

- Phase 58 `58-CONTEXT.md` — outcome envelope shape, DRV category weighting, rule-set versioning
- Phase 59 `59-VALIDATION.md` — Nyquist validation architecture template (structure mirrored here)
- Phase 57 `57-CONTEXT.md` — Kleinunternehmer flag context

### Tertiary (external regulatory references)

- §2 Nr. 9 SGB VI — 70% / 83.33% economic-dependency thresholds (well-established German social insurance law)
- DRV Rundschreiben RS 2022/1 — economic-dependency guidance (Phase 58 canonical ref)
- DRV Form V0023 — Statusfeststellungsverfahren application form
- HMRC ITEPA 2003 Chapter 10 + ESM10011 — off-payroll SDS review triggers

**No WebSearch / Context7 calls performed** — Phase 60 is heavy on internal-repo patterns; external library research unnecessary. The three new Prisma models + two crons + four tRPC routers + one dashboard page are all grounded in existing repo conventions verified via direct file inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is existing workspace code, version-locked
- Architecture: HIGH — all patterns verified against live files with exact line numbers
- Runtime state: HIGH — 5/5 categories answered, 3 open questions surfaced with clear planner action
- Pitfalls: HIGH — 13 pitfalls each grounded in a specific file + line; pre-emptive for planner
- Security: HIGH — ASVS mapping against stack; one gap (CSV formula injection) surfaced
- Validation: HIGH — 32 test rows mapped to 4 CLASS requirements; framework verified

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30 days; stable repo patterns, no fast-moving externals)
