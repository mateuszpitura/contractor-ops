# web-vite UI Architecture

Section-level **containers + domain hooks** — single tRPC boundary per UI section.

## Layers

| Layer | Location | Responsibility | tRPC / React Query |
|-------|----------|----------------|---------------------|
| **Page** | `src/pages/**` | Thin route shell: Suspense + compose `*Container` only | **Forbidden** |
| **Container** | `src/components/{domain}/*-container.tsx` | **Decide**: call domain hook(s); branch on permissions/flags/route params; pick which view to render; own Suspense + section fallback; redirect via `<Navigate />`. **Not a passthrough.** | **Forbidden** (use hooks) |
| **Hook** | `src/components/{domain}/hooks/use-*.ts` | Queries, mutations, derived state, invalidation, toasts | **Required boundary** |
| **Component** | `src/components/{domain}/**` | Presentational UI; local UI state only | **Forbidden** |
| **Shared hook** | `src/hooks/**` | Cross-cutting: permissions, `useResourceMutation` | Allowed |
| **Pure** | `actions.ts`, `use-*-filters.ts` (nuqs) | Metadata / URL state | No React Query |

## Data flow

```
Page → Container → Hook (tRPC)
              ↘ Component (props)
```

### Example — contractors list

```tsx
// pages/dashboard/contractors.tsx
export default function ContractorsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ContractorListContainer />
    </Suspense>
  );
}

// components/contractors/contractor-list-container.tsx
export function ContractorListContainer() {
  const list = useContractorList();
  if (list.showEmptyState) return <ContractorEmptyState {...list.emptyProps} />;
  return (
    <>
      <ContractorTableToolbar {...list.toolbarProps} />
      <ContractorDataTable {...list.tableProps} />
      {/* side panel, wizards */}
    </>
  );
}

// components/contractors/hooks/use-contractor-list.ts
export function useContractorList() {
  const trpc = useTRPC();
  // count + list queries, filters, toolbar options, bulk handlers
  return { showEmptyState, toolbarProps, tableProps, ... };
}
```

## Folder convention

```
components/contractors/
  hooks/
    use-contractor-list.ts
    use-contractor-detail.ts
  contractor-list-container.tsx
  contractor-table/
    data-table.tsx       # presentational
    data-table-toolbar.tsx
    columns.tsx
    use-contractor-filters.ts  # nuqs URL only
  actions.ts             # pure registry
```

## Container responsibility — the decision rule

A container **must decide something**. If it only calls one hook and spreads the result into a view, it is dead weight — push the decision in, or merge the section.

A container earns its file when it does **at least one** of:

1. **Permission gate** — `usePermissions()` / `useFlag()` → render variant, `<Navigate to="/forbidden" />`, or null.
2. **Variant pick** — branch on hook flags: `if (showEmptyState) return <Empty/>; if (isError) return <Error/>; return <DataView/>`. Variant choice lives in container, **not** inside a single view that toggles.
3. **Suspense + section skeleton** — wrap children in `<Suspense fallback={<SectionSkeleton/>}>`. Skeleton is section-shaped (rows, cards), not `PageLoadingSpinner`.
4. **Redirect / route effect** — `useNavigate()` + side-effect, `<Navigate replace />`, or route-param resolution into entity-id forwarded to subviews.
5. **Composition** — orchestrates 2+ sub-containers / 2+ views into a screen (`<TabsContainer/>` + `<TableContainer/>` + `<SidePanelContainer/>`).
6. **Side-effect setup** — Sentry breadcrumbs, analytics on mount, toast bridge, dialog state owner that spans multiple presentational siblings.

### Anti-pattern — passthrough container

```tsx
// BAD — adds nothing
export function FooContainer() {
  const foo = useFoo();
  return <FooView {...foo} />;
}
```

If this is all your container does, one of these is wrong:
- Hook returns raw data, not props-bag flags → push the variant decision (loading/empty/error/success) into the container.
- View internally branches on `isLoading`/`isError` → lift that branch into the container; view becomes a single render path per variant.
- Section truly has no decisions → collapse the section. Either merge it into the parent container, or expose the view directly from a peer container that already decides for the section group.

### Decisive container — reference shape

```tsx
export function ContractorListContainer() {
  const list = useContractorList();
  if (list.isForbidden) return <Navigate to="/forbidden" replace />;
  if (list.isLoading) return <ContractorListSkeleton />;
  if (list.isError) return <ContractorListError onRetry={list.onRetry} />;
  if (list.isEmpty) return <ContractorEmptyState {...list.emptyProps} />;
  return (
    <>
      <ContractorTableToolbar {...list.toolbarProps} />
      <ContractorDataTable {...list.tableProps} />
      {list.sidePanelOpen ? <ContractorSidePanel {...list.sidePanelProps} /> : null}
    </>
  );
}
```

Every line in the container body is a **decision**. The view files are pure props-in → JSX-out.

## Multi-section pages

Page composes **one container per section/tab**:

```tsx
<ContractorDetailShellContainer contractorId={id} />
<ContractorOverviewContainer contractorId={id} />
<ContractorInvoicesContainer contractorId={id} />
```

Shared entity queries: extract `use-contractor-query.ts` helper; React Query dedupes by key.

## Hook return shape

Return **props bags + flags**, not raw query objects:

```ts
return {
  isLoading,
  showEmptyState,
  toolbarProps: { users, search, onSearchChange, ... },
  tableProps: { data, totalRows, onPageChange, ... },
  bulkActionsProps: { onBulkArchive, isArchiving, users, ... },
} as const;
```

## Porting workflow (Step 10)

1. Lift presentational JSX from `apps/web`
2. **Write domain hook(s) + container(s) first**
3. Page composes containers only
4. Run `pnpm --filter @contractor-ops/web-vite check:data-layer` and `check:page-shells`

## Page shells (all routes)

**Every** page under `src/pages/**` — dashboard, portal, auth, legal, admin — must be a thin shell:

- Compose one or more `*Container` components only (plus optional `Suspense` + `PageLoadingSpinner`).
- **No** presentational imports from `components/**` (forms, layouts, tables, UI primitives).
- **No** route logic in the page: `useTranslations`, `useParams`, `useSearchParams`, `usePermissions`, `useFlag`, or `<Navigate />` belong in containers.

Allowed page imports from paths containing `/components/`:

- `*-container` modules (case-sensitive suffix)
- `page-loading-spinner` (Suspense fallback only)

## Anti-patterns

- `useTRPC` inside `data-table.tsx`, toolbars, tabs, dialogs
- Page with inline `useQuery` instead of container
- Page importing `RegisterForm`, `AuthLayout`, or shadcn buttons instead of a container
- Same screen fetching from page + table + toolbar (duplicate boundaries)
- **Passthrough container** — `const x = useFoo(); return <FooView {...x} />`. Container must decide (permission gate, variant pick, Suspense + section fallback, redirect, composition, or side-effect setup). If it cannot, the section is mis-grained — collapse it or push decision logic in. See [Container responsibility](#container-responsibility--the-decision-rule).
- View internally branching on `isLoading`/`isError`/`isEmpty` — the branch belongs in the container, view stays single-render-path per variant.
- Raw `<Table>` / `<TableBody>` / `<TableHead>` from `@contractor-ops/ui/components/shadcn/table` outside the canonical `DataTable` primitive — every web-vite table goes through the workbench `DataTable` (see [Canonical `DataTable`](#canonical-datatable)). The lint gate `pnpm check:web-vite-table-pattern` enforces this.
- `useReactTable` imported directly from `@tanstack/react-table` in app code — the canonical `DataTable` owns the TanStack instance. Pass `columns`, `data`, controlled selection, sorting, and visibility through props instead.
- `*-table.tsx` filenames — every table file is `data-table.tsx` inside a dedicated folder (`<name>/data-table.tsx`).

## Canonical `DataTable`

The single workbench table primitive lives at `packages/ui/src/components/workbench/data-table/` and is re-exported from `@contractor-ops/ui`. Every list, sub-table, dialog/wizard step, and reporting grid in `apps/web-vite` composes this component — no app-side `<Table>` rendering, no app-side `useReactTable`. It wraps `AtelierTableShell` with chrome + sortable headers + body + pagination + bulk-action bar and owns the TanStack table instance internally.

```tsx
import { DataTable } from '@contractor-ops/ui';

<DataTable
  columns={columns}
  data={rows}
  totalRows={totalCount}
  pageIndex={pageIndex}
  pageSize={pageSize}
  onPageChange={setPageIndex}
  onPageSizeChange={setPageSize}
  sorting={sorting}
  onSortingChange={setSorting}
  entityLabel={t('entityLabel', { count: totalCount })}
  emptyTitle={t('empty.heading')}
  noResultsTitle={t('noResults.heading')}
/>
```

### Modes

- **Server pagination + sorting (default).** Caller passes `pageIndex` / `pageSize` / `totalRows` / `onPageChange` / `onPageSizeChange` and optionally `sorting` / `onSortingChange`. Data is assumed pre-paginated and pre-sorted by the server. Use for first-class list pages (contractors, contracts, invoices, payments, approvals, time, audit log).
- **Client pagination.** Pass `clientPagination`. The primitive installs `getPaginationRowModel` and slices `data` locally; `totalRows` defaults to `data.length` for footer auto-hide math. Use when the dataset is already loaded fully (sub-tabs, embedded breakdowns, wizard steps).

### Row selection

- **Bulk-action bar (built-in).** Pass `bulkActions` — the primitive enables row selection automatically and renders the selection bar above the table.
- **Custom bar / parent-owned selection.** Use `enableRowSelection` + controlled `rowSelection` / `onRowSelectionChange` to drive selection from a parent (cross-component select-all-matching, parent-owned IDs in a wizard).
- **Selection callback.** Pass `onSelectionChange` to receive the selected row originals whenever selection changes (also fires for controlled mode).
- **Per-row predicate.** Pass `isRowSelectable` to disable selection of rows already part of another set (e.g. invoices already attached to a payment run).

### Expandable rows

- Pass `renderSubRow={(row) => <SubView />}` plus `expandedRowIds` (controlled) and `getRowId` to render a sub-row immediately after each expanded row. `getRowId` must be stable across pagination.

### Column visibility

- Pass controlled `columnVisibility` + `onColumnVisibilityChange` and a `rightSlot` render-prop (`(table) => <ColumnToggle table={table} />`) to expose a column visibility dropdown in the chrome.

### Sub-tables (dialogs, wizards, breakdowns)

For embedded tables that already live inside a `Card` / `Dialog` / `Sheet` with its own header context, opt out of the workbench chrome and footer:

- `hideChrome` — drop the count + entity label + clear-filters chip + density toggle strip.
- `hideFooter` — drop the pagination footer entirely (caller owns "Load more" or none).
- `hideDensityToggle` — keep chrome but hide the comfortable/compact toggle.
- `constrainHeight={false}` — let the table grow with its content instead of locking to the viewport.
- `fill` — pass-through to `AtelierTableShell.fill` for full-bleed sections.

Two-tier empty state: pass `emptyIllustration={IconComponent}` to render the full `AtelierEmptyState variant="page"` panel for zero-row first-class lists. Sub-tables omit the prop and fall back to the compact in-table empty row.

## CI

```bash
pnpm --filter @contractor-ops/web-vite check:data-layer
pnpm --filter @contractor-ops/web-vite check:page-shells
pnpm check:web-vite-presentational
# root lint:ci runs data-layer + page-shells + presentational (see root package.json)
```

- **check:data-layer** — fails when `useTRPC`, `useQuery`, or `useMutation` appear outside allowed paths.
- **check:page-shells** — fails when a page imports non-container components or uses forbidden hooks/navigation.
- **check:web-vite-presentational** — fails when non-container `.tsx` under `src/components/**` (excluding `hooks/` and feature-flag helpers) imports or calls `useTRPC` from `trpc-provider`, or uses `useQuery` / `useMutation` / `useSuspenseQuery` / `useQueryClient` from `@tanstack/react-query` at runtime (`import type` from react-query is allowed). Keeps dialogs and leaf UI props-only relative to React Query.

## Reference implementation

See [`components/contractors/contractor-list-container.tsx`](src/components/contractors/contractor-list-container.tsx) and [`hooks/use-contractor-list.ts`](src/components/contractors/hooks/use-contractor-list.ts).
