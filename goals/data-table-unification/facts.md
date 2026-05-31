# Facts — data-table-unification

Scope: `apps/web-vite` + `packages/ui` only. `apps/landing` and `apps/cms` are explicitly out of scope.

## Primitive identity

- A single canonical `DataTable` component exists at `packages/ui/src/components/workbench/data-table/data-table.tsx`.
- `DataTable` is the only TanStack-React-Table wrapper imported anywhere in `apps/web-vite`. No file in `apps/web-vite/src/` imports `useReactTable` directly except the primitive itself.
- The shadcn `<Table>` / `<TableHeader>` / `<TableBody>` / `<TableRow>` / `<TableCell>` primitives from `@contractor-ops/ui/components/shadcn/table` are only imported inside `packages/ui/src/components/workbench/data-table/` and inside Storybook stories. Any other usage fails the lint check.
- Companion files live alongside `data-table.tsx` in the same folder: `data-table-body.tsx`, `data-table-pagination.tsx`, `data-table-toolbar.tsx`, `data-table-bulk-actions.tsx`, `data-table-column-toggle.tsx`, `sortable-table-head.tsx`, `skeleton-row.tsx`, `empty-state-row.tsx`, `no-results-row.tsx`, `index.ts`.
- All four current locations of canonical building blocks (`apps/web-vite/src/components/shared/{simple-data-table,data-table-body,data-table-pagination,sortable-table-head,bulk-actions-slot}.tsx`) are deleted after migration. `apps/web-vite/src/components/shared/page-table-skeleton.tsx` is deleted; Suspense fallbacks render `<DataTable isLoading />` instead.
- The primitive uses `useUITranslations` from `packages/ui/src/i18n/translations-provider` for pagination labels (`pagination.rowsPerPage`, `pagination.page`, `aria.previousPage`, `aria.nextPage`, `aria.sort`). No caller passes raw translated strings for these fields.
- The primitive RTL-renders correctly under `dir="rtl"` (ar / ar-SA): pagination footer remains right-aligned via logical properties (`ms-auto`), sort chevrons mirror, prev/next buttons swap chevron direction. Verified manually in ar.

## Pagination

- Every `DataTable` instance renders the pagination footer.
- The footer auto-hides only when `totalRows <= pageSizeOptions[0]` (default: hides when `totalRows <= 10`).
- The page-size selector options are `[10, 25, 50, 100]`. The default page size is `25`.
- Pagination is server-side by default: caller passes `pageIndex`, `pageSize`, `totalRows`, `onPageChange`, `onPageSizeChange`. The primitive does not install `getPaginationRowModel` unless caller opts into client mode with `clientPagination`.
- The pagination footer DOM is identical across every table (rows-per-page select on the left of the right-cluster, `Page X of Y` label, prev/next icon buttons, all right-aligned).

## Sorting

- Sorting is always server-side. The primitive does not install `getSortedRowModel`.
- Caller passes `sorting: SortingState` (single-column) and `onSortingChange: OnChangeFn<SortingState>`. The primitive forwards these into `useReactTable` and into the sortable header buttons.
- Every tRPC list procedure consumed by a migrated table accepts a Zod-validated `orderBy: { field: <enum>; direction: 'asc' | 'desc' }` input.
- Settings sub-tables (members, audit log, api keys, projects, teams, cost centers, workflow roles, reminder rules, approval chains, slack mapping, e-invoicing cards) gain server-side sort: their tRPC procs are updated to accept `orderBy`.

## Loading lockout

- When `isLoading || isRefetching` is true, the primitive disables every filter control and every bulk action button it owns.
- The primitive exposes `loading: boolean` via context (`DataTableLoadingContext`) so the consumer-rendered toolbar (passed via `toolbar` prop) can disable its own filter inputs without per-domain prop drilling.
- Bulk action buttons rendered through the `bulkActions` API are disabled while `isLoading || isRefetching` is true.

## Skeletons

- While loading, the primitive renders skeleton rows inside the table body. The count defaults to `skeletonRows={8}` for first-class lists, `{6}` for sub-tables, configurable per call.
- Skeleton cells use column-shape-aware shapes via `meta.skeleton` on each `ColumnDef`. Supported shapes: `text` (default), `badge`, `avatar`, `actions`, `checkbox`. `text` accepts an optional `width` Tailwind class.
- The Suspense fallback for any table page renders `<DataTable isLoading data={[]} columns={columns} ... />`. The standalone `PageTableSkeleton` component is removed.
- A separate `forceLoading` prop keeps the skeleton state while a parallel count query is still in flight, preventing an empty-state flash.

## Empty + no-results states

- Empty (zero rows, no filters/search active) is two-tier:
  - First-class lists (Contractors, Contracts, Invoices, Approvals, Equipment, Workflows, Payments, Time Tracking, Reports landing pages) render a full `AtelierEmptyState` page panel with a domain illustration (`ContractorsIllustration`, `ContractsIllustration`, etc.) and a primary CTA when one applies.
  - Sub-tables and dialog-embedded tables render the compact in-table empty (icon + title + optional description + optional CTA) inside the table viewport.
- No-results (zero rows, but a search query or filter is active) always renders the compact in-table no-results state (`NoResultsIllustration` + title + description + "Clear filters" CTA), regardless of tier. The full empty illustration is never shown when filters are active.
- The "Clear filters" CTA in the no-results row triggers the same callback as the chrome's clear-filters chip (`onClearFilters`). When `onClearFilters` is undefined, the CTA is hidden.

## Bulk actions

- The primitive owns row selection state. Caller does not manage `rowSelection` unless they opt out of bulk actions entirely.
- Bulk actions are declared via `bulkActions={[{ id, icon, label, onRun, variant?, confirm? }]}` — an array of action descriptors. The primitive renders the action bar (count badge + buttons) above the toolbar with consistent layout and disabled-while-loading rule.
- Selecting at least one row reveals the bulk action bar. Selecting zero rows hides it. Selection clears when filters or pagination change.
- The bulk action bar exposes a "Clear selection" affordance.

## URL state

- Pagination, sorting, search query, and filter values are URL-synced by default via TanStack Router `useSearch` / `useNavigate`. The search-param schema is owned by the primitive and validated with Zod.
- Default query string keys: `page`, `size`, `sort`, `q`, `f[<filterId>]`. Refreshing the page or sharing the URL restores the table state exactly.
- Sub-tables opt out with `urlState={false}` (audit-log, members, api-keys, projects, teams, cost-centers, workflow-roles, reminder-rules, approval-chains, slack-mapping, e-invoicing card lists). These keep state in memory.
- URL-synced tables debounce search-query writes to URL by 250 ms to avoid history spam.

## Column visibility

- Column visibility is not owned by the primitive. Domains that need column toggling pass a `<DataTableColumnToggle />` (or equivalent) into the `rightSlot` prop of the chrome.
- The primitive exposes the TanStack `table` instance via a render-prop overload (`rightSlot: (table) => ReactNode`) so the per-domain toggle reads visibility state from the same table instance.

## Per-domain layout

- Every per-domain table lives at `apps/web-vite/src/components/{domain}/{table}/data-table.tsx` with siblings `columns.tsx`, `toolbar.tsx`, `bulk-actions.tsx`, `filters.tsx` (when applicable).
- Existing `*-table.tsx` outliers are renamed and moved into a sub-folder:
  - `settings/audit-log-table.tsx` → `settings/audit-log/data-table.tsx`
  - `settings/users-table.tsx` (+ `users-table-container.tsx`) → `settings/members/data-table.tsx` (+ `container.tsx`)
  - `settings/workflow-roles/workflow-roles-table.tsx` → `settings/workflow-roles/data-table.tsx`
  - `zatca/zatca-invoice-chain-table.tsx` → `zatca/invoice-chain/data-table.tsx`
  - `organization/projects/project-table.tsx` → `organization/projects/data-table.tsx`
  - `organization/teams/team-table.tsx` → `organization/teams/data-table.tsx`
  - `organization/cost-centers/cost-center-table.tsx` → `organization/cost-centers/data-table.tsx`
  - `workflows/templates-table.tsx` → `workflows/templates/data-table.tsx`
  - `time/approval-queue-table.tsx` → `time/approval-queue/data-table.tsx`
  - `time/reconciliation-table.tsx` → `time/reconciliation/data-table.tsx`
  - `legal/sub-processors-table.tsx` → `legal/sub-processors/data-table.tsx`
  - `admin/boe-rate/boe-rate-table.tsx` → `admin/boe-rate/data-table.tsx`
  - `reports/report-table.tsx` + every `reports/*-report.tsx` table → `reports/{slug}/data-table.tsx`
  - `ocr/line-items-table.tsx` → `ocr/line-items/data-table.tsx`
  - `integrations/google-workspace/directory-preview-table.tsx` → `integrations/google-workspace/directory-preview/data-table.tsx`
  - `import/step-preview.tsx` (table portion) → `import/step-preview/data-table.tsx`
  - `settings/slack-user-mapping.tsx` (table portion) → `settings/slack-mapping/data-table.tsx`
  - `payments/payment-run-table/data-table.tsx` stays (already conformant).
  - `payments/invoice-selection-table/data-table.tsx` stays.
  - `payments/new-payment-run-dialog/step-select.tsx` (table portion) → `payments/new-payment-run/step-select/data-table.tsx`
- Existing `apps/web-vite/src/components/{domain}/data-table/`-style domains stay in place: `contractors/contractor-table/`, `contracts/contract-table/`, `invoices/invoice-table/`, `approvals/approval-queue/`, `equipment/equipment-table/`, `workflows/workflow-runs-table/`. Each is refactored to wrap canonical `DataTable` (no local TanStack wiring).
- After migration, no source file under `apps/web-vite/src/` matches the glob `**/*-table.tsx`. Every table file is named `data-table.tsx` inside a dedicated folder.

## Migration scope (every entry below uses canonical `DataTable`)

- First-class list pages: Contractors, Contracts, Invoices, Approvals, Equipment, Workflows (runs + templates), Payments (runs + invoice selection), Time Tracking (approval queue + reconciliation), Reports (all sub-pages).
- Settings sub-tables: Members, API Keys, Audit Log, Approval Chains, Reminder Rules, Workflow Roles, Slack User Mapping, KSeF Sync History, E-invoicing Transmissions Log, Leitweg-ID list, Peppol Participant.
- Organization configs: Projects, Teams, Cost Centers.
- Admin: BoE Rate.
- Domain dialogs / wizards: OCR Line Items, Google Workspace Directory Preview, Import Step Preview, New Payment Run Step Select, Zatca Invoice Chain.
- Legal: Sub-processors.
- Out of scope: `apps/landing` static marketing tables, `apps/cms` Payload-auto-generated admin lists.

## Density toggle

- The density toggle (currently `DensityToggle` in `packages/ui/workbench`) renders on first-class list tables only. Sub-tables and dialog-embedded tables pass `hideDensityToggle` and render compact density only.

## Quality gates (done condition)

- Every table file (`data-table.tsx`) in `apps/web-vite/src/` imports from `@contractor-ops/ui/.../workbench/data-table` and does not import `useReactTable` directly.
- A `pnpm check:web-vite-tables` script runs in CI and exits non-zero when:
  - any file outside the canonical primitive imports `useReactTable`;
  - any file outside the canonical primitive imports raw `Table`/`TableBody`/`TableRow`/`TableCell` from `@contractor-ops/ui/components/shadcn/table`;
  - any file under `apps/web-vite/src/` matches `**/*-table.tsx` (forces folder + `data-table.tsx` convention).
- `pnpm typecheck` is green.
- `pnpm test` (vitest) is green. Per-table unit tests (selection, sort, pagination footer rendering, empty vs no-results branching, RTL pagination layout) live next to the canonical primitive in `packages/ui/src/components/workbench/data-table/__tests__/`.
- Manual smoke pass in `apps/web-vite` browser session covers: first-class list (Contractors), sub-table (Audit Log), dialog-embedded (Invoice Selection), RTL render (ar locale on Contracts).
