# Goal — DRY / SOLID Audit & Extraction

Audit the entire `contractor-ops` monorepo for duplicated, non-trivial logic across utilities, React components and hooks, tRPC patterns, and Prisma/DB patterns. For every duplication cluster that meets the 2+-call-site threshold, extract a single shared module to the correct existing package and migrate every call site, landing the whole effort as one PR with no behaviour change.

## Shared understanding

See [`facts.md`](./facts.md) for the binding fact sheet: scope, threshold, extraction targets, behaviour-preservation rules, quality bars, non-goals, anti-goals.

## Execution plan

See [`plan.md`](./plan.md) for the ordered steps, the cluster catalogue surfaced during planning, verification per step, and the open risks. The audit pass (Step 0) will write `audit.md` with the final, code-verified cluster list; Steps 1–8 extract them; Step 9 runs the whole-repo guards; Step 10 opens the PR.

## Done condition

A single PR is open against `main` containing `goals/dry-solid-audit/audit.md` plus the extracted shared modules and every migrated call site, with:

- `pnpm typecheck` clean across the monorepo (tsc, CI-canonical).
- `pnpm test` green for every touched package, scoped per package (no unscoped `web-vite` runs).
- `pnpm lint` and Biome clean.
- No behaviour change at any call site.
- Each cluster in `audit.md` marked `EXTRACTED`, `SKIPPED (reason)`, or `DEFERRED (reason)`.
