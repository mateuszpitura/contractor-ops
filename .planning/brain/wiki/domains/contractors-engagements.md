---
title: Contractors and engagements
type: domain
tags: [contractors, hr, compliance]
source_commit: c89762ffe45f4cabdc59f5deeb67eefb39726530
verify_with:
  - packages/api/src/routers/core/contractor-core.ts
  - apps/web-vite/src/components/contractors/
updated: 2026-06-16
---

# Contractors and engagements

## Purpose

Contractor master data, lifecycle, compliance health, country-specific fields, bulk ops, and GUS/registry lookup.

## Entry points

| Piece | Path |
|-------|------|
| Router | `contractor` — `packages/api/src/routers/core/contractor-core.ts` |
| Classification UI | `apps/web-vite/src/components/contractors/classification/` |
| Free-zone (Gulf) | `components/contractors/free-zone/` |
| Country compliance | `country-compliance-section-container.tsx` |
| US tax-form status (staff) | `components/contractors/tax-forms/tax-form-status-card.tsx` → [[us-tax-forms]] |

## UI surface

`apps/web-vite/src/components/contractors/` — list, profile tabs, side panel, bulk actions.

## Invariants

- Tenant-scoped list/detail
- Classification assessments link to [[classification-ir35]] when flag on

## Related

- [[contracts-lifecycle]]
- [[classification-ir35]]
- [[gulf-saudization]]
- [[patterns/rbac-permissions]]

## Verify live

```bash
semble search "contractorRouter"
pnpm check:web-vite-data-layer --filter @contractor-ops/web-vite
```

## Agent mistakes

- Client-supplied org id for contractor scope
- tRPC in `contractor-table/data-table.tsx`
