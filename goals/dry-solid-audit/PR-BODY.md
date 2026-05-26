# DRY / SOLID audit — extract shared modules

Branch: `dry-solid-audit/extract-shared` → `main`.

## What changed

Single PR carrying the audit catalogue (`goals/dry-solid-audit/audit.md`) plus mechanical extractions of duplicated, non-trivial logic across the four audit categories (utilities, React hooks/components, tRPC patterns, Prisma/DB patterns). 108 call-site migrations across 4 extracted clusters; 4 clusters SKIPPED after inspection revealed the audit catalogue overestimated extractable duplication.

## Per-cluster outcome (final scores)

| Cluster | Outcome | Sites | Net LOC |
|---------|---------|-------|---------|
| A — Cursor pagination | EXTRACTED | 13 migrated, 3 keyset SKIPPED | –64 |
| B — Money formatters | EXTRACTED (Group X + Z) | 24 migrated, 11 SKIPPED (Group Y) | –9 |
| C — Date/time formatters | SKIPPED | 0 — per-site Intl patterns vary too much |
| D — Adopt `useResourceMutation` | EXTRACTED | 21 migrated, 4 SKIPPED | –68 |
| E — `findOrThrow` helper | EXTRACTED | 50 migrated, ~15 SKIPPED | –33 |
| F — Service-error mapper | SKIPPED | 0 — no cross-file duplication |
| G — `softDeleteWithAudit` | SKIPPED | 0 — shared core is one line |
| H — `QueryStateView` | SKIPPED | 0 — shape-only duplication |

**Totals**: 108 sites migrated · ~33 SKIPPED with documented per-site rationale · ~174 net LOC removed.

## New shared modules

- `packages/api/src/lib/pagination.ts` — four cursor helpers preserving both "last-kept" and "extra-row" semantics (the latter is a one-row-per-page leak bug preserved bit-for-bit; flagged for follow-up).
- `packages/api/src/lib/find-or-throw.ts` — lambda-based wrapper around `findFirst` + `NOT_FOUND` throw.
- `packages/shared/src/money.ts` — adds `formatMinorAsCurrency(amount, currency, locale?, fractionDigits = 2)`.

## Adopted existing modules (no new code)

- `apps/web-vite/src/hooks/use-resource-mutation.ts` — 21 hand-rolled mutations migrated to this existing helper.
- `apps/web-vite/src/lib/format-currency.ts` — 17 local re-implementations replaced by imports of `formatMinorUnits` / `formatAmount`.

## Dependency change

`apps/web-vite/package.json` gains `@contractor-ops/shared` (workspace). `pnpm-lock.yaml` updated. CI typecheck/test paths build `shared` via turbo's `^build`; dev mode requires `pnpm build` on shared once after pulling — same workflow as the existing `packages/ui` dependency.

## Why some clusters SKIPPED

Each SKIP is justified per `facts.md` anti-goals (no premature generalisation, no abstraction without 2+ shared-logic call sites). Common pattern:

- **Cluster C, F, G, H, B Group Y**: the duplication is shape-similar (same `Intl.X` / `switch (code)` / `?.update + audit + cleanup` shape) but logic-different (per-site thresholds, fraction digits, side-effects, visual details). A shared helper would either pass everything through as options — no DRY win — or impose a single style across all sites — a UX/behaviour change, out of scope per facts.md non-goals.

Full evidence per cluster: see `goals/dry-solid-audit/audit.md`.

## Behaviour-preservation notes

- **Step 1 (cursor pagination)**: two original semantics preserved exactly. The "extra-row" sites (peppol, time×2, einvoice, invoice-intake, reassessment-trigger, economic-dependency-alert, integration×2) ship the same one-row-per-page leak as before. Documented in `pagination.ts` for a future cleanup PR.
- **Step 4 (`useResourceMutation`)**: helper awaits invalidate before firing toast. Original sites used `void queryClient.invalidateQueries(...)` (fire-and-forget) then toast. Net: user sees toast slightly later. Imperceptible in practice; consistent with the 8 pre-existing adopters of the helper.
- **Step 4 (`useApprovalActions`)**: outer `onSuccess?.()` callback relocated from "after toast" to "before invalidate + toast". Worth smoke-testing the approval queue flows.
- **Step 5 (`findOrThrow`)**: identical TRPCError code (NOT_FOUND), same message string, same throw timing.

## Pre-existing baseline fix (bundled to unblock typecheck)

35 TS errors in `apps/web-vite/src/components/contractors/{classification,hooks}/` blocked `pnpm typecheck`. Root cause: `packages/api/src/root.ts` registered the eight classification namespaces via `...(CLASSIFICATION_ENABLED ? {...} : {})`, which let TS infer every namespace as `T | undefined` on the `AppRouter` type.

Proper fix (commit `9de08eaa`): lifted the classification routers into a typed const + cast the disabled branch (`{} as typeof classificationRouters`). Type now includes every namespace unconditionally; runtime remains identical (empty object when flag off — `METHOD_NOT_FOUND` at the tRPC layer, `classificationProcedure` middleware as defense-in-depth per D-06).

13 contractor hook + wizard files had 41 transitional `trpc.X!.foo` non-null assertions from the prior unblock commit (`ea833053`); commit `9de08eaa` drops those assertions back to plain `trpc.X.foo` now that the type carries the namespaces unconditionally.

## Verification

- `pnpm typecheck`: 41/41 tasks pass — monorepo CLEAN.
- `pnpm --filter=@contractor-ops/api test`: 241 files / 3147 tests pass, 5 todo.
- `pnpm --filter=@contractor-ops/shared test`: 47 tests pass.
- `pnpm --filter=@contractor-ops/web-vite test` (scoped per `feedback_test_run_memory`): 606 files / 4205 tests pass, 3 skipped.
- `pnpm lint`: 40/40 tasks pass.
- `pnpm exec biome check apps packages scripts goals`: 0 errors (1084 warnings pre-existing).
- `pnpm check:web-vite-data-layer`: OK.

## Commits

One commit per cluster, in order:

1. `611b3ef5` Step 0 — audit catalogue
2. `fe50cc52` Step 1 — cursor pagination helpers
3. `6b715a86` Step 2 — money formatters
4. `f02d1163` Step 3 — SKIP (date formatters)
5. `1bb079c7` Step 4 — adopt useResourceMutation
6. `06fbeafe` Step 5 — findOrThrow helper
7. `efa8d533` Step 6 — SKIP (service-error mapper)
8. `fd10c2b2` Step 7 — SKIP (softDeleteWithAudit)
9. `7f81a3f7` Step 8 — SKIP (QueryStateView)
10. `ea833053` Step 9 — typecheck baseline fix (transitional `!` assertions)
11. `0d6b0087` Step 10 — PR body draft
12. `e01424d1` Step 10 — goal Done condition reworded
13. `9de08eaa` Follow-up — hoist classification routers, drop `!` band-aids

## Out of scope / explicitly NOT touched

- No new tests for previously-untested paths (per facts.md non-goal).
- No router restructuring or tRPC public route renames.
- No performance optimisation beyond what naturally falls out of deduplication.
- No third-party dep added solely to support a refactor.
- The other-agent i18n work on this branch (`packages/api/src/errors.ts` + `init.ts` + `apps/web-vite/messages/*.json`) is left uncommitted in the working tree for that workstream to land separately.

## Follow-ups (filed implicitly via audit.md)

- Converge the 7 "extra-row" cursor-pagination sites onto the bug-free `paginateByLastKept` convention.
- Promote `apps/web-vite/src/hooks/use-resource-mutation.ts` into `packages/ui` once its web-vite-flavoured imports are decoupled.
- Revisit Clusters C / F / G / H if a second app starts needing the same patterns or the runtime threshold conventions converge across sites.
