# Plan — data-table-unification

## Solution approach (brief)

Build the canonical `DataTable` primitive inside `packages/ui/src/components/workbench/data-table/` by promoting and consolidating the existing fragments (`apps/web-vite/src/components/shared/{simple-data-table,data-table-body,data-table-pagination,sortable-table-head,bulk-actions-slot,row-click,page-table-skeleton}.tsx`) into a single primitive package. Wire pagination strings through the existing `useUITranslations` provider and extend `DEFAULT_LABELS` + every locale (`apps/web-vite/src/i18n/locales/{en,en-GB,de,pl,ar,ar-SA}.json`) with the new `pagination.*` + `aria.*` keys. Add URL syncing on top of `nuqs` (already used in 17 places in web-vite — `react-router-dom@7` is the underlying router; `nuqs` works router-agnostically). Add built-in bulk actions API and selection state ownership.

Migrate per domain in waves grouped by structural similarity, smallest blast radius first: settings sub-tables (URL-state opt-out, simplest hooks) → organization configs → admin / legal / OCR / wizards → first-class lists (largest surface, server-side everything wired). Each migration deletes the old `*-table.tsx` (or renames `*/data-table.tsx`) and rewrites the container to pass the canonical primitive's prop shape. Each migration adds an `orderBy` Zod input to the backing tRPC procedure when sort wasn't previously server-side.

Upgrade `scripts/check-web-vite-table-pattern.mjs` in-place to drop the entire whitelist and instead enforce: (a) no `useReactTable` outside the primitive folder; (b) no shadcn `Table`/`TableBody`/`TableRow`/`TableCell` import outside the primitive folder or its `__tests__`; (c) no file path matching `**/*-table.tsx` under `apps/web-vite/src/`. Keep the script wired into `pnpm lint:ci`. Run typecheck + tests + manual smoke + a11y RTL check before declaring done.

## Ordered steps

### Step 1 — Build canonical `DataTable` in `packages/ui/workbench/data-table/`

Files / systems touched:
- create `packages/ui/src/components/workbench/data-table/{data-table,data-table-body,data-table-pagination,data-table-toolbar,data-table-bulk-actions,sortable-table-head,skeleton-row,empty-state-row,no-results-row,row-click,types,use-data-table,index}.{ts,tsx}`
- create `packages/ui/src/components/workbench/data-table/__tests__/{data-table.test,pagination.test,selection.test,sort.test,empty-states.test,rtl.test}.tsx`
- edit `packages/ui/src/components/workbench/index.ts` — re-export `./data-table/index.js`
- edit `packages/ui/src/i18n/translations-provider.tsx` — add `pagination.rowsPerPage`, `pagination.page`, `aria.previousPage`, `aria.nextPage`, `aria.sort`, `aria.toggleSelectAll`, `aria.toggleSelectRow`, `aria.clearFilters`, `aria.bulkActions`, `aria.clearSelection`, `dataTable.noResultsTitle`, `dataTable.noResultsDescription` keys to `DEFAULT_LABELS`
- edit `apps/web-vite/src/i18n/locales/{en,en-GB,de,pl,ar,ar-SA}.json` — add matching `Common.pagination.*` + `Common.aria.*` + `Common.dataTable.*` keys
- edit `apps/landing/src/i18n/locales/*.json` — only if landing has a `UITranslationsProvider` host; skip if not

Public API surface (final):
```ts
interface DataTableProps<TData, TFilters = unknown> {
  // Required
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  totalRows: number;
  entityLabel: string;
  emptyTitle: string;
  noResultsTitle: string;

  // Loading
  isLoading?: boolean;
  isRefetching?: boolean;
  forceLoading?: boolean;
  skeletonRows?: number;

  // Pagination (server-side default; pass clientPagination for client mode)
  pageIndex: number;
  pageSize: number;
  pageSizeOptions?: number[]; // default [10, 25, 50, 100]
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  clientPagination?: boolean; // installs getPaginationRowModel locally

  // Sorting (server-side only — caller owns SortingState)
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;

  // URL state (default true; sub-tables pass false)
  urlState?: boolean;
  urlStateNamespace?: string; // when 2 tables on the same page

  // Filters
  hasFiltersOrSearch?: boolean;
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  toolbar?: ReactNode | ((ctx: { disabled: boolean }) => ReactNode);

  // Empty (two-tier)
  emptyDescription?: string;
  emptyCta?: string;
  onEmptyCta?: () => void;
  emptyCtaIcon?: ComponentType<{ className?: string }>;
  emptyIcon?: ReactNode;
  emptyIllustration?: ComponentType<{ className?: string }>; // first-class lists only

  // No results
  noResultsDescription?: string;
  noResultsCta?: string;

  // Row interaction
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string;

  // Bulk actions
  bulkActions?: Array<{
    id: string;
    icon: ComponentType<{ className?: string }>;
    label: string;
    onRun: (selected: TData[]) => void | Promise<void>;
    variant?: 'default' | 'destructive';
    confirm?: { title: string; description: string; confirmLabel: string };
  }>;

  // Chrome
  rightSlot?: ReactNode | ((table: Table<TData>) => ReactNode);
  hideDensityToggle?: boolean;
  constrainHeight?: boolean;
  fill?: boolean;

  // Skeleton shape (caller can also pass per-column meta.skeleton)
  skeletonColumns?: Record<string, SkeletonColumnShape>;
}
```

Verification:
- `pnpm --filter @contractor-ops/ui typecheck`
- `pnpm --filter @contractor-ops/ui test` — all new primitive tests green
- visual sanity in Storybook (or scratch route) with mock data of 0 rows, 1 row, 3 rows (footer hidden), 50 rows, in `en` and `ar-SA`

Risk: locale JSON merges across already-modified files (git status shows unstaged changes to all 6 locale files on this branch) — re-order the add-keys edit so it runs against the current branch tree, not main.

### Step 2 — Upgrade `scripts/check-web-vite-table-pattern.mjs`

Files / systems touched:
- edit `scripts/check-web-vite-table-pattern.mjs` — drop `WHITELIST`, drop `SHADCN_TABLE_IMPORT` sentinel logic, replace with:
  - rule A: scan `apps/web-vite/src/**/*.{ts,tsx}` for `useReactTable(` literal → must not appear
  - rule B: scan same tree for shadcn `Table`/`TableBody`/`TableRow`/`TableCell` imports → must not appear
  - rule C: glob `apps/web-vite/src/**/*-table.tsx` → must return zero files
  - all three rules also exclude `__tests__/` test fixtures
- edit `package.json` `lint:ci` script — keep `check:web-vite-table-pattern` invocation
- add a per-step grace mechanism: during waves 4–9, the script accepts `--allow=<glob>` to whitelist not-yet-migrated files; final cleanup PR removes all `--allow` flags

Verification:
- `node scripts/check-web-vite-table-pattern.mjs --allow='**/*'` exits 0 (smoke)
- `node scripts/check-web-vite-table-pattern.mjs` exits non-zero on current main (proves rule actually catches violations)
- final commit of cleanup wave: script exits 0 with no `--allow` flags

Risk: `--allow` flag becomes permanent if cleanup PR is skipped. Mitigate by tagging the cleanup PR title `BREAKING(internal): remove table-pattern --allow flag` and adding it to the wave-9 acceptance.

### Step 3 — Wave 1: Settings sub-tables (URL-state opt-out, server-side sort)

Files / systems touched (tables migrated):
- `apps/web-vite/src/components/settings/audit-log-table.tsx` → `settings/audit-log/data-table.tsx` (+ extract hook to `settings/audit-log/hooks/use-audit-log.ts`)
- `apps/web-vite/src/components/settings/users-table.tsx` + `users-table-container.tsx` → `settings/members/{data-table,container}.tsx`
- `apps/web-vite/src/components/settings/api-keys-tab-container.tsx` table portion → `settings/api-keys/data-table.tsx`
- `apps/web-vite/src/components/settings/approval-chains-tab-container.tsx` table portion → `settings/approval-chains/data-table.tsx`
- `apps/web-vite/src/components/settings/reminder-rules-section-container.tsx` table portion → `settings/reminder-rules/data-table.tsx`
- `apps/web-vite/src/components/settings/workflow-roles/workflow-roles-table.tsx` → `settings/workflow-roles/data-table.tsx`
- `apps/web-vite/src/components/settings/ksef-sync-history-container.tsx` table portion → `settings/ksef-sync/data-table.tsx`
- `apps/web-vite/src/components/settings/slack-user-mapping.tsx` table portion → `settings/slack-mapping/data-table.tsx`
- `apps/web-vite/src/components/settings/e-invoicing/{transmissions-log,leitweg-id-list,peppol-participant}-card-container.tsx` table portions → `settings/e-invoicing/{transmissions-log,leitweg-id-list,peppol-participant}/data-table.tsx`

Backend changes (per migrated table):
- `packages/api/src/routers/.../<router>.ts` — add Zod `orderBy: z.object({ field: z.enum([...]), direction: z.enum(['asc','desc']) }).optional()` to the list procedure input
- update Prisma `orderBy` clause in the handler to consume the input
- existing tests in `packages/api/src/routers/.../__tests__/` updated for new input

Verification per migrated table:
- `pnpm typecheck --filter=@contractor-ops/api --filter=@contractor-ops/web-vite`
- `pnpm test --filter=@contractor-ops/api` for the affected router
- manual: open the settings tab in `apps/web-vite` browser, change sort column, refresh, confirm sort persists via URL? — no, sub-tables opted out of URL state; sort should NOT persist across refresh (matches fact decision)
- `node scripts/check-web-vite-table-pattern.mjs --allow='**/!(settings/**)/*-table.tsx'` exits 0

### Step 4 — Wave 2: Organization config tables

Files / systems touched:
- `apps/web-vite/src/components/organization/projects/project-table.tsx` → `organization/projects/data-table.tsx`
- `apps/web-vite/src/components/organization/teams/team-table.tsx` → `organization/teams/data-table.tsx`
- `apps/web-vite/src/components/organization/cost-centers/cost-center-table.tsx` → `organization/cost-centers/data-table.tsx`
- corresponding `packages/api/src/routers/organization/{project,team,cost-center}.ts` — add `orderBy` Zod input
- `apps/web-vite/src/components/organization/{projects,teams,cost-centers}/hooks/use-*-list.ts` — create if not present, wire sorting state

Verification:
- `pnpm typecheck`
- `pnpm test --filter=@contractor-ops/api`
- manual smoke: organization page, each tab, add/sort/page

### Step 5 — Wave 3: Admin + legal + reports

Files / systems touched:
- `apps/web-vite/src/components/admin/boe-rate/boe-rate-table.tsx` → `admin/boe-rate/data-table.tsx`
- `apps/web-vite/src/components/legal/sub-processors-table.tsx` → `legal/sub-processors/data-table.tsx`
- `apps/web-vite/src/components/reports/report-table.tsx` + `reports/{expiring-contracts,spend-team,spend-contractor,compliance-gaps,overdue-invoices}-report.tsx` → `reports/{slug}/data-table.tsx` (5 sub-folders) + delete shared `report-table.tsx`
- `packages/api/src/routers/admin/boe-rate.ts`, `packages/api/src/routers/reports/*.ts` — add `orderBy` Zod input

Verification:
- `pnpm typecheck`
- `pnpm test`
- manual: each report page renders, sort cycles correctly, RTL on ar-SA does not break column header alignment

### Step 6 — Wave 4: Dialog/wizard-embedded tables

Files / systems touched:
- `apps/web-vite/src/components/ocr/line-items-table.tsx` → `ocr/line-items/data-table.tsx` (note: this is the inline-edit form, not data-display — special-case `clientPagination`, `hideDensityToggle`, no bulk actions)
- `apps/web-vite/src/components/integrations/google-workspace/directory-preview-table.tsx` → `integrations/google-workspace/directory-preview/data-table.tsx`
- `apps/web-vite/src/components/import/step-preview.tsx` table portion → `import/step-preview/data-table.tsx`
- `apps/web-vite/src/components/payments/new-payment-run-dialog/step-select.tsx` table portion → `payments/new-payment-run/step-select/data-table.tsx`
- `apps/web-vite/src/components/zatca/zatca-invoice-chain-table.tsx` + `zatca-invoice-chain-table-container.tsx` → `zatca/invoice-chain/{data-table,container}.tsx`
- `apps/web-vite/src/components/payments/invoice-selection-table/data-table.tsx` — refactor to canonical (already in correct folder; rewrite internals)
- `apps/web-vite/src/components/payments/bank-statement-dialog.tsx` table portion — extract to `payments/bank-statement/data-table.tsx`

Verification:
- `pnpm typecheck`
- manual: open each dialog/wizard, confirm `constrainHeight={false}` renders correctly inside dialog body without double-scroll; OCR line-items inline edit still saves on blur

### Step 7 — Wave 5: First-class list pages

Files / systems touched (in order of complexity):
- `apps/web-vite/src/components/equipment/equipment-table/equipment-table.tsx` → `equipment/equipment-table/data-table.tsx` (rename file, refactor to wrap canonical)
- `apps/web-vite/src/components/approvals/approval-queue/data-table.tsx` — refactor internals to canonical
- `apps/web-vite/src/components/contractors/contractor-table/data-table.tsx` — refactor; delete `data-table-column-toggle.tsx` (move column toggle into `rightSlot` per fact)
- `apps/web-vite/src/components/contracts/contract-table/data-table.tsx` — refactor
- `apps/web-vite/src/components/invoices/invoice-table/data-table.tsx` — refactor
- `apps/web-vite/src/components/workflows/workflow-runs-table/data-table.tsx` — refactor
- `apps/web-vite/src/components/workflows/templates-table.tsx` → `workflows/templates/data-table.tsx`
- `apps/web-vite/src/components/payments/payment-run-table/data-table.tsx` — refactor
- `apps/web-vite/src/components/time/approval-queue-table.tsx` → `time/approval-queue/data-table.tsx`
- `apps/web-vite/src/components/time/reconciliation-table.tsx` → `time/reconciliation/data-table.tsx`
- corresponding hook files in `components/{domain}/hooks/use-*.ts` — adjust to return the canonical prop shape (drop `onPageChange`/`onPageSizeChange` wrapping, return raw `pageIndex`/`pageSize` + URL-syncing handlers)
- per-domain bulk-actions files (`data-table-bulk-actions.tsx`) — delete; replace with the canonical `bulkActions` array

Verification per migrated page:
- `pnpm typecheck`
- `pnpm test`
- manual smoke per page: filter, sort (refresh — URL state restores), paginate (refresh), bulk-select 2 rows, run bulk action, row click opens side panel, RTL render on Contracts in ar-SA
- a11y: tab through pagination footer, confirm aria-labels resolved (`Previous page` / `Next page` / `Rows per page`); on ar-SA confirm chevrons mirror

### Step 8 — Wave 6: Delete obsolete shared primitives

Files / systems touched:
- delete `apps/web-vite/src/components/shared/{simple-data-table,data-table-body,data-table-pagination,sortable-table-head,bulk-actions-slot,row-click,page-table-skeleton}.tsx`
- delete the matching `__tests__/` files
- audit `apps/web-vite/src/components/shared/atelier-bridges.ts` — remove exports that only existed for table fragments
- delete now-unused `apps/web-vite/src/components/contractors/contractor-table/data-table-pagination.tsx`, `contracts/contract-table/data-table-pagination.tsx` (already deleted on this branch per git status — confirm and commit)
- replace every `<Suspense fallback={<PageTableSkeleton />}>` usage with `<Suspense fallback={<DataTable isLoading data={[]} columns={...} {...minimalProps} />}>` OR a domain-specific lightweight fallback

Verification:
- `pnpm typecheck` — must surface every leftover import
- `pnpm --filter @contractor-ops/web-vite test` (path-scoped per memory rule — never full unscoped run)
- `rg -l "page-table-skeleton|simple-data-table|shared/data-table-body" apps/web-vite/src` returns empty

### Step 9 — Wave 7: Final lint gate

Files / systems touched:
- `scripts/check-web-vite-table-pattern.mjs` — remove any `--allow` flag plumbing added during migration
- `package.json` `lint:ci` — confirm the call site has no `--allow`
- documentation: edit `apps/web-vite/ARCHITECTURE.md` § table layer to point at the canonical primitive instead of `SimpleDataTable`/`AtelierTableShell` examples

Verification:
- `pnpm lint:ci` — green
- `pnpm typecheck` — green
- `pnpm test` — green (scoped per package)
- final visual sweep: Contractors / Audit Log / Invoice Selection dialog / Contracts on ar-SA — all four render correctly, no console errors, no double scrollbars

## Risks and open questions

- Settings sub-tables that currently sort client-side without a `useReactTable` hook (raw `<table>` JSX inside container files like `e-invoicing/transmissions-log-card-container.tsx`) need new hook files. Net surface is bigger than headcount of files suggests. Mitigation: each card-container migration takes one commit + one test pass; do not bundle waves.
- `react-router-dom@7` + `nuqs` URL syncing — `nuqs` works with `react-router-dom` only via the `NuqsAdapter` for it; confirm `apps/web-vite/src/main.tsx` wraps the tree (likely already does, given 17 `nuqs` usages). If a per-table URL key collides across tabs on the same route, `urlStateNamespace` resolves it.
- `useUITranslations` fallback returns the key string when no provider is mounted. `apps/web-vite` mounts the provider in `main.tsx`? — confirm during Step 1; if not, add the provider wiring at the same time.
- `ocr/line-items-table.tsx` is an inline-edit form, not a list. Canonical primitive's bulk-action / row-click / pagination model probably does not apply cleanly. Open question: keep `clientPagination=true` + `hideDensityToggle` + omit bulk actions, OR carve out an exception in facts.md and leave the file at status quo. Recommend the former (canonical wrapper with reduced features) — keeps the lint rule clean.
- Tests on `packages/api` for `orderBy` additions: 11+ list procedures gain a new optional input. Existing tests that destructure procedure inputs may break. Mitigation: keep `orderBy` optional with a sensible default in the resolver so old callers still pass typecheck.
- `nuqs` URL state debouncing: 250 ms debounce on search-query writes must coexist with the existing per-domain debounce (`useContractorFilters` likely already debounces). Double-debounce = perceived lag. Resolution: the canonical primitive owns the URL write; per-domain filter hooks read from the URL state instead of owning it.
- `apps/web-vite/ARCHITECTURE.md` already cites `SimpleDataTable` / `AtelierTableShell` as canonical references plus an existing `check:web-vite-table-pattern` whitelist. Updating the doc is part of Wave 7 — do not skip, the doc is the contract for future contributors.
