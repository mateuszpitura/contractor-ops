# Facts — Zero `noJsxPropsBind` warnings + targeted `React.memo` adoption

## Scope

- Affected packages: `apps/web-vite` (400), `packages/ui` (55), `apps/landing` (8), `apps/cms` (0 — verified, no work needed).
- Total `lint/nursery/noJsxPropsBind` warnings to eliminate: **463**.
- Out of scope: other Biome rules (`noLeakedRender`, `useUniqueElementIds`, etc.) — separate goal.

## Success state

- `pnpm exec biome lint apps/web-vite/src apps/landing/src packages/ui/src --reporter=summary` reports `0` for `lint/nursery/noJsxPropsBind`.
- No `// biome-ignore lint/nursery/noJsxPropsBind` comments added to source.
- `pnpm typecheck` passes (no new TS errors).
- `pnpm test` for affected packages passes (no behavior regressions).
- Existing `useCallback` count may grow; existing `React.memo` count grows from `0` to `N` (selective candidates only).

## Resolution rules (decision tree for each warning)

- Handler can be declared at module scope (no closure over props/state/hooks) → extract to module-level `const`.
- Handler closes over component-local values but consumer is **not** memoized and is **not** a hook dependency → extract to component-body `const` (one declaration above `return`). No `useCallback`.
- Handler is passed to `React.memo` child, custom hook, `useEffect`/`useMemo`/`useCallback` dependency, or list-mapped memoized row → wrap in `useCallback` with correct deps.
- Inline arrow that only forwards a constant (e.g. `onClick={() => setOpen(false)}`) → extract to component-body `const` above `return`; only promote to `useCallback` if rule (3) applies.
- Bound methods (`fn.bind(this, ...)`) → replace with arrow that closes over the value or with curried module-level function.

## `React.memo` adoption rules

- Apply `React.memo` only to components that satisfy at least one of:
  - Rendered inside a `.map()` over a non-trivial list (≥ ~10 typical items, e.g. table rows, list cards, virtualized rows).
  - Used as a column cell renderer in a TanStack Table `columns` definition with stable identity expected.
  - Heavy presentational subtree (≥ ~50 lines of JSX or expensive children) re-rendered by a parent that updates frequently.
- Each `React.memo` adoption is paired with prop-stability work: `useCallback` for handler props, `useMemo` for object/array props, primitives kept as primitives.
- `React.memo` is **not** added to:
  - Page-level composers, containers that own queries, providers, route elements.
  - Components whose only prop is `children` of dynamic JSX (memo cannot skip).
  - Components rendered once per page.
- Each adopted `React.memo` is justified by a one-line comment naming the parent rerender driver (e.g. `// memo: rerendered per row in approval queue`), placed only when the *why* is non-obvious.

## Subagent execution rules

- Work is partitioned by file (or tightly coupled file cluster: container + hook + columns).
- Subagents run in parallel batches; each subagent owns one file/cluster end-to-end (read → edit → verify → commit).
- Each subagent must run `pnpm exec biome lint <touched-paths> --reporter=summary` after its edits and confirm the per-rule count drops by the expected delta with no new errors of any rule.
- A subagent must not modify files outside its assigned cluster.
- A subagent must not introduce `useCallback` where decision tree rules 1, 2, or 4 apply.

## Commit rules

- Commits land directly on the active branch (`audit/post-migration-parity`); no PR required by this goal.
- One commit per logical cluster (e.g. one domain folder under `apps/web-vite/src/components/<domain>`), not per file.
- Commit subject form: `refactor(<pkg>,<domain>): extract handlers + memo for noJsxPropsBind` (Conventional Commits, ≤72 chars).
- Commit body explains: cluster touched, warning delta (e.g. `noJsxPropsBind 42 → 0`), any `React.memo` added with rerender driver.
- No commit may regress `pnpm typecheck` or `pnpm exec biome lint` total error count.

## Per-package targets

- `apps/web-vite/src`: 400 → 0 `noJsxPropsBind`.
- `packages/ui/src`: 55 → 0 `noJsxPropsBind`.
- `apps/landing/src`: 8 → 0 `noJsxPropsBind`.
- `apps/cms/src`: already 0; no work.

## Verification

- Final gate: `pnpm exec biome lint apps/web-vite/src apps/landing/src packages/ui/src --reporter=summary 2>&1 | grep noJsxPropsBind` returns no matching line (rule absent from summary == 0 violations).
- `pnpm typecheck` passes from repo root.
- `pnpm --filter @contractor-ops/web-vite test` passes for any test file in a touched folder (full suite not run — RAM constraint per project memory).
- `apps/landing` and `packages/ui` tests run via `pnpm --filter <pkg> test` for touched paths.

## Constraints

- Caveman mode does not apply to code or commits.
- Existing 725 `useCallback` usages in `apps/web-vite` are not pruned by this goal; only new ones added under decision tree rule 3.
- No React Compiler migration is assumed or performed.
- Tenant boundaries, audit logging, tRPC contracts, and Zod validation are not touched.
- No file deletions, no API surface changes, no new dependencies.
