# Facts: Unified Skeleton Loading Animations

## Tables

- Every table in the app (web + portal) has a `SectionLabel` header above it — icon chip + uppercase text + fading divider right
- `SectionLabel` applies to top-level entity tables, detail-page sub-tables, settings tables, intake lists, and custom tables
- During initial data load, table body shows skeleton rows matching visible column structure (text/badge/avatar/checkbox/actions shapes per column)
- During refetch (data present, query refreshing), table body shows translucent overlay — existing data stays visible, no layout shift
- Toolbar filters, search inputs, action buttons, sorting controls, and pagination controls are all disabled while `isLoading || isRefetching`
- All tables support pagination, column sorting, and column visibility customization
- All tables use the `DataTableBody` + `AtelierTableShell` pattern — includes migrated audit-log-table, slack-user-mapping, and intake-list
- `parentLoading` pattern is applied where a count query flies in parallel — prevents empty state flash until both data + count resolve
- Non-standard tables (audit-log-table.tsx, slack-user-mapping.tsx, intake-list.tsx) are migrated to the standard DataTableBody pattern

## Cards

- Every card that displays fetched data shows a shimmer `Skeleton` placeholder while its query is pending
- KPI metric values, labels, and secondary stats each show a `Skeleton` element (matching approximate content dimensions) while loading
- Card grids maintain consistent grid layout during loading — no reflow or height collapse
- Tax obligations widget shows skeleton rows instead of returning `null` while loading

## Lists

- Every list component displaying fetched data shows skeleton rows while loading
- Skeleton rows vary line widths to simulate real content structure (not uniform blocks)
- List components (activity feed, approvals queue, deadlines, document history, assessment list, SVRL issues, BACS warnings, ZATCA submissions) all have skeleton loading

## Charts

- Every chart shows a `Skeleton` placeholder matching the chart container height while its query is pending
- No chart renders silently with empty data — either shows skeleton (loading) or explicit empty state (no data)
- Spend chart, report chart, and all other chart components follow this pattern

## Decoupled Loading

- Each data section on a page fetches independently via its own React Query hook
- Page-level Suspense boundary is used only for URL state (nuqs) hydration — not as a gate for all data
- A single slow endpoint never blocks sibling components from rendering their own loading states or data
- Dashboard widgets (KPI cards, spend chart, deadlines, approvals queue, activity feed, tax obligations, e-invoice compliance, overdue receivables) each have independent loading state
- Detail pages (contractors/[id], invoices/[id], contracts/[id], etc.) load each sub-section independently
- Settings page sections each have independent loading states

## Portal

- Portal data components show skeleton loading states on first data fetch (cards, lists, tables)
- Portal does NOT use `SectionLabel` — it uses a lighter section header variant (uppercase text + divider, no icon chip) appropriate for the contractor-facing context
- A `PortalSectionLabel` component (or `SectionLabel` with a `variant="portal"` prop) is created in the shared UI package for portal use
- Portal return flow, invoice submit form, and all other portal components with data fetching have consistent skeleton loading states

## Top-Level Page Review

- All dashboard pages are audited for loading state completeness and gaps are fixed
- Pages that use `PageLoadingSpinner` as Suspense fallback are reviewed — confirmed appropriate (nuqs hydration only)
- Pages with full-page spinners that could instead use component-level skeletons are refactored

## Design Consistency

- `SectionLabel` component (`packages/ui/src/components/atelier/section-label.tsx`) is the single standard for all table section headers
- `Skeleton` component (`apps/web/src/components/ui/skeleton.tsx`) is the single standard for all placeholder shapes
- All skeleton animations respect `prefers-reduced-motion` (via existing CSS in motion.css)
- Loading states use `aria-busy="true"` and `aria-live="polite"` for accessibility
