# web-vite UI Architecture

Section-level **domain hooks + wired sections** — single tRPC/React Query boundary per UI section. There are **no** `*-container.tsx` files; orchestration lives in co-located wired exports or `*PageContent` in route files.

## Layers

| Layer | Location | Responsibility | tRPC / React Query |
|-------|----------|----------------|---------------------|
| **Page** | `src/pages/**` | Route shell: `Suspense` + `*PageContent` or a single wired root | **Forbidden** (direct) |
| **Page content** | `*PageContent` in `pages/**` | Route-level orchestration: domain hooks, i18n, params, flags, compose wired sections | **Forbidden** (direct) — call hooks |
| **Wired section** | `src/components/{domain}/*.tsx` | Call domain hook(s); branch loading/empty/error/forbidden; compose presentational views | **Forbidden** (direct) — call hooks |
| **Hook** | `src/components/{domain}/hooks/use-*.ts` | Queries, mutations, derived state, invalidation, toasts | **Required boundary** |
| **View / presentational** | `*View` or props-only `*.tsx` | UI only; local UI state | **Forbidden** |
| **Shared hook** | `src/hooks/**` | Cross-cutting: permissions, `useResourceMutation` | Allowed |
| **Pure** | `actions.ts`, `use-*-filters.ts` (nuqs) | Metadata / URL state | No React Query |

## Data flow

```
Page → PageContent or Wired section → Hook (tRPC)
                              ↘ View (props)
```

## Wired + View convention

Co-locate presentational and wired exports in the same module (or inline `*PageContent` on heavy route screens):

```tsx
export function ContractorListView(props: ContractorListViewProps) {
  return (/* toolbar + table + panels — props only */);
}

export function ContractorList() {
  const list = useContractorList();
  if (list.isForbidden) return <Navigate to="/forbidden" replace />;
  if (list.isLoading) return <ContractorListSkeleton />;
  if (list.isEmpty) return <ContractorEmptyState {...list.emptyProps} />;
  return <ContractorListView {...list} />;
}
```

### Export names (canonical)

| Role | Name | Example |
|------|------|---------|
| Presentational | `{Section}View` | `ContractorListView` |
| Wired section | `{Section}` | `ContractorList` |
| Route orchestrator | `{Screen}PageContent` | `PaymentsPageContent` |
| Legacy wired | `{Section}Container` | deprecated alias → `{Section}` |
| Legacy wired | `{Section}Wired` | deprecated alias → `{Section}` when presentational is `{Section}View` |

New code: `FooView` + `Foo`. Do not add new `*Container` or `*Wired` exports. Legacy names stay as re-exports until call sites migrate:

```tsx
export function ContractorList() { /* wired */ }
/** @deprecated Use ContractorList */
export { ContractorList as ContractorListContainer };
```

### Example — thin page + wired section

```tsx
// pages/dashboard/contractors.tsx
export default function ContractorsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ContractorList />
    </Suspense>
  );
}
```

### Example — inlined page content

Large list screens may keep orchestration in the page file:

```tsx
// pages/dashboard/payments.tsx
function PaymentsPageContent() {
  const t = useTranslations('Payments');
  const list = usePaymentsList({ /* callbacks */ });
  if (list.isLoading) return <PaymentsSkeleton />;
  return (/* header + toolbar + table + dialogs */);
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PaymentsPageContent />
    </Suspense>
  );
}
```

`PaymentsPageContent` may use `useTranslations`, `useParams`, `usePermissions`, `useFlag`, and `<Navigate />`. It must **not** call `useTRPC` / `useQuery` / `useMutation` directly.

## Folder convention

```
components/contractors/
  hooks/
    use-contractor-list.ts
    use-contractor-detail.ts
  contractor-list.tsx      # View + wired export
  contractor-table/
    data-table.tsx         # presentational
    data-table-toolbar.tsx
    columns.tsx
    use-contractor-filters.ts  # nuqs URL only
  actions.ts               # pure registry

pages/dashboard/
  contractors.tsx          # Suspense + <ContractorList />
  payments.tsx             # Suspense + PaymentsPageContent (inlined)
```

## Wired section responsibility

A wired section (or `*PageContent`) **decides** what to render. Every branch is explicit:

1. **Permission gate** — `usePermissions()` / `useFlag()` → variant, `<Navigate />`, or null.
2. **Variant pick** — loading / empty / error / success each map to a distinct subtree.
3. **Suspense + section skeleton** — section-shaped fallbacks, not page spinners inside deep trees.
4. **Redirect / route effect** — `useNavigate()`, `<Navigate replace />`, route-param side effects.
5. **Composition** — multiple views, dialogs, side panels, tabs on one screen.
6. **Local UI state** — selection, dialog open, wizard step (when not owned by the hook).

### Anti-pattern — passthrough with no decisions

```tsx
// BAD — hook returns everything; wired layer adds nothing
export function Foo() {
  const foo = useFoo();
  return <FooView {...foo} />;
}
```

Fix: push variant flags into the hook return shape, or collapse into parent `*PageContent` if the section has no independent decisions.

### Anti-pattern — data boundary in view

```tsx
// BAD
export function FooView() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.foo.list.queryOptions());
}
```

Views stay props-in → JSX-out. Fetch in `hooks/use-foo.ts`.

## Multi-section pages

`PageContent` composes wired sections or presentational blocks:

```tsx
function ContractorDetailPageContent({ contractorId }: { contractorId: string }) {
  return (
    <>
      <ContractorDetailHeader contractorId={contractorId} />
      <ContractorOverview contractorId={contractorId} />
      <ContractorInvoices contractorId={contractorId} />
    </>
  );
}
```

Shared entity queries: extract `use-contractor-query.ts`; React Query dedupes by key.

## Hook return shape

Return **props bags + flags**, not raw query objects:

```ts
return {
  isLoading,
  isEmpty,
  toolbarProps: { search, onSearchChange, ... },
  tableProps: { data, totalRows, onPageChange, ... },
} as const;
```

## Porting workflow

1. Lift presentational JSX from `apps/web`
2. **Write domain hook(s) first**
3. Add `*View` + wired export (or `*PageContent` on the route)
4. Page default export: `Suspense` + content
5. Run `pnpm check:web-vite-data-layer` and `pnpm check:web-vite-page-shells`

## Page rules

| Allowed in `pages/**` | Forbidden in `pages/**` |
|-----------------------|-------------------------|
| `Suspense`, `PageLoadingSpinner` | `useTRPC()`, `useQuery()`, `useMutation()` |
| Imports from `components/**`, `@contractor-ops/ui` | Direct runtime imports from `trpc-provider` / `@tanstack/react-query` |
| `useTranslations`, `useParams`, `useSearchParams` | |
| `usePermissions`, `useFlag`, `<Navigate />` | |
| Domain hooks from `components/**/hooks/` | |

## Anti-patterns

- `useTRPC` inside `data-table.tsx`, toolbars, tabs, dialogs, or pages
- Same screen fetching from page + table + toolbar (duplicate boundaries)
- View internally branching on `isLoading`/`isError` when wired layer should own variants
- Raw `<Table>` from shadcn outside workbench `DataTable` — see [Canonical `DataTable`](#canonical-datatable)
- `useReactTable` from `@tanstack/react-table` in app code — use `DataTable` props
- `*-table.tsx` filenames — use `<name>/data-table.tsx`

## Canonical `DataTable`

The workbench table primitive lives at `packages/ui/src/components/workbench/data-table/` and is re-exported from `@contractor-ops/ui`. Every list, sub-table, dialog step, and reporting grid composes this component.

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

- **Server pagination + sorting (default).** Caller passes `pageIndex` / `pageSize` / `totalRows` / `onPageChange` / `onPageSizeChange` and optionally `sorting` / `onSortingChange`. Use for first-class list pages.
- **Client pagination.** Pass `clientPagination` when the full dataset is already loaded (sub-tabs, wizard steps).

### Row selection

- **Bulk-action bar.** Pass `bulkActions` — primitive enables selection and renders the bar.
- **Parent-owned selection.** `enableRowSelection` + controlled `rowSelection` / `onRowSelectionChange`.
- **Per-row predicate.** `isRowSelectable` for rows already attached elsewhere.

### Expandable rows

`renderSubRow`, `expandedRowIds`, stable `getRowId` across pagination.

### Sub-tables

`hideChrome`, `hideFooter`, `hideDensityToggle`, `constrainHeight={false}`, `fill` for embedded tables inside cards/dialogs.

## CI

```bash
pnpm check:web-vite-data-layer
pnpm check:web-vite-page-shells
pnpm check:web-vite-presentational
# root lint:ci runs all three (see root package.json)
```

- **check:web-vite-data-layer** — `useTRPC` / `useQuery` / `useMutation` / `useInfiniteQuery` / `useSuspenseQuery` only under `hooks/` (and providers).
- **check:web-vite-page-shells** — same forbidden calls under `pages/**` only (pages must not be a second data boundary).
- **check:web-vite-presentational** — non-hook `components/**/*.tsx` must not call tRPC or React Query at runtime.

## Reference implementation

- Wired list: [`components/contractors/contractor-list.tsx`](src/components/contractors/contractor-list.tsx)
- Hook: [`components/contractors/hooks/use-contractor-list.ts`](src/components/contractors/hooks/use-contractor-list.ts)
- Inlined route: [`pages/dashboard/payments.tsx`](src/pages/dashboard/payments.tsx)
- Thin route: [`pages/dashboard/contractors.tsx`](src/pages/dashboard/contractors.tsx)
