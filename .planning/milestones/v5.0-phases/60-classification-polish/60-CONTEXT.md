# Phase 60: Classification Polish - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the classification track with proactive monitoring, regulatory tracking, and consolidated reporting on top of the data already captured by Phases 58 (engine + assessments) and 59 (SDS documents + chain). Scope anchor: (a) daily economic-dependency alerts when a German contractor's billing share crosses §2 SGB VI thresholds (CLASS-07), (b) automated reassessment triggers when a UK engagement materially changes (CLASS-08), (c) Statusfeststellungsverfahren clearance-procedure tracking with expiry reminders (CLASS-09), and (d) a per-market compliance health dashboard (CLASS-10). No new assessment capture logic, no new document generation, no rule-set changes — this phase reads, monitors, and surfaces. All classification-track work closes here; Phase 61 onward is e-invoicing.

</domain>

<decisions>
## Implementation Decisions

### Economic-Dependency Alerts (CLASS-07)
- **D-01:** **Cron-based daily scan** is the detection mechanism. A new daily cron route `apps/web/src/app/api/cron/classification-economic-dependency/route.ts` follows the existing `reminders` cron pattern (Bearer token via `CRON_SECRET`, `withCronMonitor`, Sentry + metrics wrapper, `createCronLogger`, Prisma via the app's tenant-aware client). Latency of up to 24h is acceptable — economic dependency is a trend indicator, not a real-time signal.
- **D-02:** The scan iterates every DE `ContractorAssignment` with `status='ACTIVE'` and computes current billing share from invoices over a rolling 12-month window. Billing share = `sum(invoice.total where invoice.contractorId = assignment.contractorId AND invoice.organizationId = currentOrg AND invoice.issuedAt in [now-12m, now])` ÷ `sum(invoice.total where invoice.contractorId = assignment.contractorId AND invoice.issuedAt in [now-12m, now])` across ALL client organizations that contractor invoices (platform-visible total — off-platform income is acknowledged in the Phase 59 other-client attestation and NOT used here because it isn't auditable). Thresholds: 70.00% → `classification.economic_dependency_warning`, 83.33% → `classification.economic_dependency_critical`.
- **D-03:** **Dedup via `Notification` entity pointer + state table.** Reuse the existing `Notification` model with `entityType='ContractorAssignment'`, `entityId=assignment.id`, and `type='classification.economic_dependency_{warning|critical}'`. A new lightweight `EconomicDependencyAlertState` Prisma model tracks per-engagement current state (`assignmentId`, `currentBand ENUM('safe'|'warning'|'critical')`, `lastBillingShare`, `lastScannedAt`, `lastCrossedAt`, `lastReminderAt`). The cron transitions state; a notification fires only on band up-crossings (safe→warning, warning→critical, safe→critical). Down-crossings (warning→safe, critical→warning) produce a resolve notification that clears the dedup key.
- **D-04:** **Re-fire cadence: alert once per threshold crossing, then monthly reminder while still over.** When a contractor has stayed in the warning band continuously for ≥30 days since the last notification, the cron fires one reminder notification of the same type. Same rule for critical band. `lastReminderAt` tracks the reminder clock; it resets on down-crossing. This keeps the issue visible without the noise of daily re-fires.
- **D-05:** **Delivery channels respect `UserNotificationPreference`.** Two new notification types registered: `classification.economic_dependency_warning` and `classification.economic_dependency_critical`. Default preference for new users: `channelInApp=true`, `channelEmail=true`, `channelSlack=false`, `channelTeams=false`, `digestMode=false`. Existing users inherit the defaults via a migration script that inserts preference rows only where none exist (non-destructive upsert). Recipient set = any user in the org with an active role granting `contractor:read` OR `contractor:update` on that engagement (gate via the app's existing RBAC layer — do NOT invent a new gate).

### Reassessment Triggers (CLASS-08)
- **D-06:** **AuditLog post-hoc scan in a daily cron** is the detection mechanism. New cron route `apps/web/src/app/api/cron/classification-reassessment-triggers/route.ts`. Each run scans `AuditLog` rows where `createdAt > lastScanCompletedAt`, filtered to `resourceType IN ('ContractorAssignment', 'Contract')` for engagements where the contractor's `countryCode='GB'`. Reuses existing audit infrastructure — no Prisma middleware, no outbox, no mutation-path contention.
- **D-07:** **Material-change field allowlist:**
  - On `ContractorAssignment`: `activeTo` change (extension or shortening), any rate field change if the schema has one (check `packages/db/prisma/schema/contractor.prisma` during planning — if the day/hourly rate lives on `ContractorAssignment` directly, it's in scope; otherwise the linked `Contract.dayRate` covers it), `projectId` change, `teamId` change.
  - On `Contract` (engagement's active contract): any new signed version (new row with same engagementId created after the latest SDS's `generatedAt`), or updates to scope-bearing fields (amount/dayRate/scope/description/startDate/endDate).
  - Explicitly **ignored** (cosmetic edits): tag links, owner reassignments, `allocationPercent` changes ≤5 percentage points, free-text `notes` edits, cost-center changes (org-internal accounting, not a contractual material change).
  - Only fire a trigger when the engagement already has a completed IR35 `ClassificationAssessment` — no prior SDS means no "re-assessment" (new assessment covered by Phase 58 flow).
- **D-08:** **New Prisma model `ReassessmentTrigger`:**
  - Fields: `id`, `organizationId`, `contractorAssignmentId` (FK), `priorAssessmentId` (FK to the `ClassificationAssessment` the trigger is suggesting be re-done), `priorSdsDocumentId` (nullable FK to `ClassificationDocument` — the SDS generated from the prior assessment, for comparison linking), `triggeredAt`, `triggerReasons Json` (array of `{ field, oldValue?, newValue?, auditLogId, resourceType }` — so the UI can say "rate changed from X to Y on 2026-04-14" with receipts), `status` enum (`'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'`), `acknowledgedByUserId` (nullable), `acknowledgedAt` (nullable), `resolvedAt` (nullable — auto-set when a new IR35 assessment submitted for the engagement), `dismissedByUserId` / `dismissedAt` / `dismissedReason` (nullable — explicit "no material change" override), `createdAt`, `updatedAt`.
  - Indexed on `(organizationId, contractorAssignmentId, status)` and `(organizationId, triggeredAt)`. Multi-tenant scoped via the Prisma client extension.
  - Dedup: if an OPEN or ACKNOWLEDGED `ReassessmentTrigger` already exists for the same `contractorAssignmentId` + `priorAssessmentId`, append the new audit rows to the existing `triggerReasons` array and bump `triggeredAt`; do NOT create a new row. Avoids trigger spam when several fields change together.
- **D-09:** **Trigger actions:** a new `ReassessmentTrigger` row fires a `classification.reassessment_trigger` notification (delivery via the D-05 channel policy) linking to the engagement page; the engagement page shows a chip "Reassessment recommended" with a "Start new assessment" CTA next to the prior SDS download link. Submitting a new `ClassificationAssessment` for the engagement auto-sets the matching OPEN trigger's `status='RESOLVED'`. No email-and-forget, no auto-draft pre-fill.

### Statusfeststellungsverfahren Tracking (CLASS-09)
- **D-10:** **Lightweight Prisma model `Statusfeststellungsverfahren`:**
  - Fields: `id`, `organizationId`, `contractorAssignmentId` (FK — engagement anchor), `filedAt` (Date), `drvReference` (string — the DRV case reference number, free-form; not validated against a format because DRV reference formats have varied over time), `outcome` enum (`'PENDING' | 'SELBSTANDIG' | 'ABHANGIG' | 'WITHDRAWN'`), `validFrom` (Date, nullable — null when pending), `validTo` (Date, nullable), `notes` (Text, nullable), `createdAt`, `updatedAt`.
  - Multi-tenant scoped. Indexed on `(organizationId, contractorAssignmentId)` and `(organizationId, validTo)` (cron scan index).
  - No document upload, no correspondence log, no state machine in v5.0 — the 4 CLASS-09 fields plus expiry reminders exactly. Document uploads are deferred (see deferred section).
- **D-11:** **Expiry reminders at 90 / 30 / 7 days before `validTo`.** Piggybacked on the existing `/api/cron/reminders` route (add a new helper function), not a new cron, to keep reminder logic co-located. Three notification types: `classification.drv_expiry_90d`, `classification.drv_expiry_30d`, `classification.drv_expiry_7d`. Dedup: one row per `(statusfeststellungsverfahrenId, notificationType)` pair — emitted at most once ever, not re-fired. Reminders skipped for clearances with `outcome IN ('WITHDRAWN', 'PENDING')`. Why 90/30/7: DRV processing takes 3-6 months typically; 90 days gives lead time for the renewal filing.
- **D-12:** **CTA and UI surfaces:** primary CTA on the Phase 59 engagement detail page (`/[locale]/(dashboard)/contractors/[id]/engagements/[engagementId]/page.tsx`) — new `StatusfeststellungsverfahrenPanel` component under `apps/web/src/components/contractors/classification/drv-clearance/`. List/edit/cancel inline. Secondary list view on the Phase 60 compliance dashboard for users to see all active clearances across the org. Writes gated by `contractor:update`; reads by `contractor:read`. New tRPC router `packages/api/src/routers/statusfeststellungsverfahren.ts` with procedures `list`, `listByEngagement`, `create`, `update`, `delete`.

### Compliance Health Dashboard (CLASS-10)
- **D-13:** **Single page `/[locale]/(dashboard)/classification/page.tsx` with per-market cards stacked vertically (GB IR35 above DE Scheinselbständigkeit) + global header.**
  - Global header: total contractors, total active engagements, last-scan timestamp (max of the two compliance crons' `lastScanCompletedAt`).
  - Each market card has exactly 4 tiles:
    1. **Assessment coverage %** — `completed_assessments_for_market ÷ active_engagements_for_market`.
    2. **Risk distribution** — horizontal stacked bar (D-14).
    3. **Overdue reassessments** — count + inline list of `ReassessmentTrigger` rows with `status IN ('OPEN', 'ACKNOWLEDGED')` for engagements in that market (UK only for IR35 card; DE overdue assessment defined as "latest completed DE assessment > 12 months old" shown on the DE card).
    4. **Active alerts** — for GB card: count of open IR35 reassessment triggers. For DE card: count of engagements currently in `warning` or `critical` economic-dependency band + inline Statusfeststellungsverfahren expiring within 90 days.
  - Users see both markets at once. No tabs.
- **D-14:** **Risk distribution = horizontal stacked bar** with colour segments matching the Phase 58 outcome pill palette (GB: green `Outside IR35` / amber `Undetermined` / red `Inside IR35`; DE: green / amber / red traffic-light). Hover reveals raw counts + percentages. Sourced from the latest completed `ClassificationAssessment` per engagement. No donut, no KPI-number tiles — the stacked bar compares two markets side-by-side at a glance.
- **D-15:** **Data freshness: live query on page load + manual refresh button.** Each of the 4 tiles per market is a server-rendered tRPC query via the new `classificationDashboard` tRPC router (`packages/api/src/routers/classification-dashboard.ts`). No caching layer in v5.0 — query cost is bounded by engagement count per org (low hundreds max). The refresh button re-invalidates the React Query cache and re-fetches all tiles. No client-side polling, no materialised view, no nightly snapshot.
- **D-16:** **CSV export scope:** the dashboard has a "Download CSV" action per market card. CSV contains one row per engagement with columns: engagement id, contractor name, country, latest-assessment verdict, latest-assessment completed date, latest-assessment score (DE only), current economic-dependency band + billing share (DE only), open reassessment trigger (Y/N), Statusfeststellungsverfahren status (DE only), Statusfeststellungsverfahren validTo (DE only). Generated server-side via the same tRPC queries joined into a streaming response; signed URL TTL follows the Phase 56/59 pattern (300s).

### Claude's Discretion
- Exact CSS layout (card spacing, tile widths, typography scale) — follow the existing dashboard patterns in `apps/web/src/app/[locale]/(dashboard)/`
- Chart library choice for the stacked bar (native SVG + divs vs Recharts vs Tremor) — lightest option that fits the existing bundle
- Exact cron schedule times (e.g. 02:00 UTC daily) — pick a slot that doesn't collide with existing crons; coordinate via vercel.json or similar
- Whether to batch-process assignments in the crons (pagination for orgs with thousands of engagements) — add if perf matters; not required for v5.0 test orgs
- Notification digest behaviour — existing `digestMode` flag on `UserNotificationPreference` should already be honoured by `notification-service`; verify during planning but do not change the digest logic in this phase
- Precise dashboard empty-state copy (no engagements yet, no assessments yet, etc.) — match the existing dashboard empty-state patterns
- Whether `ReassessmentTrigger.triggerReasons` is typed as `unknown[]` or a Zod-validated schema — Zod schema is cleaner; the JSON shape is small
- Visual style of the reassessment "chip" on the engagement page (pill, banner, badge) — defer to frontend-design plugin during planning
- Whether the Statusfeststellungsverfahren panel shows a pre-filled DRV form link (help text pointing to the DRV V0023 PDF) — nice-to-have; decide during planning

### Folded Todos
No todos folded — `gsd-tools todo match-phase 60` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` lines 27-30 — CLASS-07 (economic-dep alerts), CLASS-08 (reassessment triggers), CLASS-09 (Statusfeststellungsverfahren), CLASS-10 (compliance health dashboard)
- `.planning/ROADMAP.md` §Phase 60 — Goal, 4 success criteria, `UI hint: yes`

### Standing project constraints
- `.planning/STATE.md` §"Standing Project Constraints" — app is local-only; legal-review checkpoints (Steuerberater, UK tax-adviser) are deferred post-deploy; ship code with locked-phrase working copy and record deferred sign-off in SUMMARY.md

### Prior phase context (foundations this phase extends)
- `.planning/phases/58-classification-engine-rule-sets/58-CONTEXT.md` — D-03 assessment outcome envelope, D-08 append-only + ruleSetVersion, D-14 DRV weighted scoring + traffic-light thresholds, D-15 economic-dependency capture at assessment time (billingRatio 0-100) — Phase 60 monitors drift away from that captured value
- `.planning/phases/59-classification-documents-chain-tracking/59-CONTEXT.md` — D-06 `ClassificationDocument` model (Phase 60 links ReassessmentTrigger.priorSdsDocumentId here), D-10 `Ir35ChainParticipant` (dashboard rolls up SDS delivery stats), D-09 frozen-to-rule-set document lifecycle (reassessment triggers produce new assessments + new documents, never mutate old ones)
- `.planning/phases/57-government-api-clients/57-CONTEXT.md` — `isKleinunternehmer` org flag (may interact with economic-dependency scoring edge cases — confirm during planning)

### Existing code (reusable infrastructure)
- `packages/db/prisma/schema/notification.prisma` — `Notification`, `UserNotificationPreference`, `NotificationChannel`, `NotificationStatus` — reused for all 5 new notification types
- `packages/api/src/services/notification-service` — `dispatch(...)` function already handles channel fan-out + preference lookup + digest mode; Phase 60 just registers new types
- `apps/web/src/app/api/cron/reminders/route.ts` — reference cron pattern (Bearer auth via `CRON_SECRET`, `withCronMonitor`, Sentry, metrics, `createCronLogger`, Prisma); copy the shell for the two new Phase 60 crons; extend this file itself with the Statusfeststellungsverfahren 90/30/7 reminder helper (D-11)
- `packages/api/src/services/cron-monitor` — `withCronMonitor` wrapper
- `packages/logger` — `createCronLogger` + metrics; must be used (project policy — no `console.*` in source)
- `packages/db/prisma/schema/audit.prisma` — `AuditLog` model with `oldValuesJson` / `newValuesJson` / `resourceType` / `resourceId` — the entire CLASS-08 detection pipeline reads from here
- `packages/db/prisma/schema/contractor.prisma` — `ContractorAssignment` (engagement anchor for all 4 CLASS-07/08/09 models); confirm where the rate field lives during planning (assignment vs contract)
- `packages/db/prisma/schema/classification.prisma` — Phase 58's `ClassificationAssessment` (source of truth for risk distribution + economic-dep band history) + Phase 59's `ClassificationDocument`
- `packages/db/src/tenant.ts` — tenant-scoped Prisma client extension; append-only guard (Phase 59) — new models use the same infrastructure
- `packages/api/src/routers/` — Phase 58's `classification.ts`, Phase 59's `classification-document.tsx`, `ir35-chain.ts`, `ir35-other-client-attestation.ts`; Phase 60 adds `statusfeststellungsverfahren.ts`, `reassessment-trigger.ts`, `classification-dashboard.ts`, `economic-dependency-alert.ts` (read/dismiss handlers)
- `apps/web/src/components/contractors/classification/` — Phase 58 wizard/outcome components and Phase 59 document/chain/attestation components; Phase 60 adds subdirectories for `drv-clearance/`, `reassessment-trigger/`, `economic-dependency-alerts/`, and a top-level dashboard under `apps/web/src/app/[locale]/(dashboard)/classification/`
- `apps/web/messages/{en,de,pl,ar}.json` — `Classification` namespace (existing Phase 58/59 keys); Phase 60 adds keys under `Classification.polish.*` for chrome strings (notification titles, tile labels, button copy). Locked legal phrasing NEVER lives in messages (Phase 56/58 pattern)
- `packages/validators/src/legal/de.ts` — existing `CLASSIFICATION_SCHEIN_*` and `DRV_DEFENSE_*` constants; Phase 60 adds `DRV_CLEARANCE_*` constants if any German statutory phrasing is needed for the Statusfeststellungsverfahren UI
- `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — extend reserved-key list with `DRV_CLEARANCE_*` if constants are added
- RBAC / `contractor:read` + `contractor:update` gates — reuse existing permission checks (search `packages/api/src/middleware/` during planning)

### External regulatory references (normative text sources)
- §2 Nr. 9 SGB VI — the 70% / 83.33% economic-dependency thresholds for arbeitnehmerähnliche Selbständige
- DRV Rundschreiben RS 2022/1 — economic-dependency assessment guidance (already a Phase 58 canonical ref)
- DRV Form V0023 — Statusfeststellungsverfahren application form (referenced by D-12 help-text TODO)
- HMRC off-payroll working rules (ITEPA 2003 Chapter 10) — §7 "When a Status Determination Statement must be reviewed"; Employment Status Manual ESM10011

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Notification dispatcher** (`packages/api/src/services/notification-service`): Phase 60 registers new notification types and calls `dispatch()` — the service handles channel fan-out, preference lookup, Slack/Teams/email wiring, and digest batching. No per-channel code needed here
- **Notification + UserNotificationPreference schema** (`packages/db/prisma/schema/notification.prisma`): already supports entity pointers (`entityType`, `entityId`) so Phase 60 rows can link to `ContractorAssignment` / `Statusfeststellungsverfahren` / `ReassessmentTrigger` for drill-down from the inbox
- **Cron infrastructure** (`apps/web/src/app/api/cron/reminders/route.ts`): Bearer-token auth via `CRON_SECRET`, `withCronMonitor`, Sentry, metrics, `createCronLogger`. Clone the shell for 2 new Phase 60 crons and extend this file with the DRV-expiry reminder helper
- **AuditLog** (`packages/db/prisma/schema/audit.prisma`): every mutation on `ContractorAssignment` and `Contract` already writes an audit row with `oldValuesJson` + `newValuesJson` — Phase 60's CLASS-08 cron is pure-read against this table
- **Phase 58 `ClassificationAssessment.outcome.categoryBreakdown`**: DRV category scores already structured (Phase 58 D-14) — dashboard risk distribution is a straight aggregation, no rescoring logic
- **Phase 58 `billingRatioSchema`** (`packages/classification/src/schemas/answers.ts`): captured value at assessment time; Phase 60's cron computes live drift from invoice data and compares against the captured snapshot to detect band crossings
- **Multi-tenant Prisma client extension** (`packages/db/src/tenant.ts`): all new Phase 60 models (`EconomicDependencyAlertState`, `ReassessmentTrigger`, `Statusfeststellungsverfahren`) use it automatically for `organizationId` scoping
- **Phase 59 engagement detail page**: surface for new CTAs (Statusfeststellungsverfahren panel, reassessment trigger chip, economic-dep band indicator)
- **Phase 58/59 outcome-pill colour palette**: reused for dashboard risk-distribution bar segments

### Established Patterns
- **Append-only compliance tables** (Phase 51, 57, 58, 59): `ReassessmentTrigger` is NOT append-only (status field transitions); `EconomicDependencyAlertState` is per-assignment with updates; `Statusfeststellungsverfahren` is per-engagement with updates. Phase 60 is the first phase in the classification track with mutable compliance rows — justified because these track CURRENT state, not immutable evidence (the evidence lives in `ClassificationAssessment` + `ClassificationDocument` which remain append-only)
- **Locked legal phrase constants + CI guard** (Phase 56/58/59): German statutory phrasing in the DRV-clearance UI flows through `packages/validators/src/legal/de.ts` with CI-guard coverage. Ordinary chrome copy (button labels, tile headings, notification titles) lives in `apps/web/messages/*.json` under `Classification.polish.*`
- **Zod at tRPC boundary** (repo-wide): every new router procedure takes a Zod input schema; `triggerReasons` JSONB serialized through a Zod-validated type
- **tRPC query-per-tile dashboard pattern** (existing dashboards under `apps/web/src/app/[locale]/(dashboard)/`): each tile is its own tRPC query; follow the same pattern for `classificationDashboard` router
- **RBAC via `contractor:read` / `contractor:update`**: existing gates are respected end-to-end by Phase 58/59 routers; Phase 60 reuses them (writes on `Statusfeststellungsverfahren` / `ReassessmentTrigger` dismiss = `contractor:update`, reads = `contractor:read`)
- **No `console.*` in source** — `@contractor-ops/logger` factories or raw `pino` in standalone scripts

### Integration Points
- **Engagement detail page** (Phase 59): three new UI sections appear here — Statusfeststellungsverfahren panel (DE only), reassessment-trigger chip + CTA (GB only, when an OPEN trigger exists), economic-dep band indicator (DE only, pulled from `EconomicDependencyAlertState`)
- **Contractor profile `CountryComplianceSection`** (Phase 56 D-14, extended in Phase 58 D-05 and Phase 59): add per-engagement "Compliance health" mini-tile showing current band + open triggers + DRV-clearance status
- **Global dashboard nav**: new top-level entry "Classification" pointing to `/[locale]/(dashboard)/classification/` (the Phase 60 dashboard page)
- **Notification inbox** (existing): the 5 new notification types appear in the existing inbox with entity pointers back to the engagement; the user drills down from inbox → engagement page → take action
- **tRPC appRouter** (`packages/api/src/routers/root.ts`): wire in `statusfeststellungsverfahren`, `reassessmentTrigger`, `classificationDashboard`, `economicDependencyAlert` routers
- **`/api/cron/reminders` route extension**: DRV 90/30/7 reminder helper lives here; two new cron routes added alongside for the two daily scans

</code_context>

<specifics>
## Specific Ideas

- Daily cron latency of up to 24h for economic-dependency alerts is a deliberate trade-off: dependency is a trend, not a transaction. Real-time alerting would burn complexity without changing the compliance outcome
- Off-platform income is NOT used in the billing-share calculation because it isn't auditable. The Phase 59 "other-client attestation" captures it narratively for DRV audit defense; Phase 60 alerts rely on platform-visible data only
- `ReassessmentTrigger.triggerReasons` as a JSON array of `{field, oldValue, newValue, auditLogId, resourceType}` gives the UI receipts ("rate changed from X to Y on 2026-04-14, per audit log Z") — load-bearing for user trust in the trigger
- Dedup on reassessment triggers via "append reasons to existing OPEN/ACKNOWLEDGED row" rather than "create new row" prevents trigger spam when several fields change together in one user action
- The 90/30/7 expiry reminder cadence explicitly accounts for DRV's 3-6 month processing time — 90 days isn't generous, it's realistic for the renewal filing lead time
- Phase 60 is the first classification-track phase with mutable compliance rows (status transitions on triggers and clearances). This is deliberate because Phase 60 tracks CURRENT state while Phase 58/59 preserve historical EVIDENCE — two different tiers of durability
- The compliance health dashboard uses a stacked-bar risk distribution because two markets visible side-by-side compare better than two donuts or two columns of KPI numbers
- CSV export on the dashboard exists because a compliance officer's first instinct is "I need to send this to our auditor" — providing it in v5.0 avoids the "why can't I download this" support ticket
- Band up-crossings (safe→warning, warning→critical) fire notifications; down-crossings fire resolve notifications. This mirrors how standard monitoring systems work and matches user expectations

</specifics>

<deferred>
## Deferred Ideas

- **DRV decision letter upload + R2 storage** on `Statusfeststellungsverfahren` — v5.0 ships without uploads; add if audit-defense needs materialise post-deploy
- **Statusfeststellungsverfahren correspondence log** (multiple DRV exchanges, appeals, questions) — out of scope for v5.0; fuller lifecycle state machine deferred
- **Event-driven alerting via Prisma middleware or outbox** — cron is sufficient for v5.0 latency; revisit if a real-time signal becomes a customer requirement
- **Materialised compliance-dashboard snapshot table** refreshed nightly — defer until tenant-scale performance demands it (low-hundreds-of-engagements per org is fine with live tRPC queries)
- **Client-side polling / server-sent events for the dashboard** — manual refresh button covers the v5.0 need; real-time push is a later phase
- **Configurable alert thresholds per org** — 70% / 83.33% are statutory under §2 SGB VI and shouldn't be user-editable. If a customer needs a custom "internal warning" threshold (e.g. 60%), that's a separate feature
- **Threshold-crossing audit log for compliance evidence** — band transitions are visible in `EconomicDependencyAlertState.lastCrossedAt` + the `Notification` rows, sufficient for v5.0 audit traceability; a dedicated `EconomicDependencyBandTransition` history table can land later if auditors ask for it
- **Automatic draft-assessment pre-fill on reassessment trigger** — D-09 explicitly rejects this for v5.0; users should make the call to start a new assessment
- **Per-engagement reassessment cadence config** (e.g. "force reassessment every 12 months regardless of changes") — defer; CLASS-08 is event-driven only, time-based is a future phase if HMRC guidance tightens
- **Third-market support (beyond GB + DE)** in the dashboard — out of scope for v5.0; additional markets arrive with the rule-sets
- **Auditor-portal share links** (read-only dashboard for external HMRC/DRV auditors) — future phase; CSV export covers the v5.0 need
- **Slack/Teams compliance-alert integration beyond the default notification-service plumbing** (rich-card formatting, inline acknowledge buttons) — reuse whatever the notification-service ships; Slack-specific polish is a future phase

### Reviewed Todos (not folded)
None — `gsd-tools todo match-phase 60` returned 0 matches, so no todos were reviewed.

</deferred>

---

*Phase: 60-classification-polish*
*Context gathered: 2026-04-14*
