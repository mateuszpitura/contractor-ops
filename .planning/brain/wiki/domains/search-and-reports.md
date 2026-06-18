---
title: Search and reports
type: domain
tags: [search, reports, dashboard]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/core/search.ts
  - packages/api/src/routers/core/report.ts
  - packages/api/src/middleware/report-rate-limit.ts
updated: 2026-06-16
---

# Search and reports

## Purpose

Unified global search (contractors, contracts, invoices via tsvector), spend/expiry/compliance reports with chart variants and export. **Staff home dashboard** → [[domains/staff-dashboard]].

## Entry points

| Namespace | Path |
|-----------|------|
| `search` | `routers/core/search.ts` |
| `report` | `routers/core/report.ts` |
| `docs` | `routers/core/docs.ts` — in-app API/docs helpers for staff |
| UI search/reports | `components/search/`, `reports/` |
| UI dashboard | `components/dashboard/` → [[domains/staff-dashboard]] |

## Invariants

- All `report.*` procedures (reads, chart variants, export enqueues) chain `report-rate-limit` → 30/min per org (shared with `dashboard.*`); see [[patterns/trpc-procedure-stack]]
- `complianceGaps` / `complianceGapsChart` fetch active contractors into JS before filtering — capped at `COMPLIANCE_GAP_SCAN_CAP` (1000) so a request can never materialize the whole table; `complianceGaps` returns a `truncated` flag, the chart logs a warning when the cap is hit. Full set goes through the async export.

## Related

- [[invoice-to-payment]]
- [[compliance-dashboard]]
- [[patterns/trpc-procedure-stack]]

## Verify live

```bash
semble search "searchRouter"
semble search "reportRouter"
```

## Agent mistakes

- Client-only search filtering instead of server FTS
