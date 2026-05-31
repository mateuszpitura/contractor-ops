# Goal — Eliminate `noJsxPropsBind` warnings and adopt `React.memo` where it earns its keep

Eliminate every `lint/nursery/noJsxPropsBind` Biome warning across `apps/web-vite`, `packages/ui`, and `apps/landing` (463 total) by preferring module-scope or component-body handler extraction, falling back to `useCallback` only when a memoized consumer or hook dependency justifies it. While walking each cluster, adopt `React.memo` selectively where a static heuristic — components rendered inside `.map()` over non-trivial lists, TanStack Table column cells, heavy presentational subtrees — predicts a real render win, and pair each adoption with prop-stability work.

## Shared understanding

The verifiable facts that define "done" live in [`facts.md`](./facts.md):

- 463 `noJsxPropsBind` warnings → 0 across `apps/web-vite/src` (400), `packages/ui/src` (55), `apps/landing/src` (8). `apps/cms/src` already at 0.
- No `// biome-ignore lint/nursery/noJsxPropsBind` comments introduced.
- Resolution decision tree (module-extract → component-body-extract → `useCallback`) applied per warning.
- `React.memo` adopted only when the static heuristic matches and every prop is provably stable.
- `pnpm typecheck` passes; per-package scoped tests pass; full `web-vite` unscoped test suite is forbidden (RAM constraint).

## Execution plan

[`plan.md`](./plan.md) defines four waves with parallel `general-purpose` subagents per wave:

- **Wave 1** — 5 subagents on the highest-volume `apps/web-vite` domains (contractors, invoices, portal, settings, organization).
- **Wave 2** — 5 subagents on medium-volume domains (equipment, time+payments, contracts+approvals+workflows, layout+reports+admin, the long tail).
- **Wave 3** — 3 subagents on `packages/ui` (data-grid, the rest) and `apps/landing`.
- **Wave 4** — Orchestrator verification: Biome shows no `noJsxPropsBind`, no biome-ignore introduced, typecheck passes, scoped tests pass.

Each subagent commits one logical cluster directly on the active branch `audit/post-migration-parity` — no PR per `bez PR, po prostu commituj, nie boj sie` directive.

## Done condition

All of the following must hold:

1. `pnpm exec biome lint apps/web-vite/src apps/landing/src packages/ui/src --reporter=summary 2>&1 | grep noJsxPropsBind` produces no output.
2. `rg "biome-ignore lint/nursery/noJsxPropsBind" apps packages` produces no output.
3. `pnpm typecheck` from repo root exits 0.
4. Per-domain scoped tests (`pnpm --filter @contractor-ops/web-vite test apps/web-vite/src/components/<domain>`) pass for every domain touched by Waves 1–2; `pnpm --filter @contractor-ops/ui test` passes; `pnpm --filter landing test` (if defined) passes.
5. `git log audit/post-migration-parity` shows one `refactor(<pkg>,<domain>): extract handlers + memo for noJsxPropsBind` commit per cluster from Waves 1–3.
6. Every `React.memo` adoption in the diff is accompanied by either a one-line justification comment (when the rerender driver is non-obvious) or is on a TanStack columns cell (justification implicit from context).
