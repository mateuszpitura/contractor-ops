# Goal: Unified Skeleton Loading Animations

Standardize loading states across all data surfaces in the web and portal apps. Every table, card, list, and chart shows a contextual skeleton while its query is pending — never a null gap, never a full-page block from a single slow endpoint.

## Shared Understanding

- Facts: [facts.md](./facts.md)
- Plan: [plan.md](./plan.md)

## Done Condition

- All tables have `SectionLabel` header, `DataTableBody` skeleton rows, disabled toolbar during load
- Non-standard tables (audit-log, slack-mapping, intake-list, tab-equipment) migrated to DataTableBody
- All cards show shimmer skeleton (no `return null` during load)
- All lists show skeleton rows during load
- All charts show `Skeleton` placeholder during load
- Every page loads each data section independently — one slow endpoint does not block siblings
- Portal components have consistent loading states
- All dashboard pages use `PageLoadingSpinner` as page-level Suspense fallback
