# Plan — Zero `noJsxPropsBind` warnings + targeted `React.memo` adoption

## Solution approach

Mechanical refactor split across many parallel `general-purpose` subagents, each owning one cohesive cluster (a domain folder under `apps/web-vite/src/components/<domain>`, the data-grid folder in `packages/ui`, etc.). Each subagent walks the decision tree from `facts.md` for every warning in its files, applies the resolution (module-extract → component-body-extract → `useCallback` → adopt `React.memo` only when static heuristic matches), verifies with Biome and `tsc`, and commits one logical commit per cluster on `audit/post-migration-parity`.

Orchestrator coordinates waves: 5–8 subagents in parallel per wave, waves separated by a verification gate so a broken wave does not block others.

## Inventory (from `pnpm exec biome lint ... --reporter=json`)

`apps/web-vite/src` — 400 warnings across 154 files, breakdown by `src/components/<domain>`:

| Domain | Warnings | Notes |
|---|---|---|
| contractors | 71 | Has `contractor-table/columns.tsx` (memo candidate) |
| invoices | 63 | Has `invoice-table/columns.tsx`, `data-table-filters.tsx` (8) |
| portal | 51 | `portal-equipment-container.tsx` (13), `portal-return-flow.tsx` (6) |
| settings | 43 | `leitweg-id-create-dialog.tsx` (10), pickers |
| organization | 39 | `project-form-sheet.tsx` (9), form sheets |
| equipment | 35 | `equipment-detail-header.tsx` (7), `tab-shipments.tsx` (6) |
| time | 13 | `time-tracking-container.tsx` |
| payments | 13 | 2× `columns.tsx` (payment-run, invoice-selection — memo candidates) |
| contracts | 11 | `edit-contract-dialog.tsx` (6) |
| layout | 10 | `org-switcher.tsx` (7) |
| workflow | 9 | `calendar-event-config-dialog.tsx` (6) |
| reports | 6 | |
| approvals | 6 | Has `approval-queue/columns.tsx` (memo candidate) |
| workflows | 4 | `workflow-runs-table/columns.tsx` (memo candidate) |
| admin | 4 | boe-rate dialogs |
| other (root + small) | ~22 | tos-reacceptance, onboarding, offboarding, billing, etc. |

`packages/ui/src` — 55 warnings; concentration in `components/reui/data-grid/*` (~32) and a long tail across `origin`, `shadcn`, `tailark`, `ace`.

`apps/landing/src` — 8 warnings across 5 files (`pricing/*`, `blog/*`, `sections/cta-band.tsx`).

`apps/cms/src` — 0 warnings, skipped.

## Order of operations

Work is split into **waves**. Each wave fans out parallel subagents; the orchestrator does not advance to the next wave until every subagent in the current wave reports `success` and the verification gate at the end of the wave passes.

### Wave 0 — Repo guardrails (orchestrator, no subagents)

1. Confirm working tree clean except expected `M` files on `audit/post-migration-parity`; stash nothing.
2. Capture baseline: `pnpm exec biome lint apps/web-vite/src apps/landing/src packages/ui/src --reporter=summary > /tmp/baseline-biome.txt`.
3. Capture baseline `pnpm typecheck` result (pass/fail snapshot to compare against).

### Wave 1 — High-volume `apps/web-vite` domains (5 subagents, parallel)

| Subagent | Cluster | Warnings | Memo candidates to evaluate |
|---|---|---|---|
| A | `apps/web-vite/src/components/contractors/**` | 71 | `contractor-table/columns.tsx`, `contractor-list-container` row renderers |
| B | `apps/web-vite/src/components/invoices/**` | 63 | `invoice-table/columns.tsx`, `data-table-filters` chips |
| C | `apps/web-vite/src/components/portal/**` | 51 | `portal-equipment-container`, `portal-invoices-container` list rows |
| D | `apps/web-vite/src/components/settings/**` | 43 | Picker row components (`reminder-rule-user-picker`, `rule-user-picker`, `chain-editor-user-picker`) |
| E | `apps/web-vite/src/components/organization/**` | 39 | `organization-projects-container`, `pending-merges-inbox` rows |

Each subagent receives: cluster glob, list of files with violation counts, full text of `facts.md` (decision tree, memo rules, commit rules), explicit ban on touching files outside cluster.

### Wave 2 — Medium-volume `apps/web-vite` domains (5 subagents, parallel)

| Subagent | Cluster | Warnings | Memo candidates |
|---|---|---|---|
| F | `apps/web-vite/src/components/equipment/**` | 35 | `equipment-table/columns.tsx`, `tab-shipments` rows |
| G | `apps/web-vite/src/components/time/**` + `payments/**` | 13 + 13 | `payment-run-table/columns.tsx`, `invoice-selection-table/columns.tsx` |
| H | `apps/web-vite/src/components/contracts/**` + `approvals/**` + `workflows/**` + `workflow/**` | 11+6+4+9 = 30 | `contract-table/columns.tsx`, `approval-queue/columns.tsx`, `workflow-runs-table/columns.tsx` |
| I | `apps/web-vite/src/components/layout/**` + `reports/**` + `admin/**` | 10+6+4 = 20 | None (eval per file) |
| J | `apps/web-vite/src/components/{tos-reacceptance,onboarding,offboarding,billing,dashboard,import,zatca,notifications,integrations,error,documents,consent}*` and root-level files in `components/` | ~22 | None expected |

### Wave 3 — `packages/ui` + `apps/landing` (3 subagents, parallel)

| Subagent | Cluster | Warnings | Notes |
|---|---|---|---|
| K | `packages/ui/src/components/reui/data-grid/**` | ~32 | Library code — extra caution. Add `React.memo` only on row/cell wrappers proven to be hot. Run `pnpm --filter @contractor-ops/ui test` for any touched file with sibling test. |
| L | `packages/ui/src/components/{origin,shadcn,tailark,ace,reui/*.tsx}` (everything in `packages/ui` outside data-grid) | ~23 | |
| M | `apps/landing/src/components/{pricing,blog,sections}/**` | 8 | Next.js — verify the change is a Client Component before `useCallback`; module-extract is preferred where the handler does not close over hooks. |

### Wave 4 — Final verification + memo audit (orchestrator)

1. Run `pnpm exec biome lint apps/web-vite/src apps/landing/src packages/ui/src --reporter=summary 2>&1 | grep noJsxPropsBind` → must produce no output line.
2. Run `pnpm typecheck` from repo root → must pass.
3. Run `pnpm --filter @contractor-ops/web-vite test apps/web-vite/src/components` scoped to touched files only (per project memory: never full unscoped run).
4. Run `pnpm --filter @contractor-ops/ui test` and `pnpm --filter landing test` (if test scripts exist).
5. Verify `git log --oneline audit/post-migration-parity ^HEAD~30 | grep "refactor(.*): extract handlers"` lists every cluster commit.
6. Confirm no `// biome-ignore lint/nursery/noJsxPropsBind` introduced: `rg "biome-ignore lint/nursery/noJsxPropsBind" apps packages` → empty.

## Per-subagent contract (briefing template)

Each subagent receives a self-contained prompt with these sections:

1. **Cluster scope** — exact glob and file list with per-file warning counts from `/tmp/biome-webvite.json` (or per-package JSON).
2. **Decision tree** — copied verbatim from `facts.md` "Resolution rules".
3. **Memo rules** — copied verbatim from `facts.md` "React.memo adoption rules".
4. **Hard constraints**:
   - Touch only listed files. Do not edit anything else.
   - For each file: `Read` first (CLAUDE.md mandates Read before Edit on existing paths). Apply minimal-diff Edits. Never `Write` over an existing file.
   - No `// biome-ignore lint/nursery/noJsxPropsBind`.
   - Existing `useCallback` usages must remain unless they conflict with a new edit.
   - Do not rename components, change exports, change prop shapes.
5. **Verification before commit**:
   - `pnpm exec biome lint <changed-file-paths> --reporter=summary` shows `noJsxPropsBind` count dropped to 0 for the cluster, and no rule's total error count rose.
   - `pnpm typecheck --filter <affected-pkg>` passes for any package whose source was touched.
   - For each `React.memo` added: include the one-line justification comment naming the parent rerender driver.
6. **Commit**: one commit per cluster directly on the active branch:
   ```
   refactor(<pkg>,<domain>): extract handlers + memo for noJsxPropsBind

   - <cluster path>: noJsxPropsBind N → 0
   - React.memo added: <Component> (rerendered per <driver>)
   - useCallback added: <count> (consumed by memoized children / hook deps)
   - module-extracted handlers: <count>
   ```
7. **Return**: short report with warning delta, files touched, memo adoptions, and commit SHA.

## Verification per step

| Step | Command | Expected |
|---|---|---|
| After each subagent commit | `pnpm exec biome lint <cluster> --reporter=summary \| grep noJsxPropsBind` | No matching line for cluster |
| After each wave | `pnpm exec biome lint apps/web-vite/src apps/landing/src packages/ui/src --reporter=summary` | Total `noJsxPropsBind` strictly decreases by Σ cluster deltas; no other rule's error count increases |
| After each wave | `pnpm typecheck` | Pass (no new TS errors vs Wave 0 baseline) |
| After Wave 4 | `pnpm exec biome lint apps/web-vite/src apps/landing/src packages/ui/src --reporter=summary \| grep noJsxPropsBind` | No output |
| After Wave 4 | `rg "biome-ignore lint/nursery/noJsxPropsBind" apps packages` | No output |
| After Wave 4 | `pnpm typecheck` | Pass |
| After Wave 4 | `pnpm --filter @contractor-ops/web-vite test apps/web-vite/src/components/<domain>` scoped per touched domain | Pass per cluster (full unscoped suite forbidden per memory) |

## Risks and open questions

- **Risk**: extracting a handler to component body changes hook ordering if the original was conditionally bound inside JSX. Subagents must Read the full function first and avoid moving anything that crosses a conditional boundary; if encountered, prefer `useCallback` over module-extract.
- **Risk**: `React.memo` on a row component whose props include an inline object (e.g. `style={{ ... }}`) silently re-renders. Each memo adoption requires the subagent to verify all sibling props passed by the parent are either primitives, `useMemo`-stable, or `useCallback`-stable.
- **Risk**: tests rely on inline handler identity (rare but possible in React Testing Library queries). Verification step runs touched tests; failures roll back to a `useCallback` over module-extract.
- **Risk**: `packages/ui` is consumed by `apps/web-vite` and `apps/landing`. Wave 3 subagent K runs after Waves 1–2 so any pattern decisions from app code already landed; if K finishes before downstream Biome passes its assertions, rerun Wave 4 verification across all packages.
- **Risk**: parallel subagents create overlapping commits in the same file if cluster boundaries are wrong. Mitigation: clusters are non-overlapping globs; orchestrator double-checks `git diff --name-only` after each wave to confirm no file appears in two cluster commits.
- **Open question (deferred to execution)**: a handful of files live at `apps/web-vite/src/components/*.tsx` root (e.g. `tos-reacceptance-modal.tsx`). Wave 2 subagent J owns all root-level files; if any are touched by another subagent in error, orchestrator reassigns and the file is reverted with `git checkout` of the SHA before that subagent's edit (only with explicit user approval per CLAUDE.md git safety).
- **Open question (deferred to execution)**: test files (`*.test.tsx`) also contribute to the 400 count (e.g. `step-select.test.tsx` has 6). Subagents treat test files the same — extract above the assertion or use `useCallback` only if a memoized child is the test subject.

## Out of scope (this plan)

- React Compiler migration.
- Pruning the existing 725 `useCallback` usages.
- Other Biome rules (`noLeakedRender`, `useUniqueElementIds`, `noExcessiveCognitiveComplexity`, `suppressions/unused`).
- `apps/api`, `apps/cron-worker`, `apps/public-api`, `packages/api` — no React surface.
- Profiler-driven memoization (static heuristic only per `facts.md`).
