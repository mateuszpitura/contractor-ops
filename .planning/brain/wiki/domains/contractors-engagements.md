---
title: Contractors and engagements
type: domain
tags: [contractors, hr, compliance]
source_commit: d839f52e
verify_with:
  - packages/api/src/routers/core/contractor-core.ts
  - packages/api/src/routers/core/contractor-shared.ts
  - packages/validators/src/contractor.ts
  - apps/web-vite/src/components/contractors/
updated: 2026-06-18
---

# Contractors and engagements

## Purpose

Contractor master data, lifecycle, compliance health, country-specific fields, bulk ops, and GUS/registry lookup.

## Entry points

| Piece | Path |
|-------|------|
| Router | `contractor` — `packages/api/src/routers/core/contractor-core.ts` |
| List insight band | `components/contractors/insights/` (attention rail + composition strip; `hooks/use-contractor-insights.ts` = sole tRPC boundary) |
| List view-mode pref | `components/contractors/hooks/use-contractor-list-view.ts` (Zustand `persist`; Settings select at `components/settings/contractor-view-setting.tsx`) |
| Detail overview widgets | `components/contractors/contractor-profile/overview/` (compliance + financial pulse) + `hooks/use-contractor-financial-pulse.ts` |
| Classification UI | `apps/web-vite/src/components/contractors/classification/` |
| Free-zone (Gulf) | `components/contractors/free-zone/` |
| Country compliance | `country-compliance-section-container.tsx` |
| US tax-form status (staff) | `components/contractors/tax-forms/tax-form-status-card.tsx` → [[us-tax-forms]] |

### Notable procedures

- `contractor.insights` — list-band rollups: `attention` (atRisk / expiring / payment-blocked / stalled + 6-bucket expiry sparkline) + `composition` (lifecycleStage / type / jurisdiction / health). Counts face against the "core" population (status/owner/team/search/billingModel), excluding the segment/attention facet groups so counts stay stable while drilling.
- `contractor.financialPulse` — per-contractor outstanding / ready-to-pay / 12-month paid totals + avg days-to-pay + monthly paid-invoice trend (single-scan `$queryRaw` over `Invoice`). Kept off `getById` so the overview widget loads independently.
- New `list` filter facets: `countryCode`, `expiringWithin` (days), `paymentBlocked`, `stalled` — derived predicates defined once in `contractor-shared.ts` and reused by `list` + `insights`.

## UI surface

`apps/web-vite/src/components/contractors/` — list (insight band + data table, arranged by a per-user view mode: visuals-first/last, data-oriented, tabbed, single), profile tabs (overview leads with compliance + financial-pulse widgets, reference fields in a collapsible), side panel, bulk actions.

## Invariants

- Tenant-scoped list/detail
- Classification assessments link to [[classification-ir35]] when flag on
- **List band ↔ table consistency:** `contractor.insights` and `contractor.list` build their population from the shared `contractorFiltersSchema` (validators) + `buildContractorListWhere` (`contractor-shared.ts`) — same predicate, so a band count and the filtered rows can't drift. `complianceHealth` is derived in JS (not a SQL column): both call `computeListHealthBadge`, and the band's `attention.atRiskCompliance` is exactly `composition.health.red` by construction.
- **View mode is a client-only pref** (`use-contractor-list-view.ts`, Zustand `persist`, localStorage `contractor-list-view`) — not a tRPC boundary; the in-page switcher and the Settings select write the same store (the stored value IS the default).
- `contractor.create` wraps insert in `$transaction` and catches Prisma `P2002`, throwing tRPC `CONFLICT` (`E.CONTRACTOR_TAX_ID_EXISTS`) — a duplicate `taxId` within an org surfaces as a clean conflict, not an unhandled 500. Backing DB `@@unique([organizationId, taxId])` (partial-unique on non-null `taxId`) is recommended/pending; today only `@@index([organizationId, taxId])` exists, so the guard catches the race the moment the constraint lands.
- `getById` still hardcodes `overdueTaskCount`/`unpaidInvoiceCount` to 0 in its health calc — known under-report, reconcile when the overview surfaces real counts.

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
