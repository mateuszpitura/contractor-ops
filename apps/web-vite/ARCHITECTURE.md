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
