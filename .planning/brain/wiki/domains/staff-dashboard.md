---
title: Staff dashboard home
type: domain
tags: [dashboard, kpi, widgets]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/core/dashboard.ts
  - packages/api/src/middleware/report-rate-limit.ts
  - apps/web-vite/src/components/dashboard/
updated: 2026-06-16
---

# Staff dashboard home

## Purpose

Authenticated staff landing: KPI cards, spend chart, approval queue widget, deadlines, tax obligations, activity feed — backed by `dashboard` tRPC namespace with read-replica caching.

## Flow

```mermaid
flowchart LR
  page[dashboard page] --> container[dashboard-home-container]
  container --> hooks[use-dashboard-home + widgets]
  hooks --> api[dashboard router]
  api --> replica[readReplica + cache]
```

## Entry points

| Piece | Path |
|-------|------|
| Router | `packages/api/src/routers/core/dashboard.ts` — `fetchKpis`, widgets |
| Container | `components/dashboard/dashboard-home-container.tsx` |
| KPIs | `kpi-cards.tsx`, `hooks/use-kpi-cards.ts` |
| Spend | `spend-chart.tsx`, `hero-spend-metric.tsx` |
| Approvals | `approval-queue-widget.tsx` → [[domains/approvals-engine]] |
| Deadlines | `deadlines-widget.tsx` |
| Tax | `tax-obligations-widget.tsx` → [[domains/tax-and-wht]] |
| Activity | `activity-feed.tsx` |
| RBAC | `requirePermission({ report: ['read'] })` on reads |

## UI surface

`apps/web-vite/src/components/dashboard/` — all widget hooks colocated per [[patterns/web-vite-data-layer]].

## Invariants

- Dashboard reads use read replica + `cached`/`cachedSingleflight` — do not bypass for “quick fix”
- Widget mutations delegate to domain routers (approvals, not inline in dashboard router)
- All `dashboard.*` procedures chain `report-rate-limit` → 30/min per org (`report:${orgId}`, shared budget with `report.*`); see [[patterns/trpc-procedure-stack]]

## Related

- [[search-and-reports]]
- [[domains/approvals-engine]]
- [[structure/web-vite-domains]]

## Verify live

```bash
semble search "fetchKpis"
ls apps/web-vite/src/components/dashboard/
```

## Agent mistakes

- Adding business mutations to `dashboard` router — belongs in domain namespace
- `useTRPC` in `dashboard-home-container.tsx` instead of hooks
