# Plan — web-vite container pattern enforcement

## Baseline (verified 2026-05-25)

- `pnpm --filter @contractor-ops/web-vite check:data-layer` — **PASS**
- `pnpm --filter @contractor-ops/web-vite check:page-shells` — **PASS**
- `pnpm check:web-vite-presentational` — **PASS**
- 67 pages under `apps/web-vite/src/pages/**`; 299 `*-container.tsx`; 265 `use-*.ts` domain hooks.
- Hook tests exist only for `billing`, `layout/__tests__`, `search/__tests__`, and shared hooks (`use-resource-mutation`, `use-permissions`). The remaining ~260 hooks have no colocated specs.

**Implication:** static gates already pass; the real work is qualitative — extracting inline logic from containers into hooks, normalizing hook return shapes (props bag, not raw query), and adding vitest specs covering loading/empty/error/success per hook. Static checks are the **final gate**, not the discovery tool.

## Solution approach

1. Catalogue every domain folder under `apps/web-vite/src/components/`.
2. Dispatch one subagent per domain, capped at 4 concurrent. Each agent uses the same prompt template (below) and is told its **only** writable scope.
3. Agents commit atomically per domain. Cross-domain dependencies are recorded in the agent summary, not actioned mid-run.
4. After all per-domain agents finish, dispatch a single **leftover-audit agent** that runs all static checks, sweeps for heuristic violators below the static radar, and lists unresolved cross-domain dependencies.
5. Findings from the leftover-audit dispatch a final fix wave (also max 4 parallel).
6. Run the full CI gate once at the end. Goal is done only when the gate is green.

## Agent prompt template (per domain)

```
You own apps/web-vite/src/components/<DOMAIN>/ end-to-end. Do not edit anything outside this folder; record cross-domain dependencies in your summary instead.

Read first (in this order):
- apps/web-vite/ARCHITECTURE.md
- apps/web-vite/src/components/billing/__tests__/use-billing.test.ts (test pattern reference)
- apps/web-vite/src/components/contractors/contractor-list-container.tsx + hooks/use-contractor-list.ts (reference impl)

Steps:
1. Audit every *-container.tsx and component .tsx in your folder. For each:
   - Does the page that consumes it match the page-shell rule?
   - Does the container import only hooks + render JSX (no inline filter derivation, no inline mutation handlers, no inline toast wiring)?
   - Does the hook return a props bag + flags, not raw query objects?
   - Is logic that belongs in a hook currently in the container or a component?
2. For each violation, extract the logic into the existing `hooks/use-*.ts` or create a new one. Container becomes JSX wiring only.
3. Replace any Suspense fallback that is a generic spinner with a section-appropriate skeleton/shimmer that matches the legacy UX (PageLoadingSpinner stays only where it was used before).
4. For every hook you touch or create, add a colocated vitest spec under `__tests__/use-<name>.test.ts` covering: loading, empty, error, success. For mutation hooks also cover: optimistic state (if applicable), invalidation calls, and toast emission. Use the billing/use-billing.test.ts test harness pattern.
5. Run scoped checks before committing:
   - `pnpm --filter @contractor-ops/web-vite test -- src/components/<DOMAIN>`
   - `pnpm typecheck --filter @contractor-ops/web-vite`
6. Commit atomically per logical change. Conventional Commits, scope = `web-vite/<DOMAIN>`. Examples:
   - `refactor(web-vite/contractors): extract list logic to hook`
   - `test(web-vite/contractors): cover use-contractor-list states`

Return a caveman-compressed summary:
- files changed (count + paths)
- hooks created / refactored
- containers slimmed
- skeleton fallbacks introduced
- cross-domain dependencies (path + reason)
- scoped check results
```

## Ordered steps

1. **Wave 0 — preflight (main thread, no agents).**
   - Re-run baseline checks; capture output to `goals/web-vite-container-pattern/baseline.log` for diffing later.
   - Verify: `cat goals/web-vite-container-pattern/baseline.log` shows the 3 OK lines.
2. **Wave 1 — domain agents.** Dispatch in queues of 4. Domain order (largest first, so the long tail finishes near the end):
   - Tier A: `settings` (63c/50h), `contractors` (39c/31h), `invoices` (24c/29h), `portal` (20c/20h)
   - Tier B: `workflows` (20c/15h), `integrations` (16c/16h), `zatca` (13c/14h), `contracts` (11c/18h)
   - Tier C: `equipment` (11c/9h), `payments` (10c/11h), `organization` (10c/10h), `admin` (7c/1h)
   - Tier D: `billing` (6c/2h), `onboarding` (6c/1h), `legal` (6c/2h), `documents` (4c/5h)
   - Tier E: `approvals` (4c/4h), `auth` (4c/0h), `layout` (4c/5h), `time` (4c/5h)
   - Tier F: `peppol` (3c/1h), `classification` (2c/2h), `einvoice` (2c/2h), `notifications` (2c/2h)
   - Tier G: `consent` (1c/1h), `dashboard` (1c/1h), `import` (1c/1h), `ocr` (1c/1h)
   - Tier H: `reports` (1c/5h), `search` (1c/1h), `shared` (1c/0h), `offboarding` (0c/0h)
   - Tier I: `workflow` (0c/0h), `wht` (0c/0h)
   - Verify per agent: agent's scoped vitest + typecheck pass; commit graph shows only files under that domain.
3. **Wave 2 — leftover-audit agent (single agent, isolated context).**
   - Re-run all 3 static checks, full `pnpm --filter @contractor-ops/web-vite test`, full `pnpm typecheck --filter @contractor-ops/web-vite`.
   - Sweep for heuristic gaps the static checks miss:
     - Hooks returning raw `UseQueryResult` / `UseMutationResult` (grep return signatures).
     - Containers >120 LOC (probable un-extracted logic).
     - Hooks under `components/**/hooks/` without a colocated `__tests__/use-*.test.{ts,tsx}` neighbour.
     - Pages still passing `<PageLoadingSpinner />` where the legacy UI showed a skeleton.
     - Unresolved cross-domain dependencies surfaced by Wave 1 summaries.
   - Output `goals/web-vite-container-pattern/leftover-report.md` with findings grouped by domain.
   - Verify: `goals/web-vite-container-pattern/leftover-report.md` exists and is non-empty (even if just a header confirming zero findings).
4. **Wave 3 — fix wave (max 4 parallel).**
   - One agent per domain that has leftover findings. Same prompt template, scoped to leftover-report items.
   - Verify per agent: scoped checks pass; commit graph shows only files under the assigned domain.
5. **Wave 4 — final CI gate (main thread).**
   - `pnpm --filter @contractor-ops/web-vite check:data-layer`
   - `pnpm --filter @contractor-ops/web-vite check:page-shells`
   - `pnpm check:web-vite-presentational`
   - `pnpm typecheck --filter @contractor-ops/web-vite`
   - `pnpm --filter @contractor-ops/web-vite test`
   - `rg "useTRPC\(\)" apps/web-vite/src --glob '!**/hooks/**' --glob '!**/providers/**'` returns no matches.
   - Verify: all 6 commands exit 0 / report no matches.

## Files / systems touched

- `apps/web-vite/src/components/<domain>/**` — read + write per agent scope.
- `apps/web-vite/src/components/<domain>/__tests__/use-*.test.ts` — new specs.
- `apps/web-vite/src/pages/**` — only when the page shell still violates (rare; static check is green at baseline).
- `goals/web-vite-container-pattern/baseline.log` — preflight snapshot.
- `goals/web-vite-container-pattern/leftover-report.md` — Wave 2 output.
- No edits to `packages/**`, `apps/web/**`, `apps/cms/**`, `apps/landing/**`, scripts under `scripts/**`, or Prisma schema.

## Risks / open questions

- **Hook test harness gap.** The existing pattern at `billing/__tests__/use-billing.test.ts` tests **pure derivations** (exported alongside the hook), not the hook itself via `renderHook`. Mutation/invalidation coverage requires wiring `@testing-library/react`'s `renderHook` plus a `QueryClientProvider` + mocked tRPC client. **Mitigation:** the first Tier-A agent (`settings`) lands a reusable test harness under `apps/web-vite/src/test-utils/render-hook.tsx` and the rest of the agents import it. Open question: should the harness mock tRPC at the link level (`httpBatchLink` overridden) or via `createTRPCClient` stub?
- **"Inline logic" is subjective.** Hard to define an automated metric. **Mitigation:** the agent prompt forces an explicit per-file checklist (filter derivation, mutation handler, toast wiring); the leftover-audit agent re-checks with LOC heuristic (>120 lines triggers a flag).
- **Cross-domain churn.** Some hooks (`use-contractor-query`) are imported across domains. **Mitigation:** treat `shared/` and `layout/` as last (Tier H/E); agents in earlier tiers record any cross-domain rename request in summary; main thread batches them into a single shared-domain agent before Wave 2.
- **Skeleton fallback authoring.** Replacing `PageLoadingSpinner` with section skeletons may require new presentational components. **Mitigation:** agents reuse existing skeleton primitives from `packages/ui` where available; net-new skeletons are tiny presentational components and are out of scope for tests.
- **`offboarding`, `workflow`, `wht` are empty domains (0c/0h).** They may be placeholders or routes wired elsewhere. **Mitigation:** agent for each spends ≤5 min confirming the folder is empty and reports back; no commits.
- **Test runtime.** Adding ~260 hook specs will lengthen `pnpm test` significantly. **Mitigation:** keep each spec <1s (no real network, light setup); rely on vitest's parallel runner; revisit `vitest.config.ts` pool settings if total runtime exceeds 90s.
- **Agent budget.** 34 domain agents + leftover-audit + N fix agents. **Mitigation:** caveman-compressed summaries keep main-thread context lean; main thread re-runs nothing it already delegated.
