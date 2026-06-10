---
title: Data tables workbench
type: pattern
tags: [ui, datatable, web-vite]
source_commit: 19f747bca80fe58d162d3e8c3967ec553e057151
verify_with:
  - packages/ui/src/components/workbench/data-table/
  - apps/web-vite/src/components/reports/hooks/use-report-table-state.ts
  - apps/web-vite/src/components/equipment/hooks/use-equipment-table.ts
updated: 2026-06-09
---

# Data tables workbench

## Purpose

Staff tables use canonical `@contractor-ops/ui` workbench `DataTable` — not ad-hoc table implementations.

## Entry points

| Piece | Path |
|-------|------|
| DataTable | `packages/ui/src/components/workbench/data-table/` |
| Table page layout | `packages/ui/src/components/workbench/table-page-layout.ts` |
| App usage | `apps/web-vite/src/components/**/data-table.tsx` |
| Columns | co-located `columns.tsx` per domain |

## Pattern

Hook returns `tableProps` / `toolbarProps` → container passes to presentational `data-table.tsx`.

## Related

- [[web-vite-data-layer]]
- [[structure/web-vite-domains]]

## Verify live

```bash
pnpm check:web-vite-table-pattern
semble search "DataTable" apps/web-vite
```

## Agent mistakes

- Custom sort/pagination table instead of workbench DataTable
- tRPC calls inside `data-table.tsx` presentational files

## Shared list-table hook (2026-06-11)

| Piece | Path |
|-------|------|
| `useListDataTable` | `apps/web-vite/src/hooks/use-list-data-table.ts` |
| In list hooks | contractor, contract, invoice (`use-*-list.ts`), **equipment** (`use-equipment-table.ts`) |
| Report hook | `useReportTableState` → `reports/report-table/data-table.tsx` |
| In domain hook | `workflows/hooks/use-workflow-runs-data-table.ts` → `workflow-runs-table/data-table.tsx` |

Persists column visibility in `localStorage`, syncs TanStack sorting with URL/filter state.

**Two adoption shapes:**

1. **Domain table hook** — list hook composes tRPC query + `useListDataTable`; presentational `data-table.tsx` is props-only (contractor, contract, invoice, equipment, workflow-runs).
2. **Thin wrapper hook** — `useReportTableState` composes `useListDataTable` when parent owns fetch but table owns sort/column chrome.

**Phase 5D (2026-06-11):** `WorkbenchDataTable` sets `dir={useDirection()}` on table `<section>` — RTL column chrome for `ar` locale.

**Phase 6C (2026-06-09):** report tables add column visibility toggle:

| Piece | Path |
|-------|------|
| `DataTableColumnToggle` | `reports/report-table/data-table-column-toggle.tsx` |
| Wired in | `reports/report-table/data-table.tsx` — toolbar slot via `useReportTableState` `columnVisibility` |
| i18n | `Reports.columnToggle` + `Reports.columns.<columnId>` via `tDynLoose` — en/de/pl/ar parity |

Tests: `use-list-data-table.test.ts`, `use-report-table-state.test.ts`, `use-direction.test.ts`
