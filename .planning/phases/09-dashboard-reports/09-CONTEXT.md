# Phase 9: Dashboard & Reports - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

KPI dashboard with real-time metrics and actionable widgets as the authenticated landing page. Month-over-month spend chart with configurable time range. Upcoming deadlines, approval queue widget, and grouped activity feed. Filterable reports page with spend by contractor, spend by team/project, expiring contracts, overdue invoices, and compliance gaps — each with summary chart + detail table. Searchable, filterable, exportable audit log viewer in Settings. CSV export for all reports and audit log. This phase does NOT include data import (Phase 10), custom report builder, or PDF export (v2).

</domain>

<decisions>
## Implementation Decisions

### Dashboard layout & KPI cards
- **D-01:** 5 KPI cards in a single horizontal row across the top: active contractors, pending approvals, ready-to-pay total, expiring contracts (30 days), open tasks. Dense, everything at a glance
- **D-02:** Below KPI cards: two-column layout. Left column: spend chart + upcoming deadlines widget. Right column: approval queue widget + activity feed. Balanced visual weight
- **D-03:** KPI cards are clickable — each navigates to the relevant page with pre-applied filters (e.g., "Pending Approvals: 7" → /approvals?tab=my&status=pending)
- **D-04:** Activity feed shows last 20 events with two-line cards (actor + action, entity details), grouped by today/yesterday/earlier. Each event links to its entity

### Charts & visualization
- **D-05:** Recharts as the charting library — declarative React charts, good Tailwind/shadcn integration
- **D-06:** Spend chart is an area chart — filled line showing month-over-month trend, stacked by currency if multiple currencies exist
- **D-07:** Spend chart shows last 6 months by default with a toggle: 6m / 12m / YTD. Toggle persists via URL param
- **D-08:** Report pages include charts — each report shows a summary chart at the top and a detailed table below with export capability

### Reports page structure
- **D-09:** Single `/reports` page with a sidebar listing all report types. Selecting one loads it in the main content area — no separate routes per report
- **D-10:** Date range filter: preset buttons (This month / Last 3 months / Last 6 months / YTD / Custom) + custom date picker. Persistent across report type switches
- **D-11:** Drill-down: clicking a bar/segment in a report chart filters the detail table below to that contractor/team/month. Breadcrumb trail shows the active filter path with clear button
- **D-12:** CSV export: two options — "Export page" for the currently visible filtered data, "Export all" for the full dataset matching the date range (ignoring pagination)

### Audit log viewer
- **D-13:** Audit log lives in Settings > Audit Log tab — alongside existing org settings, users, approval chains, notifications, integrations tabs. Admin-focused
- **D-14:** Expandable rows for before/after diffs — click a row to expand and see a diff-style view (old value → new value) for each changed field. Collapsed rows show actor, action, resource, timestamp
- **D-15:** Full-text search bar + structured filters: actor dropdown, action type dropdown, resource type dropdown, date range picker. Search across all text fields (actor name, resource name, action)
- **D-16:** CSV export — Claude decides the column set based on compliance use cases (balance between completeness and usability in spreadsheets)

### Claude's Discretion
- Recharts chart component styling and color palette
- KPI card trend indicators (sparkline, arrow, percentage change)
- Deadlines widget sorting and grouping logic
- Approval queue widget item count and layout
- Report sidebar styling and active state
- Audit log expandable row animation and diff formatting
- Empty states for each widget and report
- Loading skeletons for dashboard widgets
- Mobile responsive behavior for two-column layout

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements & data model
- `prd.md` — Full PRD with dashboard KPI requirements, report specifications, audit log requirements, UI views
- `db-schema.md` — Complete database schema including AuditLog model with actor/action/resource/old/new values

### Phase requirements
- `.planning/REQUIREMENTS.md` — Phase 9 requirements: DASH-01 through DASH-05, RPT-01 through RPT-06, ORG-10
- `.planning/ROADMAP.md` — Phase 9 plans and success criteria

### Prior phase decisions
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — App shell, Stripe Dashboard aesthetic, RBAC with 8 roles, Settings page structure
- `.planning/phases/02-contractor-registry/02-CONTEXT.md` — TanStack Table patterns, side panel, bulk actions, compliance health score
- `.planning/phases/05-invoice-intake-matching/05-CONTEXT.md` — Invoice status flow, status chip bar pattern with live counts
- `.planning/phases/06-approval-workflow/06-CONTEXT.md` — Approval queue, SLA timers, audit trail timeline
- `.planning/phases/08-payments/08-CONTEXT.md` — Payment run history, currency totals, grosze formatting

### Prisma schema
- `packages/db/prisma/schema/audit.prisma` — AuditLog model (actorType, action, resourceType, oldValuesJson, newValuesJson, metadataJson, indexes)
- `packages/db/prisma/schema/invoice.prisma` — Invoice with totalGrosze, status, paymentStatus for spend aggregation
- `packages/db/prisma/schema/payment.prisma` — PaymentRun with totalGrosze, status for payment-based spend data
- `packages/db/prisma/schema/contractor.prisma` — Contractor with status, lifecycleStage, primaryTeamId for grouping

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/app/[locale]/(dashboard)/page.tsx` — Existing dashboard placeholder page to replace with full dashboard
- `apps/web/src/components/invoices/status-chip-bar.tsx` — StatusChipBar pattern with live counts via tRPC query, loading skeletons — reusable for KPI card pattern
- `apps/web/src/components/ui/card.tsx` — Base Card, CardHeader, CardTitle, CardDescription components for KPI cards
- `apps/web/src/components/contractors/contractor-table/` — Full TanStack Table pattern to follow for audit log viewer and report tables
- `apps/web/src/components/contractors/contractor-table/data-table-bulk-actions.tsx` — base64 file download pattern for CSV export
- `packages/api/src/routers/invoice.ts` — `invoice.statusCounts()` aggregation query pattern to follow for dashboard KPIs
- `packages/api/src/services/payment-export.ts` — xlsx library for CSV generation (already in dependencies)
- `apps/web/src/components/settings/` — Settings page with existing tabs to extend with Audit Log tab

### Established Patterns
- tRPC routers in `packages/api/src/routers/` with `tenantProcedure` + `requirePermission()` middleware chain
- `plain()` helper to strip Prisma class prototypes from tRPC returns
- Integer grosze for all monetary fields with `Intl.NumberFormat` for display formatting (divide by 100)
- React Hook Form + Zod resolver for all forms
- `useTranslations()` from next-intl for all UI text
- URL query params via nuqs for page state (date range, report type, filters)
- `date-fns` already installed for date manipulation
- `react-day-picker` already installed for date range picker component
- Reports navigation already configured in `apps/web/src/lib/navigation.ts` with BarChart3 icon and `report.read` permission

### Integration Points
- Dashboard page route `(dashboard)/page.tsx` — replace placeholder with full dashboard
- Reports page route — create at `(dashboard)/reports/page.tsx` or similar
- Settings page — extend with Audit Log tab
- Root tRPC router in `packages/api/src/root.ts` — needs dashboard and audit routers
- Auth permissions — `report: ["read", "export"]` already defined in permission matrix
- All existing routers provide data sources: contractor counts, invoice totals, approval queues, payment sums, contract expirations, workflow tasks

</code_context>

<specifics>
## Specific Ideas

- KPI cards as navigation shortcuts — clicking "Pending Approvals: 7" drops the user directly into their filtered approval queue, reducing clicks
- Two-column layout below KPIs balances "monitoring" (left: spend + deadlines) with "action" (right: approvals + activity)
- Drill-down from report charts keeps everything on one page — breadcrumb shows filter path, click to clear
- Grouped activity feed (today/yesterday/earlier) gives temporal context without overwhelming with timestamps
- Audit log in Settings keeps the sidebar clean while being accessible to admins who manage the org

</specifics>

<deferred>
## Deferred Ideas

- Custom report builder — v2 feature
- PDF export for reports — v2
- Scheduled email report delivery — v2
- Dashboard widget customization (drag-and-drop, show/hide widgets) — v2
- Advanced analytics (cohort analysis, predictive spend) — v2
- Real-time WebSocket updates for dashboard — out of scope per project constraints

</deferred>

---

*Phase: 09-dashboard-reports*
*Context gathered: 2026-03-22*
