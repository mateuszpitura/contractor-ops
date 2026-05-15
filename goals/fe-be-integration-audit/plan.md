# FE↔BE Integration Audit — Execution Plan

## Solution approach

The codebase is too large for line-by-line manual audit: 79 router files (~232 mutations + ~hundreds of queries) across 7 domains, 300+ FE files touching mutations, 952 components in `apps/web/src/components`. Brute-force reading every file blows context.

Strategy = **AST + grep extraction → machine-generated finding table → targeted fixes**.

1. Walk routers, extract every procedure name + procedure type (query/mutation) + procedure file:line into JSON.
2. Walk FE source, extract every `trpc.<path>.useMutation`, `trpc.<path>.mutationOptions`, `trpc.<path>.useQuery`, `trpc.<path>.queryOptions` reference into JSON.
3. Cross-join: procedures with zero FE references → orphan list. FE mutation sites missing toast/invalidation/confirm → gap list.
4. Generate `AUDIT.md` from JSON. Sort by severity, group by domain.
5. Apply fixes in severity order, atomic commits, referencing finding IDs.

Codebase reality (vs facts.md draft): invalidation pattern in this repo is `queryClient.invalidateQueries({ queryKey: trpc.<path>.queryKey() })` via `useQueryClient` — that **is** the tRPC v11 + TanStack proxy idiom. Facts.md's "`trpc.<router>.invalidate()`" was shorthand; the executor will enforce the actual idiomatic form.

## Ordered steps

### Step 1 — Build procedure inventory script

- **Touches**: new file `goals/fe-be-integration-audit/tools/extract-procedures.ts`.
- **Action**: Use `ts-morph` or regex over `packages/api/src/routers/**/*.{ts,tsx}` to extract:
  - Procedure full path (e.g. `equipment.equipment.assign`, `compliance.classification.recompute`).
  - Type: `.query()` vs `.mutation()` vs `.subscription()`.
  - Source file + line.
  - Middleware stack (publicProcedure / protectedProcedure / tenantProcedure / portalProcedure) for context.
  - Verb category: destructive (delete, remove, archive, revoke, cancel, disconnect, unassign) vs non-destructive.
- **Output**: `goals/fe-be-integration-audit/data/procedures.json`.
- **Verification**: `pnpm tsx goals/fe-be-integration-audit/tools/extract-procedures.ts` produces JSON; manually spot-check 5 known procedures (e.g. `equipment.equipment.list`, `finance.invoice.create`); count should be ≥ 232 mutations.

### Step 2 — Build FE call-site inventory script

- **Touches**: new file `goals/fe-be-integration-audit/tools/extract-fe-callers.ts`.
- **Action**: Walk `apps/web/src`, `apps/public-api/src`, `apps/landing/src` (all `.ts`, `.tsx`, exclude `__tests__`, `node_modules`, `.next`, `.planning`). Extract:
  - Every `trpc.<dotted.path>.{useMutation|mutationOptions|useQuery|queryOptions|useSuspenseQuery}` reference.
  - The enclosing function/component name + file + line.
  - For mutations: detect presence of `onSuccess`, `onError`, `toast.success`, `toast.error`, `invalidateQueries`, `isPending`, `disabled`, surrounding `AlertDialog`.
- **Output**: `goals/fe-be-integration-audit/data/fe-callers.json`.
- **Verification**: count of mutation call sites ≥ 100 (rough lower bound — there are 232 BE mutations and many have 1+ caller); spot-check the `apps/web/src/components/equipment/` directory.

### Step 3 — Build cross-join + finding generator

- **Touches**: new file `goals/fe-be-integration-audit/tools/generate-findings.ts`.
- **Action**: Load both JSONs. Emit findings:
  - **Orphan**: procedure ∈ procedures.json but path ∉ fe-callers.json → category by verb (HIGH if destructive, MED if not).
  - **Missing onError toast**: mutation caller without `toast.error` in `onError` handler → MED.
  - **Missing onSuccess toast**: mutation caller without `toast.success` in `onSuccess` → MED.
  - **Missing invalidation**: mutation caller without `invalidateQueries` in `onSuccess` → MED (HIGH if list/index procedure clearly affected).
  - **Missing confirmation**: destructive mutation call site without surrounding `AlertDialog` / `confirm()` → HIGH.
  - **Missing loading state**: trigger element without `disabled={mutation.isPending}` → LOW.
- **Output**: `goals/fe-be-integration-audit/data/findings.json` + drafted `AUDIT.md`.
- **Verification**: every finding has a stable ID (e.g. `F-HIGH-001`), file path + line, problem, fix. AUDIT.md renders cleanly.

### Step 4 — Manual triage of "intentional non-UI" orphans

- **Touches**: `AUDIT.md` (mark column).
- **Action**: For each orphan, search non-FE call sites: `apps/public-api/src` route handlers, `packages/*/src` queue/job code, webhook handlers, public-api consumers, cron scripts under `scripts/`. If a procedure is invoked by a job/webhook/public-api route, flag it as "intentional non-UI" and move to appendix.
- **Verification**: appendix lists each intentional orphan with caller location; remaining orphan list is true orphans only.

### Step 5 — Approve AUDIT.md gate

- **Touches**: `goals/fe-be-integration-audit/AUDIT.md`.
- **Action**: Run `plannotator annotate goals/fe-be-integration-audit/AUDIT.md --gate`. User reviews + approves before fixes begin (sanity check on extraction accuracy, severity calls).
- **Verification**: gate returns approved.

### Step 6 — Apply HIGH fixes

- **Touches**: scoped to each finding's file. Typical edits:
  - Add `AlertDialog` wrap around destructive triggers.
  - Add missing `onError: (err) => toast.error(err.message)`.
  - Add missing `onSuccess` invalidation for known-stale views.
- **Verification per fix**: `pnpm --filter @contractor-ops/web typecheck` passes; affected component still renders (manual smoke on critical flows via dev server).
- **Commit**: one per finding, message format `fix(audit): F-HIGH-NNN <one-line desc>`.

### Step 7 — Apply MED fixes

- **Touches**: same shape as Step 6. Mostly toast + invalidation additions.
- **Batching**: MED fixes affecting the same component file may be combined into one commit when atomic-per-finding would create churn (e.g. add `onSuccess` + `onError` together).
- **Verification**: `pnpm run typecheck` passes after each commit.

### Step 8 — Apply LOW fixes

- **Touches**: loading/disabled state additions.
- **Verification**: same as above.

### Step 9 — Final verification gate

- **Touches**: none (read-only checks).
- **Action**:
  - Re-run extract-fe-callers → confirm zero remaining HIGH/MED gaps.
  - `pnpm run typecheck` (root).
  - `pnpm run lint` (root).
  - `pnpm run test` on packages with affected mutations.
- **Verification**: all commands green; AUDIT.md updated with "Fixed" markers per finding.

## Risks & open questions

- **Extraction false negatives**: regex/AST may miss dynamically constructed tRPC paths (e.g. `const proc = condition ? trpc.a.b : trpc.c.d`). Mitigation: run extractor twice with relaxed + strict modes, diff results, manually review the delta.
- **Orphan false positives**: a procedure may be called via `caller()` (server-side tRPC caller) from a server component or route handler — these won't match the `trpc.<path>.use*` regex. Step 4 catches these but only for the documented patterns; obscure callers may slip through. Mitigation: also grep `appRouter.<path>` and `caller.<path>` patterns.
- **Invalidation detection accuracy**: detecting "correct" invalidation is fuzzy — a mutation may legitimately not need to invalidate anything (e.g. fire-and-forget logging). Plan: flag, don't auto-fix; let triage step (5) mark false positives as "intentional".
- **AlertDialog convention not universal**: some destructive flows use a multi-step wizard or a typed-confirmation modal. The auto-fix should not over-wrap. Plan: extractor flags presence of *any* dialog-like wrapper (`AlertDialog`, `Dialog`, `ConfirmDialog`, custom `confirm()` hook); only true unguarded cases become HIGH.
- **Better Auth flows**: login/logout/passkey flows have custom UX patterns. Likely many "missing toast" false positives here. Plan: keep them in findings but pre-tag with `auth-flow` so reviewer can bulk-mark as intentional in Step 5.
- **Volume of findings**: realistic estimate is 100–400 findings. If above ~200 the per-commit overhead is painful. Mitigation: allow batched commits within a single component file for same-severity fixes.
- **i18n**: app uses `next-intl`. New toast strings should land in `packages/ui` translations. If untranslated, add `// TODO: i18n` and emit a follow-up finding rather than blocking the fix.
- **public-api app shape**: `apps/public-api` does not consume tRPC the same way as `apps/web` (it's a REST surface). The FE caller extractor must handle its different import pattern — likely it imports `appRouter.createCaller()` directly. Plan: detect that pattern explicitly in Step 4.
- **landing app**: `apps/landing` is marketing. Likely zero tRPC usage. Confirm with one grep before spending extractor time on it.
