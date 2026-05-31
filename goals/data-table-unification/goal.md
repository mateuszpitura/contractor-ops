# Goal — data-table-unification

Collapse the fragmented table landscape in `apps/web-vite` into a single canonical `DataTable` primitive that lives in `packages/ui/src/components/workbench/data-table/`. Every list, settings sub-table, dialog-embedded table, and wizard step in `apps/web-vite` renders through this primitive — same pagination footer, same skeleton, same loading lockout, same empty / no-results states, same naming (`components/{domain}/{table}/data-table.tsx`). Scope is locked to `apps/web-vite` + `packages/ui`; `apps/landing` and `apps/cms` are out of scope.

## Shared understanding

See [`facts.md`](./facts.md) for the testable fact list — primitive identity, pagination defaults `[10, 25, 50, 100]` (default 25), server-side sort everywhere, URL-synced state by default with sub-tables opting out, two-tier empty states, built-in bulk actions, per-domain layout convention, quality gates.

## Execution plan

See [`plan.md`](./plan.md) for the ordered steps — build canonical primitive (Step 1), upgrade `scripts/check-web-vite-table-pattern.mjs` (Step 2), then migrate in waves: settings sub-tables → organization configs → admin/legal/reports → dialog/wizard-embedded → first-class list pages → delete obsolete shared primitives → final lint gate.

## Done condition

- Canonical `DataTable` is the only TanStack-React-Table wrapper imported anywhere under `apps/web-vite/src/`.
- `scripts/check-web-vite-table-pattern.mjs` runs in `pnpm lint:ci` with no `--allow` flags and exits 0.
- No source file under `apps/web-vite/src/` matches `**/*-table.tsx`; every table file is `data-table.tsx` inside a dedicated folder.
- All shared fragments (`apps/web-vite/src/components/shared/{simple-data-table,data-table-body,data-table-pagination,sortable-table-head,bulk-actions-slot,page-table-skeleton,row-click}.tsx`) are deleted.
- `apps/web-vite/ARCHITECTURE.md` § table layer points at the canonical primitive.
- `pnpm typecheck`, `pnpm test` (path-scoped per package), and `pnpm lint:ci` are green.
- Manual smoke pass: Contractors (first-class list, en), Audit Log (sub-table, en), Invoice Selection (dialog-embedded, en), Contracts (first-class list, ar-SA RTL) — all render correctly with consistent pagination, skeletons, empty states, and disabled filters during loading.
