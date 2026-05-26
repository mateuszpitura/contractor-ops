# DRY / SOLID Audit — Cluster Catalogue

> Read-only pass surfacing duplicated, non-trivial logic across `apps/*` and `packages/*`.
> Scope, threshold, extraction targets, behaviour-preservation rules: see [`facts.md`](./facts.md).
> Ordered execution plan: see [`plan.md`](./plan.md).
>
> **Verification baseline:** branch `dry-solid-audit/extract-shared` off `main` at the post-cleanup state (commits `62a97d73`, `e320911b`, `2dc8c5c8`, `bf742ca9`, `d1571a02`, `7ce609d1`). Evidence below was reconfirmed against the current tree, **not** copied from `plan.md`.
>
> **Scoring legend:** `EXTRACTED` — to be shipped in this PR; `SKIPPED` — duplication confirmed but extraction rejected with reason; `DEFERRED` — duplication confirmed but extraction postponed to a follow-up issue with reason.

---

## A — Cursor pagination helper

**Category:** tRPC pattern.
**Pattern:** `take: limit + 1` → trim → `nextCursor = trimmed[last]?.id`. Same off-by-one and skip-cursor logic copy-pasted.

**Confirmed call sites (13 files in `packages/api/src/routers/`):**

| File | Variant |
|------|---------|
| `core/project.ts:54` | `take: limit + 1` (cursor) |
| `core/team.ts:46` | cursor |
| `core/cost-center.ts:43` | cursor |
| `core/integration.ts:377` | cursor |
| `core/integration.ts:410` | cursor (second procedure) |
| `core/time.ts:91` | cursor |
| `core/time.ts:415` | cursor |
| `core/einvoice.ts:919` | cursor |
| `compliance/zatca.ts:145` | cursor |
| `compliance/reassessment-trigger.ts:48` | cursor |
| `compliance/economic-dependency-alert.ts:40` | cursor |
| `integrations/peppol.ts:393` | cursor |
| `portal/portal-time.ts:194` | cursor |
| `finance/invoice-intake.ts:273` | cursor |
| `finance/payment.ts:450` | cursor |
| `finance/payment.ts:663` | cursor |

Plus an **offset-pagination** variant in `core/audit.ts:151` (`take: input.pageSize + 1` with `cursor: { id }`) — same shape, slightly different input.

**Extraction target:** `packages/api/src/lib/pagination.ts` exporting:
- `paginateByCursor({ findMany, where, orderBy, cursor, limit })` for the 16 cursor sites.
- `paginatePageSize(...)` (or inline option flag) for the `core/audit.ts` offset variant.

**Risk:** LOW — purely mechanical; tenant scoping continues to come from `ctx.db`.
**Score:** `EXTRACTED` (planned as Step 1).

---

## B — Money / minor-unit formatting

**Category:** utility.
**Pattern:** `new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100)` — copy-pasted across web-vite, with locale (`pl-PL`, `de-DE`, `en-US`, sometimes `undefined`) selected ad-hoc per file.

**Confirmed call sites (33 web-vite files + 2 landing + 1 shared partial home):**

`apps/web-vite/src/lib/format-currency.ts:1–25` — `formatMinorUnits`, `formatAmount` (partial extraction, not consumed everywhere).
`apps/web-vite/src/i18n/useFormatter.ts` — React-side currency formatter.

Inline `Intl.NumberFormat(...).format(minor / 100)` (verified hits):

- `apps/web-vite/src/components/organization/projects/project-table.tsx:29`
- `apps/web-vite/src/components/payments/bank-statement-dialog.tsx:191`
- `apps/web-vite/src/components/payments/payment-run-table/columns.tsx:31`
- `apps/web-vite/src/components/payments/new-payment-run-dialog/step-review.tsx:31`
- `apps/web-vite/src/components/payments/new-payment-run-dialog/step-confirmation.tsx:18`
- `apps/web-vite/src/components/payments/new-payment-run-dialog/step-select.tsx:164`
- `apps/web-vite/src/components/payments/run/skonto-apply-checkbox.tsx:23`
- `apps/web-vite/src/components/payments/invoice-selection-table/columns.tsx:42`
- `apps/web-vite/src/components/portal/portal-invoice-detail-container.tsx:27`
- `apps/web-vite/src/components/portal/portal-invoices-container.tsx:36`
- `apps/web-vite/src/components/portal/portal-index-container.tsx:22`
- `apps/web-vite/src/components/portal/invoice-submit-form.tsx:83`
- `apps/web-vite/src/components/portal/portal-payments-container.tsx:33`
- `apps/web-vite/src/components/portal/contract-card.tsx:34`
- `apps/web-vite/src/components/portal/portal-contract-detail-container.tsx:27`
- `apps/web-vite/src/components/invoices/invoice-side-panel.tsx:46`
- `apps/web-vite/src/components/invoices/invoice-detail/match-card.tsx`
- `apps/web-vite/src/components/invoices/intake/intake-detail-fields-pane.tsx`
- `apps/web-vite/src/components/invoices/intake/intake-list.tsx`
- `apps/web-vite/src/components/invoices/invoice-table/columns.tsx`
- `apps/web-vite/src/components/invoices/skonto/skonto-banner.tsx`
- `apps/web-vite/src/components/invoices/late-interest/late-interest-card.tsx`
- `apps/web-vite/src/components/contracts/contract-side-panel.tsx`
- `apps/web-vite/src/components/contracts/contract-table/columns.tsx`
- `apps/web-vite/src/components/time/deviation-flag.tsx`
- `apps/web-vite/src/components/time/reconciliation-card.tsx`
- `apps/web-vite/src/components/time/reconciliation-spot-check.tsx`
- `apps/web-vite/src/components/time/reconciliation-table.tsx`
- `apps/web-vite/src/components/contractors/contractor-side-panel.tsx`
- `apps/web-vite/src/components/contractors/contractor-table/columns.tsx`
- `apps/web-vite/src/components/contractors/contractor-profile/tab-contracts.tsx`
- `apps/web-vite/src/components/contractors/hooks/use-contractor-tab-payments.ts:63–83`
- `apps/web-vite/src/components/reports/spend-contractor-report.tsx`
- `apps/web-vite/src/components/reports/report-chart.tsx`
- `apps/web-vite/src/components/reports/spend-team-report.tsx`
- `apps/web-vite/src/components/reports/overdue-invoices-report.tsx`
- `apps/landing/src/components/hero.tsx`
- `apps/landing/src/lib/pricing-types.ts:74–89` — `formatPrice` helper

Plus `apps/web-vite/src/components/portal/invoice-submit-form.tsx:274,278,360,595` — raw `/ 100` math without `Intl.NumberFormat` (input pre-fill, label string); needs a non-formatting `minorToDecimal` companion helper or stays inline if it's domain conversion, not display formatting.

**Existing partial home:** `packages/shared/src/money.ts` — already exports `formatMoney`, `minorToDecimalStr`.

**Extraction target:** extend `packages/shared/src/money.ts` with:
- `formatMinorUnits(minor, currency, locale)` — display formatter wrapping `Intl.NumberFormat`.
- `formatPriceMinor(...)` — wrapper used by `apps/landing` `pricing-types.ts` and `hero.tsx`.

Then shrink `apps/web-vite/src/lib/format-currency.ts` to a re-export of the shared helpers, and migrate every inline `Intl.NumberFormat(...).format(... / 100)` to call them.

**Risk:** MEDIUM — silent locale drift today (`pl-PL` hard-coded in one place, `undefined` locale in another); the extraction must preserve the per-site locale **as it exists today**, not unify to a single default. Where the call has no explicit locale, pass `undefined` through to `Intl.NumberFormat`.
**Score:** `EXTRACTED` (planned as Step 2).

---

## C — Date / time formatting

**Category:** utility + React adapter.
**Pattern:** `new Intl.DateTimeFormat(locale, …).format(date)`, ad-hoc relative-date helpers, and `Intl.DisplayNames` country/month list construction — each component picks its own BCP-47 mapping.

**Confirmed call sites (apps/web-vite):**

| File | Concern |
|------|---------|
| `apps/web-vite/src/lib/format-date.ts:58–95` | core formatter (export `formatDate`, etc.) |
| `apps/web-vite/src/lib/format-relative-date.ts:1–15` | relative-date helper |
| `apps/web-vite/src/i18n/useFormatter.ts:88–122` | React hook re-implementing the same Intl wrap |
| `apps/web-vite/src/components/settings/api-keys-tab.tsx` | inline `Intl.DateTimeFormat` |
| `apps/web-vite/src/components/settings/hooks/use-org-settings-form.ts:96–171` | inline months + countries via `Intl.DisplayNames` |
| `apps/web-vite/src/components/invoices/einvoice-tab/transmission-event-row.tsx` | inline |
| `apps/web-vite/src/components/invoices/einvoice-tab/generation-section.tsx` | inline |
| `apps/web-vite/src/components/time/time-source-badge.tsx` | inline |
| `apps/web-vite/src/components/contractors/classification/wizard/classification-autosave-indicator.tsx` | inline |
| `apps/web-vite/src/components/contractors/classification/drv-clearance/drv-clearance-row.tsx:51–77` | inline |
| `apps/web-vite/src/components/billing/billing-date-card.tsx` | inline |

**Extraction target:**
- `packages/shared/src/datetime.ts` — framework-agnostic `formatDate`, `formatDateTime`, `formatRelative`.
- `packages/shared/src/locale-lists.ts` — `getMonths(locale)`, `getCountries(locale)` via `Intl.DisplayNames`.
- Keep `useFormatter` / `useDateFormatter` in `apps/web-vite/src/i18n/` as **thin React adapters** that call the shared helpers (single locale-resolution source: the active i18n context).

**Risk:** MEDIUM — every component currently makes its own locale decision; centralisation must preserve the same per-site behaviour. The React adapter must not change which locale wins (component-prop > i18n context > browser default).
**Score:** `EXTRACTED` (planned as Step 3).

---

## D — Adopt the existing `useResourceMutation` helper

**Category:** React hook / SOLID.
**Existing helper:** `apps/web-vite/src/hooks/use-resource-mutation.ts:19–50` — wraps `useMutation` with `toast.success` + `invalidate` on `onSuccess`, `toast.error` on `onError`.
**Existing adopters (8):** `components/invoices/hooks/use-invoice-metadata-form.ts`, `components/contracts/actions.ts`, `components/contracts/hooks/use-contract-detail-header.ts`, `components/contracts/hooks/use-contract-bulk-actions.ts`, `components/contractors/actions.ts`, `components/contractors/hooks/use-contractor-bulk-actions.ts`, `components/contractors/hooks/use-contractor-profile.ts`, `hooks/__tests__/use-resource-mutation.test.tsx`.

**Hand-rolled `useMutation({ onSuccess: toast.success + invalidate, onError: toast.error })` to migrate (from `plan.md`, re-verify each before edit in Step 4):**

- `apps/web-vite/src/hooks/use-template-mutations.ts`
- `apps/web-vite/src/hooks/use-approval-actions.ts`
- `apps/web-vite/src/components/workflows/hooks/use-workflow-ui.ts`
- `apps/web-vite/src/components/contractors/classification/hooks/use-drv-clearance.ts`
- `apps/web-vite/src/components/payments/hooks/use-payment-run-step-review.ts`
- `apps/web-vite/src/components/equipment/hooks/use-equipment-detail-actions.ts`
- `apps/web-vite/src/components/admin/hooks/use-admin-boe-rate.ts`
- `apps/web-vite/src/components/payments/hooks/use-bank-statement-import.ts`

The Step 4 hook will re-grep for any further hand-rolled call sites surfaced since planning.

**Extraction target:** no new code. Adopt the existing helper.
**Risk:** LOW — drop-in replacement; behaviour change is **none** if the helper's defaults match the inline implementations (verify per site; if a site has bespoke `onSuccess` side-effects beyond toast+invalidate, pass them through `options`).
**Score:** `EXTRACTED` (planned as Step 4).

**Follow-up (not in this PR):** promote `useResourceMutation` from `apps/web-vite` into `packages/ui` once its web-vite-flavoured imports (toast factory, query client) are decoupled. Tracked as deferred per Risk #1 in `plan.md`.

---

## E — `findOrThrow` tRPC helper

**Category:** tRPC pattern.
**Pattern:** `const x = await ctx.db.X.findFirst({ where: { id, organizationId, deletedAt: null } }); if (!x) throw new TRPCError({ code: 'NOT_FOUND', message: E.X_NOT_FOUND });`

**Scope verification:** 75 router files contain *both* `findFirst` and `code: 'NOT_FOUND'`; that overcounts because many files have multiple unrelated procedures. The clean find-or-throw pattern (back-to-back) is present in at least these production routers:

- `core/contract.ts`
- `core/document.ts`
- `core/approval.ts` (`validateStepForAction`)
- `core/contractor.ts`
- `core/import.ts`
- `core/user.ts`
- `core/admin-boe-rate.ts`
- `core/api-key.ts`
- `compliance/classification.ts`
- `compliance/classification-document.tsx`
- `compliance/consent.ts`
- `compliance/reassessment-trigger.ts`
- `compliance/statusfeststellungsverfahren.ts`
- `equipment/equipment-returns.ts`
- `finance/late-payment-interest.ts`
- `workflow/workflow-execution.ts`

Step 5 will enumerate every back-to-back match before editing (per-router walk).

**Extraction target:** `packages/api/src/lib/find-or-throw.ts` exporting:
```ts
findOrThrow<TModel>(model, args, errorMessage): Promise<NonNullable<Awaited<ReturnType<TModel['findFirst']>>>>
```
Tenant scoping continues to come from `ctx.db` (callers pass `{ where: { id, organizationId, deletedAt: null } }` as today).

**Risk:** MEDIUM — type-inference on a generic model parameter is the foot-gun; we keep the helper narrowly typed (one overload per Prisma model) if generic inference is brittle.
**Score:** `EXTRACTED` (planned as Step 5).

---

## F — tRPC service-error → `TRPCError` mapping + `TRPC_TO_HTTP` table

**Category:** tRPC pattern.

**Service-error switches:**
- `packages/api/src/routers/finance/invoice-intake.ts:108–149` — `mapIntakeErrorToTrpc(err)` with `switch (err.code)` mapping `FILE_TOO_LARGE`, `UNSUPPORTED_MIME`, `CII_XSD_INVALID`, `INVALID_STATE_TRANSITION`, `NOT_FOUND`, `VALIDATION_NOT_REQUIRED`, `REASON_TOO_SHORT`, `DUPLICATE_INVOICE_NUMBER`.
- `packages/api/src/routers/finance/invoice-intake.ts:153–…` — second `switch (err.code)` for parser/validator errors (`CII_PARSE_FAILED`, `ZUGFERD_*`).
- Similar mappings live in `packages/api/src/services/jira-issue-sync.ts:482–507` and `packages/api/src/services/jira-worklog-sync.ts:413–454` per planning notes (re-verify in Step 6).

**`TRPC_TO_HTTP` status table:**
- Lives **only** in `apps/public-api/src/lib/error-handler.ts:1–46` (verified — no copy in `packages/api`).
- `apps/public-api/src/lib/__tests__/error-handler.test.ts` consumes it.

**Revised target (deviates from `plan.md` slightly):** because the table is *not* duplicated today, the public-api remains its single source of truth. Step 6 still:
1. Adds `packages/api/src/lib/service-error-mapper.ts` exporting `mapServiceError(err, map)` to consolidate the two `switch (err.code)` blocks in `invoice-intake.ts` and the jira-sync services.
2. **Skips** the `TRPC_TO_HTTP` relocation — there is no duplication to fix. Marked `SKIPPED (no duplication found — single source already in apps/public-api)` within the audit for that sub-task.

**Risk:** LOW — error mapping is pure data; the helper is a `Record<ServiceCode, TRPCError['code']>` lookup with a fallback.
**Score:** `EXTRACTED` (service-error mapper, Step 6) + `SKIPPED` (TRPC_TO_HTTP relocation, no duplication).

---

## G — `softDeleteWithAudit` helper

**Category:** tRPC + Prisma pattern.
**Pattern:** `findFirst({ deletedAt: null })` → `NOT_FOUND` → `update({ deletedAt: now })` → `writeAuditLog(...)` → side-effect cleanup (R2 delete, calendar cleanup, webhook unregister, etc.).

**Scope:** 30 router files call `writeAuditLog`; 20+ also have `deletedAt` references. The clean soft-delete-with-audit pattern is in:

- `core/contract.ts` (contract delete)
- `core/document.ts` (document delete + R2 cleanup)
- `core/approval.ts` (approval chain delete)
- `core/contractor.ts`
- `core/import.ts`
- `core/user.ts`
- `compliance/gdpr.ts` (GDPR-driven deletes)
- `equipment/equipment.ts`
- `workflow/workflow-execution.ts`
- `finance/payment.ts`
- `finance/late-payment-interest.ts`
- `portal/portal-time.ts`, `portal/portal.ts`

**Extraction target:** `packages/api/src/lib/soft-delete-resource.ts` exporting:
```ts
softDeleteWithAudit({ model, id, organizationId, audit, tx?, sideEffects })
```
`sideEffects` is a caller-supplied async callback that fires after the audit write inside the same transaction. Bespoke per-router cleanup (R2, calendar, webhook) stays caller-defined.

**Risk:** MEDIUM-HIGH — `writeAuditLog` must stay on the same tx and ordering as today. The helper must accept `tx` and pass it through to both `update` and `writeAuditLog`. Any site whose side-effect must run **before** the audit write (rare) is `SKIPPED — bespoke ordering` per Risk #2 in `plan.md`.

**Score:** `EXTRACTED` for sites that fit the helper's signature; per-site `SKIPPED` calls are listed in the Step 7 commit message and back-annotated here.

---

## H — `QueryStateView` skeleton + retry primitive

**Category:** React component / SOLID (single boundary for container loading/empty/error/data branches per `apps/web-vite/ARCHITECTURE.md`).

**Pattern:** `{isLoading ? <Skeleton…/> : isError ? <ErrorState onRetry={…}/> : <Children/>}` — every container re-implements this with a `Skeleton` grid + a `RefreshCw` retry button.

**Confirmed call sites (`RefreshCw` retry button — 20+ files):**

- `apps/web-vite/src/components/billing/usage-dashboard.tsx:66–105`
- `apps/web-vite/src/components/invoices/intake/intake-list.tsx:31–70`
- `apps/web-vite/src/components/organization/organization-projects-container.tsx`
- `apps/web-vite/src/components/organization/teams/team-table.tsx`
- `apps/web-vite/src/components/settings/settings-index-container.tsx`
- `apps/web-vite/src/components/settings/slack-sync-button.tsx`
- `apps/web-vite/src/components/settings/e-invoicing/peppol-participant-card.tsx`
- `apps/web-vite/src/components/zatca/zatca-invoice-chain-table.tsx`
- `apps/web-vite/src/components/zatca/zatca-submission-detail.tsx`
- `apps/web-vite/src/components/peppol/peppol-transmission-status.tsx`
- `apps/web-vite/src/components/contracts/contract-detail/signing-progress-bar.tsx`
- `apps/web-vite/src/components/contracts/hooks/use-contract-activity-tab.ts`
- `apps/web-vite/src/components/ocr/ocr-review-panel.tsx`
- `apps/web-vite/src/components/time/reconciliation-table-container.tsx`
- `apps/web-vite/src/components/time/time-tracking-container.tsx`
- `apps/web-vite/src/components/integrations/teams-channel-mapping-card.tsx`
- `apps/web-vite/src/components/integrations/doc-link-chip.tsx`
- `apps/web-vite/src/components/equipment/equipment-list-container.tsx`
- `apps/web-vite/src/components/contractors/revalidate-vat-button.tsx`
- `apps/web-vite/src/components/contractors/contractor-profile/right-rail.tsx`
- `apps/web-vite/src/components/contractors/compliance/recompute-compliance-button.tsx`

**Existing primitive:** `packages/ui/src/components/workbench/empty-state.tsx` (`AtelierEmptyState`).

**Extraction target:** `packages/ui/src/components/workbench/query-state-view.tsx` — `QueryStateView({ isLoading, isError, onRetry, skeleton?, empty?, children })`. The default skeleton stays caller-provided (containers have very different layouts: card grids vs. table rows vs. tabbed panels).

Step 8 migrates only `usage-dashboard.tsx` and `intake-list.tsx` (the two sites originally enumerated in `plan.md`); the remaining 18 RefreshCw users are recorded here for follow-up (extracting them touches more component layouts than this PR should bundle).

**Risk:** MEDIUM — `QueryStateView` is small but its API choices (skeleton-as-prop vs. variant enum) shape every future container. Step 8 keeps the API minimal: render branches only, no skeleton presets.
**Score:** `EXTRACTED` (Step 8) for `usage-dashboard.tsx` + `intake-list.tsx`; remaining 18 sites = `DEFERRED — bundle-size: out of scope for this PR, follow-up issue captures the list above`.

---

## I — Slug generation

**Category:** utility.
**Pattern:** ASCII slugify (lowercase, strip diacritics, replace non-alphanumeric with `-`).

**Confirmed implementations (2 separate TS impls):**

- `apps/cms/src/lib/slugify.ts:1` — exported `slugify` function (used by `apps/cms/src/collections/Authors.ts`, `Categories.ts`, `Posts.ts`).
- `packages/db/scripts/seed-dev.ts:1107` — inline `const slugify = (s: string): string => …` (used at lines 1577, 1578, 1631, 1945).

Plus a Python script (out of TS scope, ignored).

**Revised score (deviates from `plan.md` which marked this DEFERRED with "no second TS call site"):** there **is** a second TS implementation — `packages/db/scripts/seed-dev.ts`. However:
1. The two impls are non-identical (cms version is a Payload hook helper; seed version is build-time only).
2. Extracting requires creating a new home (`packages/shared/src/slug.ts`) which `apps/cms` would have to depend on; today `apps/cms` does **not** depend on `@contractor-ops/shared`.
3. Adding the dependency is cross-cutting and bundle-sensitive for the CMS Payload runtime.

**Risk vs. reward:** the duplication is two functions, both short, neither domain-critical. The dep wiring cost exceeds the DRY win.

**Score:** `DEFERRED — cost of new cross-package dep (apps/cms → packages/shared) exceeds the 2-call-site benefit; revisit when apps/cms already imports from packages/shared for another reason`.

---

## Summary

| ID | Cluster | Score | Step |
|----|---------|-------|------|
| A | Cursor pagination | EXTRACTED | 1 |
| B | Money formatters | EXTRACTED | 2 |
| C | Date/time formatters | EXTRACTED | 3 |
| D | Adopt `useResourceMutation` | EXTRACTED | 4 |
| E | `findOrThrow` helper | EXTRACTED | 5 |
| F | Service-error mapper | EXTRACTED | 6 |
| F (sub) | `TRPC_TO_HTTP` relocation | SKIPPED — no duplication today | — |
| G | `softDeleteWithAudit` | EXTRACTED (per-site, bespoke-ordering sites = SKIPPED) | 7 |
| H | `QueryStateView` (2 sites) | EXTRACTED | 8 |
| H (rest) | 18 more `RefreshCw` containers | DEFERRED — out of PR scope | — |
| I | Slug generation | DEFERRED — cross-package dep cost | — |

**Verification commands (per step):** see `plan.md` § Ordered steps.
**Full-repo gate (Step 9):** `pnpm typecheck`, `pnpm test` (per touched pkg), `pnpm lint`, `pnpm biome check`, `pnpm check:web-vite-data-layer`.
