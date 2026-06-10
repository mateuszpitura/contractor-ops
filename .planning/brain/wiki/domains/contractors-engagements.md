---
title: Contractors and engagements
type: domain
tags: [contractors, hr, compliance]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/core/contractor-core.ts
  - apps/web-vite/src/components/contractors/
updated: 2026-06-09
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
