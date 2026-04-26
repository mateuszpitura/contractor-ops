# Phase 9: Dashboard & Reports - Research

**Researched:** 2026-03-22
**Domain:** Dashboard KPI widgets, data visualization (Recharts), filterable reports, audit log viewer, CSV export
**Confidence:** HIGH

## Summary

Phase 9 builds read-only reporting surfaces on top of all data created in Phases 1-8. The dashboard replaces the existing placeholder page with 5 KPI cards, a spend area chart, deadlines widget, approval queue widget, and activity feed. The reports page provides 5 filterable report types (spend by contractor, spend by team, expiring contracts, overdue invoices, compliance gaps) with summary charts, detail tables, and CSV export. The audit log viewer lives in Settings as a new tab with expandable diff rows, full-text search, structured filters, and CSV export.

The core technical work is: (1) new tRPC aggregation queries across existing models (no schema changes needed), (2) Recharts 3.x integration for charts, (3) TanStack Table instances for report detail tables and audit log, and (4) CSV generation reusing the existing xlsx library pattern from payment-export.ts. All existing patterns (nuqs URL state, i18n, tenantProcedure + requirePermission, plain() helper, base64 Blob download) carry over directly.

**Primary recommendation:** Build a `dashboard` tRPC router for KPI aggregations and a separate `audit` tRPC router for audit log queries. Reports page queries can be added to the existing `invoice`, `contractor`, `contract`, and `workflow` routers as new aggregation procedures, or consolidated in a `report` router for cleaner separation. Use Recharts 3.x (current stable). No database migrations needed -- AuditLog model already has all required indexes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 5 KPI cards in a single horizontal row across the top: active contractors, pending approvals, ready-to-pay total, expiring contracts (30 days), open tasks. Dense, everything at a glance
- **D-02:** Below KPI cards: two-column layout. Left column: spend chart + upcoming deadlines widget. Right column: approval queue widget + activity feed. Balanced visual weight
- **D-03:** KPI cards are clickable -- each navigates to the relevant page with pre-applied filters (e.g., "Pending Approvals: 7" -> /approvals?tab=my&status=pending)
- **D-04:** Activity feed shows last 20 events with two-line cards (actor + action, entity details), grouped by today/yesterday/earlier. Each event links to its entity
- **D-05:** Recharts as the charting library -- declarative React charts, good Tailwind/shadcn integration
- **D-06:** Spend chart is an area chart -- filled line showing month-over-month trend, stacked by currency if multiple currencies exist
- **D-07:** Spend chart shows last 6 months by default with a toggle: 6m / 12m / YTD. Toggle persists via URL param
- **D-08:** Report pages include charts -- each report shows a summary chart at the top and a detailed table below with export capability
- **D-09:** Single `/reports` page with a sidebar listing all report types. Selecting one loads it in the main content area -- no separate routes per report
- **D-10:** Date range filter: preset buttons (This month / Last 3 months / Last 6 months / YTD / Custom) + custom date picker. Persistent across report type switches
- **D-11:** Drill-down: clicking a bar/segment in a report chart filters the detail table below to that contractor/team/month. Breadcrumb trail shows the active filter path with clear button
- **D-12:** CSV export: two options -- "Export page" for the currently visible filtered data, "Export all" for the full dataset matching the date range (ignoring pagination)
- **D-13:** Audit log lives in Settings > Audit Log tab -- alongside existing org settings, users, approval chains, notifications, integrations tabs. Admin-focused
- **D-14:** Expandable rows for before/after diffs -- click a row to expand and see a diff-style view (old value -> new value) for each changed field. Collapsed rows show actor, action, resource, timestamp
- **D-15:** Full-text search bar + structured filters: actor dropdown, action type dropdown, resource type dropdown, date range picker. Search across all text fields (actor name, resource name, action)
- **D-16:** CSV export -- Claude decides the column set based on compliance use cases (balance between completeness and usability in spreadsheets)

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

### Deferred Ideas (OUT OF SCOPE)
- Custom report builder -- v2 feature
- PDF export for reports -- v2
- Scheduled email report delivery -- v2
- Dashboard widget customization (drag-and-drop, show/hide widgets) -- v2
- Advanced analytics (cohort analysis, predictive spend) -- v2
- Real-time WebSocket updates for dashboard -- out of scope per project constraints
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | User sees KPI cards: active contractors, pending approvals, ready-to-pay total, expiring contracts (30 days), open tasks | tRPC dashboard.kpis query aggregating across contractor, approval, invoice, contract, workflow models |
| DASH-02 | User sees month-over-month spend chart | tRPC dashboard.spendTrend query grouping paid invoices by month + currency, Recharts AreaChart |
| DASH-03 | User sees upcoming deadlines (contract expirations, overdue tasks, due invoices) | tRPC dashboard.deadlines query combining contract.endDate, workflowTaskRun overdue, invoice.dueDate |
| DASH-04 | User sees approval queue widget (top pending approvals) | Reuse existing approval.listPending with small page size (limit 5) |
| DASH-05 | User sees recent activity feed | tRPC dashboard.activity or audit.list query on AuditLog, last 20, grouped by date |
| RPT-01 | User can view spend report by contractor (trend + totals) | tRPC report.spendByContractor aggregating paid invoices grouped by contractorId with date range filter |
| RPT-02 | User can view spend report by team/project/cost center | tRPC report.spendByTeam joining Invoice -> Contractor -> Team with date range filter |
| RPT-03 | User can view contracts expiring in 30/60/90 days | tRPC report.expiringContracts querying Contract where endDate between now and now+N days |
| RPT-04 | User can view overdue invoices report | tRPC report.overdueInvoices querying Invoice where dueDate < now AND paymentStatus NOT IN [PAID] |
| RPT-05 | User can view compliance gaps report (missing documents) | tRPC report.complianceGaps using existing compliance health score logic from Phase 2 |
| RPT-06 | User can filter reports by date range and export to CSV | nuqs date range state, xlsx library CSV generation with base64 download pattern |
| ORG-10 | Admin can view searchable, filterable, exportable audit log | tRPC audit.list with search/filter params, TanStack Table with expandable rows, CSV export |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.0 | Declarative React charts (AreaChart, BarChart, PieChart) | User-locked decision D-05. Most popular React charting library, composable API |
| @tanstack/react-table | ^8.21.3 | Report detail tables, audit log table | Already installed, pattern established in contractor-table and invoice-table |
| nuqs | ^2.8.9 | URL state for report type, date range, filters, drill-down | Already installed, pattern used across all pages |
| xlsx | ^0.18.5 | CSV generation for report and audit log export | Already installed in api package, pattern in payment-export.ts |
| date-fns | ^4.1.0 | Date arithmetic for KPI calculations, date range presets | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-day-picker | ^9.14.0 | Custom date range picker for report filters | Already installed, used for date inputs |
| lucide-react | (installed) | Icons for KPI cards, report sidebar, audit log | Already installed |
| sonner | (installed) | Toast notifications for export success/failure | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | @nivo/core, visx | User locked Recharts in D-05. Recharts is simpler API. |
| xlsx for CSV | Manual CSV string | xlsx handles proper escaping, encoding, BOM -- already proven in payment-export |

**Installation:**
```bash
pnpm add recharts --filter @contractor-ops/web
```

**Version verification:** recharts 3.8.0 confirmed via `npm view recharts version` on 2026-03-22.

## Architecture Patterns

### Recommended Project Structure
```
packages/api/src/
  routers/
    dashboard.ts         # KPI aggregations, spend trend, deadlines, activity
    audit.ts             # Audit log list, search, filters, export
    report.ts            # Spend by contractor/team, expiring contracts, overdue, compliance
  services/
    report-export.ts     # CSV generation for reports and audit log (reuses xlsx pattern)

apps/web/src/
  app/[locale]/(dashboard)/
    page.tsx             # Replace placeholder with full dashboard
    reports/
      page.tsx           # Reports page with sidebar + content area
  components/
    dashboard/
      kpi-cards.tsx      # 5 clickable KPI cards
      spend-chart.tsx    # Recharts AreaChart with toggle
      deadlines-widget.tsx
      approval-queue-widget.tsx
      activity-feed.tsx
    reports/
      report-sidebar.tsx
      date-range-filter.tsx
      report-chart.tsx   # Polymorphic chart (Bar/Pie based on report type)
      report-table.tsx   # TanStack Table for report detail
      drill-down-breadcrumb.tsx
      export-buttons.tsx
      spend-contractor-report.tsx
      spend-team-report.tsx
      expiring-contracts-report.tsx
      overdue-invoices-report.tsx
      compliance-gaps-report.tsx
    settings/
      audit-log-tab.tsx
      audit-log-table.tsx
      audit-log-diff-viewer.tsx
```

### Pattern 1: Dashboard KPI Aggregation Query
**What:** Single tRPC query returning all 5 KPI values via parallel Prisma queries
**When to use:** Dashboard page load
**Example:**
```typescript
// Source: Follows invoice.statusCounts pattern from packages/api/src/routers/invoice.ts
kpis: tenantProcedure
  .use(requirePermission({ report: ["read"] }))
  .query(async ({ ctx }) => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [activeContractors, pendingApprovals, readyToPayTotal,
           expiringContracts, openTasks,
           prevActiveContractors, prevPendingApprovals] = await Promise.all([
      prisma.contractor.count({
        where: { organizationId: ctx.organizationId, status: "ACTIVE", deletedAt: null },
      }),
      prisma.approvalStep.count({
        where: { organizationId: ctx.organizationId, status: "PENDING" },
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId: ctx.organizationId,
          paymentStatus: "READY",
          deletedAt: null,
        },
        _sum: { amountToPayGrosze: true },
      }),
      prisma.contract.count({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ["ACTIVE", "EXPIRING"] },
          endDate: { gte: now, lte: thirtyDaysFromNow },
          deletedAt: null,
        },
      }),
      prisma.workflowTaskRun.count({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      }),
      // Previous month counts for trend calculation...
      // (similar queries scoped to last month)
    ]);

    return plain({
      activeContractors: { value: activeContractors, trend: /* compute */ },
      pendingApprovals: { value: pendingApprovals, trend: /* compute */ },
      readyToPayTotal: { valueGrosze: readyToPayTotal._sum.amountToPayGrosze ?? 0, trend: /* compute */ },
      expiringContracts: { value: expiringContracts, trend: /* compute */ },
      openTasks: { value: openTasks, trend: /* compute */ },
    });
  }),
```

### Pattern 2: Spend Trend Aggregation (Monthly)
**What:** Group paid invoices by month and currency for area chart
**When to use:** Dashboard spend chart, spend reports
**Example:**
```typescript
// Raw SQL for month grouping (Prisma groupBy cannot group by date_trunc)
spendTrend: tenantProcedure
  .use(requirePermission({ report: ["read"] }))
  .input(z.object({ months: z.enum(["6", "12", "ytd"]) }))
  .query(async ({ ctx, input }) => {
    const startDate = computeStartDate(input.months);

    const result = await prisma.$queryRaw<Array<{
      month: Date;
      currency: string;
      total_grosze: bigint;
    }>>`
      SELECT date_trunc('month', "paidAt") as month,
             currency,
             SUM("amountToPayGrosze") as total_grosze
      FROM "Invoice"
      WHERE "organizationId" = ${ctx.organizationId}
        AND "paymentStatus" = 'PAID'
        AND "paidAt" >= ${startDate}
        AND "deletedAt" IS NULL
      GROUP BY date_trunc('month', "paidAt"), currency
      ORDER BY month ASC
    `;

    return result.map(r => ({
      month: r.month.toISOString(),
      currency: r.currency,
      totalGrosze: Number(r.total_grosze),
    }));
  }),
```

### Pattern 3: Recharts AreaChart with Stacking
**What:** Declarative React chart with stacked areas by currency
**When to use:** Dashboard spend chart (D-06)
**Example:**
```typescript
// Source: Recharts 3.x AreaChart API (https://recharts.github.io/en-US/api/)
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

<ResponsiveContainer width="100%" height={280}>
  <AreaChart data={chartData}>
    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.15)" />
    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
    <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 12 }} />
    <Tooltip content={<CustomTooltip />} />
    <Area
      type="monotone"
      dataKey="PLN"
      stackId="1"
      stroke="hsl(var(--primary))"
      fill="hsl(var(--primary) / 0.2)"
      strokeWidth={2}
    />
    {hasMultipleCurrencies && (
      <Area
        type="monotone"
        dataKey="EUR"
        stackId="1"
        stroke="hsl(220 70% 55%)"
        fill="hsl(220 70% 55% / 0.2)"
        strokeWidth={2}
      />
    )}
  </AreaChart>
</ResponsiveContainer>
```

### Pattern 4: Audit Log with Expandable Rows
**What:** TanStack Table with Collapsible expansion for diff view
**When to use:** Audit log tab in Settings (D-14)
**Example:**
```typescript
// Follows contractor-table pattern with expansion state
const [expanded, setExpanded] = useState<Record<string, boolean>>({});

// Row rendering with conditional expansion
{row.getVisibleCells().map(cell => /* standard cells */)}
{expanded[row.id] && (
  <tr>
    <td colSpan={columns.length}>
      <AuditLogDiffViewer
        oldValues={row.original.oldValuesJson}
        newValues={row.original.newValuesJson}
      />
    </td>
  </tr>
)}
```

### Pattern 5: CSV Export via Base64 Blob Download
**What:** Server generates CSV, returns base64, client triggers download
**When to use:** Report export and audit log export (D-12, D-16)
**Example:**
```typescript
// Source: Reuse pattern from data-table-bulk-actions.tsx + payment-export.ts
// Server side: tRPC mutation returns { data: base64, filename, mimeType }
// Client side:
const binaryStr = atob(result.data);
const bytes = new Uint8Array(binaryStr.length);
for (let i = 0; i < binaryStr.length; i++) {
  bytes[i] = binaryStr.charCodeAt(i);
}
const blob = new Blob([bytes], { type: result.mimeType });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = result.filename;
a.click();
URL.revokeObjectURL(url);
```

### Anti-Patterns to Avoid
- **Client-side aggregation:** Never fetch all invoices/contractors to the client to compute KPIs. All aggregation happens server-side in tRPC procedures.
- **N+1 queries in reports:** Use `groupBy`, `aggregate`, or raw SQL for report queries. Never loop through records.
- **Recharts with uncontrolled re-renders:** Memoize chart data and custom components. Recharts re-renders on every data reference change.
- **Audit log without cursor pagination:** For large audit logs, use cursor-based pagination (createdAt + id) rather than offset-based. The existing indexes support this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV generation | Manual string concatenation | `xlsx` library (already in deps) | Handles escaping, BOM, encoding edge cases |
| Date range presets | Manual date arithmetic | `date-fns` startOfMonth/subMonths/startOfYear | Timezone-safe, leap year handling |
| Chart rendering | Canvas/SVG manipulation | Recharts 3.x composable components | Declarative API, built-in tooltip/legend/responsive |
| URL state management | Manual searchParams | nuqs parseAsString/parseAsStringLiteral | Two-way sync, type-safe, SSR compatible |
| Table with sort/filter/paginate | Custom table logic | TanStack Table 8.x | Established pattern in contractor-table, proven |
| Diff view for audit log | JSON diffing library | Simple key-by-key comparison of old/new JSON | oldValuesJson and newValuesJson are flat objects -- no deep diffing needed |

**Key insight:** Phase 9 is 100% read-only. No mutations change existing data. All complexity is in efficient aggregation queries and correct chart rendering. The existing codebase already has every UI pattern needed -- this phase assembles them into new views.

## Common Pitfalls

### Pitfall 1: BigInt from Prisma Raw Queries
**What goes wrong:** `$queryRaw` returns `bigint` for SUM aggregations, which cannot be JSON serialized.
**Why it happens:** PostgreSQL SUM of Int returns `int8` (bigint). Prisma maps this to JS BigInt.
**How to avoid:** Explicitly cast to `Number()` before returning from tRPC, or use `::int` in SQL.
**Warning signs:** `TypeError: Do not know how to serialize a BigInt` at runtime.

### Pitfall 2: Recharts Re-rendering Performance
**What goes wrong:** Chart flickers or re-animates on every parent render.
**Why it happens:** Recharts compares data array by reference. If data is recreated on each render, chart re-renders.
**How to avoid:** `useMemo` for chart data transformation. Avoid inline array creation in JSX.
**Warning signs:** Chart animation replays on unrelated state changes.

### Pitfall 3: Date Range Filter Timezone Issues
**What goes wrong:** "This month" filter returns different results depending on user timezone vs server timezone.
**Why it happens:** `new Date()` on client is local timezone, Prisma queries run in UTC.
**How to avoid:** Use `date-fns` with consistent UTC approach. Pass ISO date strings from client, parse on server. Use `startOfMonth`/`endOfMonth` consistently.
**Warning signs:** Off-by-one day at month boundaries, different results for users in different timezones.

### Pitfall 4: Missing Permission Guards on Report Data
**What goes wrong:** Users without `report.read` permission can access aggregated financial data.
**Why it happens:** Forgetting to add `requirePermission({ report: ["read"] })` to report procedures.
**How to avoid:** Every report/dashboard procedure uses `requirePermission`. Audit log uses admin check.
**Warning signs:** Non-authorized roles seeing financial data in dashboard.

### Pitfall 5: Audit Log Pagination Performance
**What goes wrong:** Offset-based pagination becomes slow as audit log grows (thousands of entries).
**Why it happens:** PostgreSQL OFFSET scans and discards rows.
**How to avoid:** Use cursor-based pagination with `createdAt` + `id` as cursor. The composite index `[organizationId, createdAt]` supports this.
**Warning signs:** Slow page loads on later pages of audit log.

### Pitfall 6: Stale KPI Data on Dashboard
**What goes wrong:** User sees outdated KPI numbers after performing actions in other tabs.
**Why it happens:** TanStack Query cache not invalidated after mutations in other pages.
**How to avoid:** Use reasonable `staleTime` (30 seconds) for dashboard queries. Dashboard KPIs refresh on window focus via TanStack Query default `refetchOnWindowFocus`.
**Warning signs:** KPI count doesn't change after approving an invoice in another tab.

## Code Examples

### Audit Log Query with Search and Filters
```typescript
// Source: Follows invoice.list pattern from packages/api/src/routers/invoice.ts
list: tenantProcedure
  .use(requirePermission({ settings: ["read"] }))
  .input(z.object({
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(25),
    search: z.string().optional(),
    actorId: z.string().optional(),
    action: z.string().optional(),
    resourceType: z.nativeEnum(EntityType).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }))
  .query(async ({ ctx, input }) => {
    const where: Record<string, any> = {
      organizationId: ctx.organizationId,
    };

    if (input.search) {
      where.OR = [
        { actorName: { contains: input.search, mode: "insensitive" } },
        { resourceName: { contains: input.search, mode: "insensitive" } },
        { action: { contains: input.search, mode: "insensitive" } },
      ];
    }
    if (input.actorId) where.actorId = input.actorId;
    if (input.action) where.action = input.action;
    if (input.resourceType) where.resourceType = input.resourceType;
    if (input.dateFrom || input.dateTo) {
      where.createdAt = {};
      if (input.dateFrom) where.createdAt.gte = new Date(input.dateFrom);
      if (input.dateTo) where.createdAt.lte = new Date(input.dateTo);
    }

    const [items, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: { createdAt: input.sortOrder },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items: plain(items), totalCount, page: input.page, pageSize: input.pageSize };
  }),
```

### Spend by Contractor Report Query
```typescript
spendByContractor: tenantProcedure
  .use(requirePermission({ report: ["read"] }))
  .input(z.object({
    dateFrom: z.string(),
    dateTo: z.string(),
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(20),
    sortBy: z.enum(["totalSpend", "invoiceCount", "contractorName"]).default("totalSpend"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    contractorId: z.string().optional(), // For drill-down
  }))
  .query(async ({ ctx, input }) => {
    // Use raw query for efficient aggregation with pagination
    const result = await prisma.$queryRaw<Array<{
      contractor_id: string;
      contractor_name: string;
      invoice_count: bigint;
      total_grosze: bigint;
      avg_grosze: bigint;
      last_paid_at: Date | null;
    }>>`
      SELECT c.id as contractor_id,
             c."legalName" as contractor_name,
             COUNT(i.id)::int as invoice_count,
             COALESCE(SUM(i."amountToPayGrosze"), 0)::int as total_grosze,
             COALESCE(AVG(i."amountToPayGrosze"), 0)::int as avg_grosze,
             MAX(i."paidAt") as last_paid_at
      FROM "Invoice" i
      JOIN "Contractor" c ON c.id = i."contractorId"
      WHERE i."organizationId" = ${ctx.organizationId}
        AND i."paymentStatus" = 'PAID'
        AND i."paidAt" >= ${new Date(input.dateFrom)}
        AND i."paidAt" <= ${new Date(input.dateTo)}
        AND i."deletedAt" IS NULL
        ${input.contractorId ? Prisma.sql`AND c.id = ${input.contractorId}` : Prisma.empty}
      GROUP BY c.id, c."legalName"
      ORDER BY total_grosze DESC
      LIMIT ${input.pageSize}
      OFFSET ${(input.page - 1) * input.pageSize}
    `;

    return result.map(r => ({
      contractorId: r.contractor_id,
      contractorName: r.contractor_name,
      invoiceCount: Number(r.invoice_count),
      totalGrosze: Number(r.total_grosze),
      avgGrosze: Number(r.avg_grosze),
      lastPaidAt: r.last_paid_at?.toISOString() ?? null,
    }));
  }),
```

### Recharts BarChart with Click-to-Drill-Down
```typescript
// Report summary chart with click handler for drill-down (D-11)
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function ReportBarChart({ data, activeId, onBarClick }: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" tickFormatter={formatCurrency} />
        <YAxis dataKey="name" type="category" width={150} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="totalGrosze" onClick={(data) => onBarClick(data.contractorId)}>
          {data.map((entry) => (
            <Cell
              key={entry.contractorId}
              fill={
                activeId && activeId !== entry.contractorId
                  ? "hsl(var(--muted-foreground) / 0.3)"
                  : "hsl(var(--primary))"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### Audit Log Diff Viewer
```typescript
// D-14: Expandable row diff view
function AuditLogDiffViewer({ oldValues, newValues }: {
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
}) {
  if (!oldValues && !newValues) {
    return <p className="text-sm text-muted-foreground">{t("noChanges")}</p>;
  }

  const allKeys = new Set([
    ...Object.keys(oldValues ?? {}),
    ...Object.keys(newValues ?? {}),
  ]);

  const changedFields = [...allKeys].filter(
    (key) => JSON.stringify(oldValues?.[key]) !== JSON.stringify(newValues?.[key])
  );

  return (
    <div className="grid grid-cols-2 gap-4 p-4 border-l border-primary/20">
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">{t("before")}</h4>
        {changedFields.map((key) => (
          <div key={key} className="text-sm">
            <span className="text-muted-foreground">{key}:</span>{" "}
            <span className="text-destructive/50 line-through">
              {String(oldValues?.[key] ?? "")}
            </span>
          </div>
        ))}
      </div>
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">{t("after")}</h4>
        {changedFields.map((key) => (
          <div key={key} className="text-sm">
            <span className="text-muted-foreground">{key}:</span>{" "}
            <span className="text-green-600 dark:text-green-400">
              {String(newValues?.[key] ?? "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts 2.x | Recharts 3.x | 2025 | accessibilityLayer true by default, internal state API changes, Customized component props simplified |
| Chart.js with react-chartjs-2 | Recharts 3.x | N/A | Project decision D-05 locks Recharts. Recharts is more React-native with composable components |
| Client-side CSV generation | Server-side via xlsx + base64 download | Phase 8 established | Proper encoding, BOM, handles large datasets without browser memory issues |

**Deprecated/outdated:**
- Recharts 2.x: Still works but 3.x is current stable. Breaking change: `accessibilityLayer` defaults to true. Use 3.x.
- Victory Charts: Not considered (user locked Recharts).

## Open Questions

1. **Audit log data population**
   - What we know: AuditLog model exists with all required fields and indexes. Schema is ready.
   - What's unclear: Are audit log entries currently being written by existing routers? If not, the audit log tab will show empty data until audit logging is added to existing mutations.
   - Recommendation: Check if any existing router writes to AuditLog. If not, add audit log writes as part of this phase (at minimum for the activity feed), or accept empty state and add logging in a follow-up.

2. **Dashboard permission model**
   - What we know: Navigation shows dashboard to all authenticated users (permission: null). Reports require `report.read`.
   - What's unclear: Should KPI data (which includes financial totals) be restricted? Currently any authenticated user can see the dashboard.
   - Recommendation: Dashboard KPIs should use `report.read` permission. If user lacks this, show a simplified dashboard without financial KPIs. Or keep it open since all users need overview.

3. **Trend calculation for KPIs**
   - What we know: KPI cards show trend indicators (arrow + percentage vs last month).
   - What's unclear: How to handle the first month when there's no prior data for comparison.
   - Recommendation: Show neutral trend indicator (dash) when previous period has zero data. Don't show "infinity%" or "+100%".

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (installed in api package) |
| Config file | packages/api/vitest.config.ts |
| Quick run command | `pnpm --filter @contractor-ops/api test -- --run` |
| Full suite command | `pnpm --filter @contractor-ops/api test -- --run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | KPI aggregation returns correct counts | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/dashboard.test.ts` | Wave 0 |
| DASH-02 | Spend trend groups by month and currency | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/dashboard.test.ts` | Wave 0 |
| DASH-03 | Deadlines query combines contracts, tasks, invoices | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/dashboard.test.ts` | Wave 0 |
| DASH-04 | Approval queue widget reuses existing query | manual-only | Verified by UI rendering | N/A |
| DASH-05 | Activity feed returns last 20 audit entries grouped | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/dashboard.test.ts` | Wave 0 |
| RPT-01 | Spend by contractor aggregation with date filter | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/report.test.ts` | Wave 0 |
| RPT-02 | Spend by team joins contractor -> team correctly | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/report.test.ts` | Wave 0 |
| RPT-03 | Expiring contracts filters by 30/60/90 day window | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/report.test.ts` | Wave 0 |
| RPT-04 | Overdue invoices filters by dueDate < now | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/report.test.ts` | Wave 0 |
| RPT-05 | Compliance gaps report aggregates health scores | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/report.test.ts` | Wave 0 |
| RPT-06 | CSV export generates valid file with BOM | unit | `pnpm --filter @contractor-ops/api test -- --run src/services/__tests__/report-export.test.ts` | Wave 0 |
| ORG-10 | Audit log list with search, filter, pagination | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/audit.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @contractor-ops/api test -- --run`
- **Per wave merge:** `pnpm --filter @contractor-ops/api test -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/routers/__tests__/dashboard.test.ts` -- covers DASH-01 through DASH-05
- [ ] `packages/api/src/routers/__tests__/report.test.ts` -- covers RPT-01 through RPT-05
- [ ] `packages/api/src/routers/__tests__/audit.test.ts` -- covers ORG-10
- [ ] `packages/api/src/services/__tests__/report-export.test.ts` -- covers RPT-06

*(Framework already configured; no install needed)*

## Sources

### Primary (HIGH confidence)
- Existing codebase: `packages/api/src/routers/invoice.ts` -- statusCounts aggregation pattern, list with pagination/filter pattern
- Existing codebase: `packages/api/src/services/payment-export.ts` -- xlsx CSV generation with BOM pattern
- Existing codebase: `apps/web/src/components/invoices/status-chip-bar.tsx` -- live count badge pattern reusable for KPI cards
- Existing codebase: `apps/web/src/components/contractors/contractor-table/data-table-bulk-actions.tsx` -- base64 Blob download pattern
- Existing codebase: `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` -- Tab structure to extend with Audit Log tab
- Existing codebase: `packages/db/prisma/schema/audit.prisma` -- AuditLog model with indexes
- `npm view recharts version` -- 3.8.0 verified 2026-03-22

### Secondary (MEDIUM confidence)
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) -- Breaking changes from 2.x
- [Recharts Stacked AreaChart example](https://recharts.github.io/en-US/examples/StackedAreaChart/) -- Stacking API confirmation

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Recharts version verified, all other libraries already installed and proven in prior phases
- Architecture: HIGH -- All patterns directly follow established codebase conventions (tRPC router, TanStack Table, nuqs, xlsx export)
- Pitfalls: HIGH -- BigInt serialization and Recharts re-render issues are well-documented; timezone and permission issues are standard concerns

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable -- no fast-moving dependencies)
