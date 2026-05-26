# DRY / SOLID Audit — Plan

## Solution approach

The work is split into two passes:

1. **Audit pass (read-only)** — walk the monorepo across the four categories from `facts.md` (utils, components/hooks, tRPC patterns, Prisma/DB patterns), record every cluster with concrete file/line evidence and a proposed extraction target, and write the result to `goals/dry-solid-audit/audit.md`. No source edits.
2. **Extraction pass (single PR)** — for every cluster the audit marks `EXTRACTED`, land the new shared module + migrate every call site in **one** branch, one PR. The PR opens only after the whole repo type-checks, every touched package tests green, and lint/Biome are clean.

Each cluster is wrapped in its own commit on the branch so the diff stays reviewable, but the user receives one merged-up PR per the spec.

## Clusters identified by the audit pass

The following clusters were surfaced during planning and seed the audit. The audit pass may add or drop entries as deeper reading confirms or refutes them.

### A. Cursor pagination — `packages/api/src/routers/**`
- Pattern: `take: limit + 1` → trim → `nextCursor = trimmed[last]?.id`.
- Confirmed in: `core/audit.ts:148–188`, `core/cost-center.ts:20–59`, `core/team.ts:21–66`, `core/project.ts:31–77`, `core/integration.ts:361–402`, `finance/payment.ts:1306–1345`, `finance/invoice-intake.ts:251–289`.
- Target: `packages/api/src/lib/pagination.ts` exporting `paginateByCursor({ findMany, where, orderBy, cursor, limit })` and an offset variant for `core/audit.ts`.
- Why: 7 verbatim copies; off-by-one and skip-the-cursor logic is a known foot-gun and a single bug-fix surface.

### B. Money / minor-unit formatting — `apps/web-vite`, `apps/landing`, `packages/shared`
- Pattern: `Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100)`.
- Confirmed in: `apps/web-vite/src/lib/format-currency.ts:1–25` (`formatMinorUnits`, `formatAmount`), `apps/landing/src/lib/pricing-types.ts:74–89` (`formatPrice`), `apps/web-vite/src/components/contractors/hooks/use-contractor-tab-payments.ts:63–83` (inline), `apps/web-vite/src/components/invoices/intake/intake-list.tsx:31–70` (`formatTotalMinor`).
- Existing partial home: `packages/shared/src/money.ts` (`formatMoney`, `minorToDecimalStr`).
- Target: extend `packages/shared/src/money.ts` with a thin `formatMinorUnits(minor, currency, locale)` and `formatPriceMinor(...)` that wraps the same Intl call, and migrate the four locations to import from `@contractor-ops/shared`.
- Why: silent drift (`pl-PL` hard-coded in one place, undefined locale in another).

### C. Date / time formatting — `apps/web-vite`
- Pattern: `Intl.DateTimeFormat(locale, …)` and ad-hoc relative-date helpers.
- Confirmed in: `apps/web-vite/src/lib/format-date.ts:58–95`, `apps/web-vite/src/i18n/useFormatter.ts:88–122`, `apps/web-vite/src/lib/format-relative-date.ts:1–15`, inline use in `apps/web-vite/src/components/contractors/classification/drv-clearance/drv-clearance-row.tsx:51–77` and `apps/web-vite/src/components/settings/hooks/use-org-settings-form.ts:96–171` (months/countries via `Intl.DisplayNames`/`Intl.DateTimeFormat`).
- Target: consolidate the framework-agnostic helpers into `packages/shared/src/datetime.ts` (formatters + relative-date) and keep `useFormatter` / `useDateFormatter` as thin React adapters around it. Move the country list + `getMonths` helper to `packages/shared/src/locale-lists.ts`.
- Why: every web-vite component currently makes its own locale decision; centralising the BCP-47 mapping is a single source of truth.

### D. `useResourceMutation` adoption — `apps/web-vite/src/hooks`, `apps/web-vite/src/components/**/hooks`
- Pattern: `useMutation({ onSuccess: toast.success + invalidate, onError: toast.error })` written by hand.
- The helper already exists at `apps/web-vite/src/hooks/use-resource-mutation.ts:19–50` but most hooks don't use it.
- Migrate: `use-template-mutations.ts`, `use-approval-actions.ts`, `components/workflows/hooks/use-workflow-ui.ts`, `components/contractors/classification/hooks/use-drv-clearance.ts`, `components/payments/hooks/use-payment-run-step-review.ts`, `components/equipment/hooks/use-equipment-detail-actions.ts`, `components/admin/hooks/use-admin-boe-rate.ts`, `components/payments/hooks/use-bank-statement-import.ts`, and any other matches surfaced by the audit pass.
- Target: no new code — adopt the existing helper. Add an integration test in `packages/test-utils` if one is missing.
- Why: SOLID — keep one boundary; today the helper exists but parallel copies are bypassing it.

### E. "Find-or-throw" tRPC helper — `packages/api/src/routers/**`
- Pattern: `const x = await ctx.db.X.findFirst({ where: { id, organizationId, deletedAt: null } }); if (!x) throw new TRPCError({ code: 'NOT_FOUND', message: E.X_NOT_FOUND });`
- Seen in: `core/contract.ts`, `core/document.ts`, `core/approval.ts` (`validateStepForAction`), `equipment/equipment-returns.ts`, many more — the audit pass enumerates them.
- Target: `packages/api/src/lib/find-or-throw.ts` exporting `findOrThrow(model, { where, errorMessage })` returning the row; tenant scoping continues to come from `ctx.db`.
- Why: error-message consistency, easier to add observability hooks centrally.

### F. tRPC service-error → `TRPCError` mapping
- Pattern: a `switch (err.code)` mapping service error codes to `TRPCError` codes.
- Seen in: `routers/finance/invoice-intake.ts:108–149`, similar mappings in `services/jira-issue-sync.ts:482–507`, `services/jira-worklog-sync.ts:413–454`.
- Target: `packages/api/src/lib/service-error-mapper.ts` exporting `mapServiceError(err, map)` and a re-export of the `TRPC_TO_HTTP` table from `apps/public-api/src/lib/error-handler.ts:1–46` so the public-api stops carrying its own copy.
- Why: today the mapping table is duplicated between the tRPC layer and the public-api handler — drift waiting to happen.

### G. Soft-delete + audit-log resource pattern — `packages/api/src/routers/**`
- Pattern: `findFirst({ deletedAt: null })` → `NOT_FOUND` → `update({ deletedAt: now })` → `writeAuditLog(...)` → side-effect cleanup.
- Seen in: `core/contract.ts:628–677`, `core/document.ts:600–655`, etc.
- Target: `packages/api/src/lib/soft-delete-resource.ts` exporting `softDeleteWithAudit({ model, id, organizationId, audit, sideEffects })`. Side-effects stay caller-defined to preserve cleanup specificity (R2 delete, calendar cleanup, etc.).
- Risk note: each delete has bespoke side effects; the helper must accept them as opaque callbacks and not try to enumerate them.

### H. Skeleton / Error+Retry blocks — `apps/web-vite/src/components/**`
- Pattern: grid of `Skeleton`s + `RefreshCw` retry button. Seen in `components/billing/usage-dashboard.tsx:66–105`, `components/invoices/intake/intake-list.tsx:31–70`.
- Existing primitive: `packages/ui/src/components/workbench/empty-state.tsx` (`AtelierEmptyState`).
- Target: add `QueryStateView` wrapper in `packages/ui/src/components/workbench/query-state-view.tsx` (`{ isLoading, isError, onRetry, skeleton, children }`) that codifies the loading/error/empty/data branches the web-vite container layer already calls out (`apps/web-vite/ARCHITECTURE.md`).
- Why: every container reinvents this; the spec already expects a uniform surface.

### I. Slug generation — defer
- Single TS callsite (`apps/cms/src/lib/slugify.ts`) plus a Python script. Below the 2+ TS threshold. Marked `DEFERRED (no second TS call site)`.

## Ordered steps

Each step lives in its own commit. The branch is `dry-solid-audit/extract-shared`.

### Step 0 — branch + audit doc
- **Action**: `git switch -c dry-solid-audit/extract-shared`; write `goals/dry-solid-audit/audit.md` with the full cluster catalogue (clusters A–I above, expanded with every call site found during a second semble pass), each cluster scored `EXTRACTED | SKIPPED | DEFERRED` with a one-line rationale.
- **Files touched**: `goals/dry-solid-audit/audit.md`.
- **Verification**: doc reviewed; no source files changed; `git status` shows only the new doc.

### Step 1 — Cluster A: cursor pagination helper
- **Action**: add `packages/api/src/lib/pagination.ts`. Migrate `core/audit.ts`, `core/cost-center.ts`, `core/team.ts`, `core/project.ts`, `core/integration.ts`, `finance/payment.ts`, `finance/invoice-intake.ts`.
- **Files touched**: 1 new + 7 routers.
- **Verification**: `pnpm typecheck --filter=@contractor-ops/api`; `pnpm --filter=@contractor-ops/api test`.

### Step 2 — Cluster B: money formatters
- **Action**: extend `packages/shared/src/money.ts`. Delete `apps/web-vite/src/lib/format-currency.ts` (or shrink to a re-export). Migrate `apps/landing/src/lib/pricing-types.ts`, the two inline web-vite sites, and the inline `intake-list.tsx`.
- **Files touched**: 1 edit + 4 migrations + 1 deletion.
- **Verification**: `pnpm typecheck --filter=@contractor-ops/shared --filter=@contractor-ops/web-vite --filter=@contractor-ops/landing`; `pnpm --filter=@contractor-ops/shared test`; `pnpm --filter=@contractor-ops/web-vite test src/lib/__tests__` (scoped — never full suite per `feedback_test_run_memory`).

### Step 3 — Cluster C: date/time formatters
- **Action**: move pure helpers from `apps/web-vite/src/lib/format-date.ts` + `format-relative-date.ts` into `packages/shared/src/datetime.ts`; rewrite the originals as thin re-exports; keep `useFormatter` + `useDateFormatter` + `usePortalDateFormatter` as React adapters that consume the core. Add `packages/shared/src/locale-lists.ts` for country/month lists.
- **Files touched**: 2 new + 4 edits.
- **Verification**: same scope as Step 2.

### Step 4 — Cluster D: adopt `useResourceMutation` across web-vite hooks
- **Action**: refactor the eight mutation hooks listed above to call `useResourceMutation`. No new public API.
- **Files touched**: 8 hook files.
- **Verification**: `pnpm typecheck --filter=@contractor-ops/web-vite`; `pnpm --filter=@contractor-ops/web-vite test src/hooks src/components/**/hooks` (scoped paths).

### Step 5 — Cluster E: `findOrThrow` helper
- **Action**: add `packages/api/src/lib/find-or-throw.ts`. Migrate the call sites the audit pass enumerated.
- **Files touched**: 1 new + ~10–15 router edits.
- **Verification**: `pnpm typecheck --filter=@contractor-ops/api`; `pnpm --filter=@contractor-ops/api test`.

### Step 6 — Cluster F: service-error mapper + shared `TRPC_TO_HTTP` table
- **Action**: add `packages/api/src/lib/service-error-mapper.ts` + `packages/api/src/lib/trpc-http-status.ts`. Migrate `routers/finance/invoice-intake.ts` and `apps/public-api/src/lib/error-handler.ts`.
- **Files touched**: 2 new + 2 edits.
- **Verification**: `pnpm typecheck --filter=@contractor-ops/api --filter=@contractor-ops/public-api`; `pnpm --filter=@contractor-ops/api test`; `pnpm --filter=@contractor-ops/public-api test`.

### Step 7 — Cluster G: `softDeleteWithAudit` helper
- **Action**: add `packages/api/src/lib/soft-delete-resource.ts`. Migrate `core/contract.ts` delete, `core/document.ts` delete, plus any further sites the audit surfaces.
- **Files touched**: 1 new + ~3–5 router edits.
- **Verification**: `pnpm typecheck --filter=@contractor-ops/api`; `pnpm --filter=@contractor-ops/api test`.

### Step 8 — Cluster H: `QueryStateView` primitive
- **Action**: add `packages/ui/src/components/workbench/query-state-view.tsx` + export. Migrate `usage-dashboard.tsx` and `intake-list.tsx`.
- **Files touched**: 1 new + 2 migrations.
- **Verification**: `pnpm typecheck --filter=@contractor-ops/ui --filter=@contractor-ops/web-vite`; `pnpm --filter=@contractor-ops/ui test`.

### Step 9 — full-repo guard
- **Action**: run the whole-repo gates.
- **Verification**:
  - `pnpm typecheck` — must be clean (CI-canonical tsc, per `feedback_ci_typecheck_tool`).
  - `pnpm test` — turbo across touched packages; for `web-vite` the per-step scoped commands already ran, so no separate unscoped invocation here.
  - `pnpm lint` and `pnpm biome check` — must be clean.
  - `pnpm check:web-vite-data-layer` — runs the container/hooks boundary checker if Step 4 touched containers.

### Step 10 — PR
- **Action**: open one PR off `dry-solid-audit/extract-shared` against `main`. PR body lists the audit cluster table from `audit.md` (EXTRACTED/SKIPPED/DEFERRED) and the verification commands run.
- **Verification**: CI green; reviewer sees one commit per cluster.

## Risks and open questions

1. **`useResourceMutation` is web-vite-local but the pattern is everywhere.** Migrating to the existing helper is safe; promoting it into `packages/ui` would require it to drop the `web-vite`-flavoured imports. Decision recorded for the audit pass — default is "keep in web-vite for now, mark a follow-up for promotion".
2. **`softDeleteWithAudit` callback signature must not couple to one router.** If two of the targeted routers have a side-effect that can't be reduced to "fire-and-forget after audit", the helper will be skipped for that site (`SKIPPED — bespoke ordering`) rather than forcing the abstraction.
3. **Test debt.** `packages/api` has the known test-cleanup handoff from 2026-04-27 (`.planning/handoffs/test-cleanup-2026-04-27.md`). The audit pass will run `pnpm --filter=@contractor-ops/api test` once on `main` first to record the baseline; the PR only needs to not regress that baseline, not to fix pre-existing failures.
4. **Public-api `TRPC_TO_HTTP` move-out.** The public-api currently owns the table; moving it into `packages/api` adds a cross-package dep `public-api → api`. Verify that dep is already permitted in `pnpm-workspace.yaml` topology before Step 6; if not, the table stays in `apps/public-api` and is re-exported from a barrel rather than relocated.
5. **No new third-party dependency** is introduced by any cluster. Confirmed for clusters A–I — all use `Intl`, `@trpc/server`, `@contractor-ops/db`, `@contractor-ops/logger`, or existing helpers.
6. **One-big-PR cost.** The user chose a single PR. If the audit pass uncovers >20 clusters, re-confirm the slicing decision before Step 10 — at some scale a single PR becomes un-reviewable. Trigger threshold for re-confirmation: more than 30 files changed across all clusters.
