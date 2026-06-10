---
title: Search and reports
type: domain
tags: [search, reports, dashboard]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/core/search.ts
  - packages/api/src/routers/core/report.ts
updated: 2026-06-09
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

## Related

- [[invoice-to-payment]]
- [[compliance-dashboard]]

## Verify live

```bash
semble search "searchRouter"
semble search "reportRouter"
```

## Agent mistakes

- Client-only search filtering instead of server FTS
