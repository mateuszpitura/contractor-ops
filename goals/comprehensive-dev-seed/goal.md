# Goal — Comprehensive Dev Seed

Extend `packages/db/scripts/seed-dev.ts` so it seeds **every meaningful tenant model** in the Prisma schema (closing today's gaps around workflow templates, jurisdiction-aware compliance, Skonto/interest, Peppol/Zatca, eSign, exchange-rate history, consent/privacy, and auth-surface display rows), and add a new `--omit=<sections>` CLI flag with transitive dependency expansion plus a pre-run summary of what was skipped. The `showcase` profile becomes a fully-populated demo org so every UI surface in the dev frontend can be visually verified from a single seed command.

## Shared understanding

[`facts.md`](facts.md) is the authoritative list of testable outcomes — every model that must be seeded, profile sizing rules, the `--omit` flag contract, the auth-surface caveat, and the explicit "out of scope" boundary.

## Execution plan

[`plan.md`](plan.md) is the ordered, atomic-commit step plan with file references, verification commands, and risks/open questions. Steps 3–13 are parallelizable after step 1 lands.

## Done

- Every fact in `facts.md` § "Done condition" passes.
- `pnpm db:seed:dev --profile=showcase --confirm` produces ≥ 1 row for every model listed in `facts.md` § "Coverage".
- `pnpm db:seed:dev --profile=showcase --confirm --omit=workflow-runs,esign` runs cleanly, prints the resolved omit summary table, and produces zero rows for the omitted sections (and any transitively-skipped sections).
- `pnpm run typecheck` and the existing seed-related vitest suites are green.
- A spot-check pass through the dev frontend on the seeded showcase org shows non-empty UI for: workflow templates list, workflow runs board, IR35 dashboard, Statusfeststellungsverfahren list, ZATCA dashboard, Peppol transmissions, Skonto applications, exchange-rate history chart, consent log, API keys page, signing envelopes list.
