---
title: Time and reconciliation
type: domain
tags: [timesheets, clockify, portal-time]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/core/time.ts
  - packages/api/src/routers/portal/portal-time-router.ts
updated: 2026-06-09
---

# Time and reconciliation

## Purpose

Manager timesheet review (approve/reject/bulk), Clockify external sync, portal time entry CRUD and submit.

## Entry points

| Piece | Path |
|-------|------|
| Staff | `time` router — `routers/core/time.ts` |
| Portal | `portalTime` — `routers/portal/portal-time-router.ts` |
| Clockify adapter | `packages/integrations/src/adapters/clockify-adapter.ts` |
| UI | `apps/web-vite/src/components/time/` |

## Related

- [[portal-external]]
- [[workflows-and-roles]]

## Verify live

```bash
semble search "portalTimeRouter"
semble search "clockify"
```

## Agent mistakes

- Staff time procedures on portal router or vice versa
