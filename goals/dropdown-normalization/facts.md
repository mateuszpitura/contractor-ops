# Facts — Dropdown Normalization

## Scope

- Audit covers all Select / Combobox / cmdk / DataTable column filter / native `<select>` / Radio / SegmentedControl usages in `apps/web-vite`, `apps/landing`, `apps/cms` (config only — Payload-rendered admin fields excluded), and `packages/ui` Select primitive.
- Audit excludes date, time, and number inputs.
- Audit excludes Payload CMS internal admin-UI rendered dropdowns (Payload-owned). Payload *config* enums backed by Prisma are in scope.
- Audit excludes external API consumer code (not present in repo).
- Free-text string columns acting as implicit enums (e.g. `status: string`) are out of scope and tracked for a separate goal.

## Async loading state

- Every dropdown whose options come from an async source (tRPC query, fetch, deferred import) renders an in-trigger loading state while the source is pending.
- The loading state is a `Loader2` spinner inside `SelectTrigger` and the trigger is `disabled` until data resolves.
- No blur, blank trigger, or empty placeholder is shown during the pending state.
- Once data resolves, the spinner disappears and the trigger becomes interactive.
- If the async source errors, the trigger renders an error indicator (icon + accessible label) and remains disabled until retry.

## Selected value rendering

- Every dropdown renders the human-readable label (translated value) of the selected option in `SelectValue`, never the raw key.
- This applies whether the source is a static option array or an async fetch.
- If the selected key has no matching option in the current options array, behavior depends on environment:
  - **Development** (`NODE_ENV !== 'production'`): throws an error (fail loud, surfaces data drift).
  - **Production**: logs a Pino `error` with context (component, field, key, available keys) and renders the raw key in a muted style as visible fallback.

## Key normalization

- All Prisma enum types in the schema use `UPPER_SNAKE_CASE` values across the entire stack (DB, API, frontend, workers, cron) regardless of whether the enum currently powers a UI dropdown.
- All frontend option arrays expose `value` as the uppercase enum key (e.g. `EUR`, `UPS_GROUND`, `IN_PROGRESS`).
- All Zod schemas at tRPC and webhook boundaries validate against uppercase enum values.
- All i18n locale JSON files mirror the enum case in their dropdown-label keys (e.g. `status.IN_PROGRESS` replaces `status.inProgress`) for `en`, `de`, `pl`, `ar`, `ar-SA`, `en-GB` where present.
- DB enum migration uses drop-and-recreate (no production data exists).

## Affected surfaces (illustrative, not exhaustive)

- `packages/ui` Select primitive gains a `loading` prop and an `error` prop with documented behavior.
- `apps/web-vite` Select-using files refactored to consume the new loading prop and to render labels via centralized helpers.
- `apps/web-vite` DataTable column filter chips render labels and emit uppercase keys.
- `apps/landing` form selects (language switcher, contact form) render labels and emit uppercase keys where keys exist.
- `apps/cms` non-Payload Select usages follow the same rules.

## Done condition

- All Select / Combobox / DataTable filter / Radio / native-select triggers render the translated label, never the raw key.
- All async dropdowns show the trigger spinner during pending state and remain disabled until resolved (verified by manual sweep with network throttling and at least one Vitest test per pattern).
- `schema.prisma` audit finds zero lowercase or mixed-case enum values (verified by a scripted grep producing zero hits).
- `pnpm typecheck` passes across all affected packages.
- `pnpm test` passes across all affected packages.
- Unknown-key fallback behaves per environment rule (dev throw, prod log + muted-key render), verified by unit tests.
