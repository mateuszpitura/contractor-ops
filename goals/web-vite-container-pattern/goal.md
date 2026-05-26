# Goal — web-vite container pattern enforcement

## Articulated goal

Apply the **container + dumb-component + domain-hook** pattern across every domain folder in `apps/web-vite/`. A page is a thin shell that composes one or more `*-container.tsx` components. Each container delegates data, mutations, and business logic to a domain hook under `components/{domain}/hooks/use-*.ts`. Presentational components stay props-only. Every new or modified hook ships with a colocated vitest spec covering loading / empty / error / success. Work is split across per-domain subagents (max 4 in parallel, no early stops), followed by a leftover-audit agent and a final CI gate.

## Shared understanding

See [facts.md](facts.md) — gated and approved.

## Execution plan

See [plan.md](plan.md) — gated and approved.

## Done condition

The goal is done when **all** of the following hold:

- All 34 domain folders under `apps/web-vite/src/components/` have been processed by an agent (or confirmed empty).
- The leftover-audit agent's `leftover-report.md` shows zero unresolved findings (or each finding has a closing commit referenced by SHA).
- Final CI gate is green:
  - `pnpm --filter @contractor-ops/web-vite check:data-layer` → OK
  - `pnpm --filter @contractor-ops/web-vite check:page-shells` → OK
  - `pnpm check:web-vite-presentational` → OK
  - `pnpm typecheck --filter @contractor-ops/web-vite` → exit 0
  - `pnpm --filter @contractor-ops/web-vite test` → exit 0
  - `rg "useTRPC\(\)" apps/web-vite/src --glob '!**/hooks/**' --glob '!**/providers/**'` → 0 matches
- Every touched hook has a colocated `__tests__/use-*.test.{ts,tsx}` spec with the 4 mandatory states (loading / empty / error / success) plus mutation-specific assertions where applicable.
- Commit history shows atomic, per-domain commits; no cross-domain edits in a single commit.
- No edits landed in `apps/web/`, `apps/cms/`, `apps/landing/`, or any `packages/*` as part of this goal.
