# Goal — Dropdown Normalization

Make every dropdown in the app behave consistently: explicit in-trigger loading state for async sources, the human label (not the raw key) rendered as the selected value, and `UPPER_SNAKE_CASE` keys for every Prisma enum across the full stack so casing is unambiguous from DB to UI.

## Shared understanding

See [`facts.md`](./facts.md) for the testable fact sheet — scope, loading behavior, selected-value rendering, key-normalization rules, affected surfaces, and done condition.

## Execution plan

See [`plan.md`](./plan.md) for the ordered steps, files touched, per-step verification, and identified risks.

## Done condition

- All Select / Combobox / DataTable filter / Radio / native-select triggers render the translated label, never the raw key.
- All async dropdowns show the trigger spinner during the pending state and remain disabled until resolved.
- `schema.prisma` audit (`pnpm db:audit-enum-casing`) reports zero lowercase enum values.
- `pnpm typecheck` and `pnpm test` pass across all affected packages.
- Unknown-key fallback behaves per environment (dev throws, prod logs + muted-key render), verified by unit tests.
