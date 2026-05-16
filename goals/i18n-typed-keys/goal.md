# Goal — i18n typed keys cleanup

Make next-intl translation keys fully type-checked across `apps/web/src/` so every `t(...)` and dynamic-key site resolves through TypeScript without `as Parameters<typeof t>[0]` or `as keyof` casts cluttering call sites. Deliver this via a generated `Messages` type (from `apps/web/messages/en.json`), a global `next-intl` `AppConfig` augmentation, and a typed `tDyn` helper for the dynamic-key sites, with a regression guard to keep casts from creeping back.

## Shared understanding

See [`facts.md`](./facts.md) — the canonical fact sheet describing what the outcome must satisfy (scope, type source, dynamic-key helper shape, codegen wiring, regression guard, verification commands).

## Execution plan

See [`plan.md`](./plan.md) — ordered steps, files touched per step, verification per step, and the identified risks / open questions.

## Done condition

All of the following hold:

- `rg "as Parameters<typeof t>" apps/web/src` returns zero matches.
- `rg "as keyof (IntlMessages|Messages)" apps/web/src` returns zero matches.
- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:code-coverage`, and `pnpm test` all exit 0 (test parity vs baseline per `[[project_test_debt_handoff]]`).
- A regression guard (Biome rule or `scripts/lint-i18n-casts.ts`) blocks reintroduction of the forbidden cast patterns in CI.
- Generated type at `apps/web/src/generated/i18n/messages.d.ts` is wired through turbo `i18n:types` and refreshed on every `typecheck` / `build` / `dev`.
- Smoke check in `pnpm dev`: representative pages (settings/users, audit-log, invoices, contracts, payments, reports, approvals, notifications) render labels in EN and PL with no `MISSING_MESSAGE` warnings in the browser console.
