# Plan — UI Consistency Sweep

## Solution approach

Ship in 6 staged commits, each isolated and verifiable. Stage 1 (bugs) is the only blocking work — everything after is design-system normalization that can land independently. We reuse already-built primitives (`AtelierEmptyState`, `AtelierTableShell`, `SectionLabel`) and add three new illustrations + one new `<I18nInput>` component to `@contractor-ops/ui`. Tabs `line` variant gets removed entirely; permission gating shifts from `member.role` to Better Auth `User.role`.

## Stage 1 — Bugs (blocking, ship first)

### 1.1 Fix nested-button hydration error on /settings

Files:
- `apps/web/src/components/settings/pin-tab-button.tsx` — change root from `<button>` to `<span role="switch" tabIndex={0}>`. Add `onKeyDown` that activates on Enter/Space. Keep `aria-checked`, `data-pinned`, all class names, pointer-stop handlers. The element loses native button semantics but keeps assistive-tech equivalence via `role="switch"`.
- `apps/web/src/components/settings/__tests__/pin-tab-button.test.tsx` (create if absent) — assert no nested-button warning by rendering inside a `<button>`; assert click + Enter/Space activation; assert `role="switch"`.

Verify:
- `pnpm --filter @contractor-ops/web test pin-tab-button`.
- Dev-server load `/settings`, open console — no `<button> cannot be a descendant of <button>` warning.

### 1.2 Header bg bleed outside rounded corners

Files:
- `apps/web/src/components/equipment/equipment-table/equipment-table.tsx` line 196 — replace the raw `<div className="relative rounded-xl border bg-background">` wrapper with `<AtelierTableShell isLoading={...}>` (already imported in contracts/invoices) so the header gets `overflow-hidden` clip. This single change resolves both Image #2 (header overflow) and the equipment bg discrepancy.
- Audit pass: `rg -n 'rounded-xl.*border' apps/web/src/components | rg -v 'overflow-hidden'` — any remaining table-like wrapper without `overflow-hidden` gets migrated to `AtelierTableShell` (or `overflow-hidden` added). Expected hits: equipment list, audit-log, settings users/api-keys tables. Migrate when they wrap a `<Table>`; otherwise just add `overflow-hidden`.

Verify:
- Visual: dev server, `/equipment` — header bg respects rounded corner.
- `rg -n 'AtelierTableShell' apps/web/src/components/equipment/equipment-table/equipment-table.tsx` returns ≥1 hit.

### 1.3 Invoice row "different colors"

Files:
- `apps/web/src/components/invoices/invoice-table/data-table.tsx` — check the `<TableRow>` render block (around lines 308–340 area) for any conditional className applying a row-level bg (e.g., `isRowOverdue(row) && 'bg-…'`). Remove any row-bg conditional. Overdue stays as text-only `text-destructive` on the due-date cell (`columns.tsx:255` already does this).
- `apps/web/src/components/invoices/invoice-table/__tests__/data-table.test.tsx:139` — update assertion if it tests for a row-bg class; assert only the cell-level `text-destructive` instead.

Verify:
- Test pass.
- Dev server, `/invoices` — overdue rows look identical to others except the red due-date text.

### 1.4 Payments empty-state filter logic

Files:
- `apps/web/src/app/[locale]/(dashboard)/payments/page.tsx:185–191` — fix `isEmpty`. Current code:
  ```
  const isEmpty = !isLoading && data.length === 0 && status === 'all' && !dateFrom && !dateTo && cursors.length === 0;
  ```
  `status` here is undefined / leak (no `status` var in scope; it's the global `document.readyState` polyfill or just plain wrong — confirm at read time). Replace with `statuses.length === 0` (the actual filter array). Final condition: `data.length === 0 && statuses.length === 0 && !dateFrom && !dateTo && cursors.length === 0 && !isLoading`.
- Same file — when filters ARE active and result empty, render `AtelierEmptyState` (variant=`subview`, new `NoResultsIllustration`, `EmptyStates.noResults.*` copy with "Clear filters" CTA), not the "No payment runs found" generic.

Verify:
- `pnpm --filter @contractor-ops/web test payments`.
- Dev: open `/payments` with zero data → see PaymentsIllustration empty state. Apply a status filter that returns zero → see NoResults empty state.

### 1.5 Service-type label vs value (Image #8)

Files:
- Read the exact screen referenced in Image #8 to confirm which component. Candidates already located:
  - `apps/web/src/components/equipment/ups-fieldset.tsx:131` — `<SelectValue />` renders the *value*, not the label, on base-ui Select. Need to render the label of the currently selected `SERVICE_OPTIONS` entry instead. Fix: pass `placeholder` + render selected label explicitly, OR use the design-system Select that resolves `SelectValue` against item children.
  - `apps/web/src/components/settings/tax/wht-calculator-section.tsx:148` already uses `tDyn(t, 'serviceType', type)` — likely fine, audit only.
- If Image #8 is a different "service type" surface, grep `tCarrier\|serviceCode\|service.*Select` to locate.

Verify:
- `pnpm --filter @contractor-ops/web test ups-fieldset`.
- Dev: open the shipping/UPS modal; select shows human label, not the enum code.

## Stage 2 — Tabs migration (design system)

Files:
- `apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx:67` — remove `variant="line"`. Adjust spacing if needed (line variant relies on `after:` underline; default variant uses bg pill — may need `mt-4` removal or container padding tweak).
- `apps/web/src/components/contracts/contract-detail/contract-detail-tabs.tsx:46` — same.
- `apps/web/src/components/equipment/equipment-detail/equipment-detail-tabs.tsx:51` — same.
- `apps/web/src/components/onboarding/people-review-step.tsx` — audit (only file outside detail tabs using `variant="line"` per earlier grep). Decide case-by-case — if it's a real subnav, may stay; user said app-wide swap, so default to migrating.
- `apps/web/src/components/ui/tabs.tsx:20` — once no callers use `line`, delete the `line` branch from `tabsListVariants` and the variant prop (or keep variant prop, drop the `line` enum value). Update tests accordingly.

Verify:
- `rg -n 'variant="line"' apps/web/src` returns 0 hits (excluding tests asserting historical behavior — delete those assertions if any).
- `pnpm typecheck` passes.
- Dev: contractor / contract / equipment detail tabs visually match settings tabs.

## Stage 3 — Empty states + per-tab empty states

### 3.1 Workflows per-tab empty

Files:
- `apps/web/src/app/[locale]/(dashboard)/workflows/page.tsx` — inside `<TabsContent value="runs">`, `value="tasks">`, `value="templates">`: when the inner data query returns empty, render `AtelierEmptyState` (`variant="subview"`). Tasks tab uses new `MyTasksIllustration`; templates tab uses new `TemplatesIllustration`. Pull empty-count from `runsCountQuery`, plus new `myTasksCountQuery` and `templatesCountQuery` (small list calls already exist or add `count` variants on relevant tRPC routers).
- `apps/web/src/components/workflows/my-tasks-list.tsx` — replace any in-list "no tasks" placeholder with `AtelierEmptyState` (subview) using new `MyTasksIllustration`.
- `apps/web/src/components/workflows/templates-table.tsx` — same, with `TemplatesIllustration`.
- `apps/web/messages/{en,de,pl,ar}.json` — add `EmptyStates.myTasks.{heading,body,cta}`, `EmptyStates.templates.{heading,body,cta}`, `EmptyStates.noResults.{heading,body,cta}`.

### 3.2 Audit log empty

Files:
- `apps/web/src/components/settings/audit-log-tab.tsx` — when API returns zero entries AND no filters/search active, render `AtelierEmptyState` (subview, `AuditLogIllustration`, `EmptyStates.auditLog.*` copy). Currently the page shows an empty `<table>` with only header rows.
- `apps/web/src/components/settings/audit-log-table.tsx` — confirm it tolerates "do not render" path; keep filtered-empty handling separate so filter-no-result still uses `NoResultsIllustration`.

### 3.3 Contractor "Equipment" tab

Files:
- `apps/web/src/components/contractors/contractor-profile/tab-equipment.tsx`:
  - Change `<SectionLabel icon={Package}>{t('contractorTab.emptyTitle')}</SectionLabel>` to `<SectionLabel icon={Package}>{t('tabLabel')}</SectionLabel>` (add `tabLabel` key under `Equipment.contractorTab` in messages — value: "Equipment").
  - When `items.length === 0 && !query.isLoading`, render `AtelierEmptyState` (subview, `EquipmentIllustration`) instead of the table with `DataTableBody` empty row.

### 3.4 Templates tab section-label margin

Files:
- Find the templates tab's `SectionLabel` (likely inside `templates-table.tsx` or workflows `page.tsx` `value="templates"` block). Match the same wrapping element (typically `<section className="space-y-3">` + `<SectionLabel>`) used by payments/workflows.

Verify (3.x):
- `pnpm --filter @contractor-ops/web test workflows audit-log-tab tab-equipment`.
- Dev: every listed tab shows an Atelier empty state when data is zero.

## Stage 4 — Filter / no-result illustration

Files:
- `packages/ui/src/components/workbench/empty-state-illustrations.tsx` — add `NoResultsIllustration` (export at end, follow `IllustrationProps` shape).
- `packages/ui/src/components/workbench/index.ts` — re-export.
- `packages/ui/dist/` — rebuilt via `pnpm --filter @contractor-ops/ui build`.
- Replace generic `Search`/`SearchX` lucide icons with `NoResultsIllustration` at every filter no-result path:
  - `apps/web/src/components/shared/data-table-body.tsx` — `noResultsTitle` rendering location.
  - All list pages that pass `noResults*` props to `DataTableBody`. Grep `noResultsTitle\|noResultsIcon` for full set.
  - Payments page (Stage 1.4 path).

Verify:
- `pnpm --filter @contractor-ops/ui build && pnpm --filter @contractor-ops/web typecheck`.
- Dev: any list, type junk in search → new illustration shown.

## Stage 5 — Illustrations (new SVGs)

Files:
- `packages/ui/src/components/workbench/empty-state-illustrations.tsx` — append three exports: `MyTasksIllustration`, `TemplatesIllustration`, `NoResultsIllustration`. Hand-author SVG matching the existing 18 (24px conceptual grid, primary-tint accent, 1.5 stroke). MyTasks shows masked-face avatars (per user "with masks"); Templates is stacked blueprint/document; NoResults is magnifying glass + sparkle (no generic `x`).
- Export from `packages/ui/src/components/workbench/index.ts`.
- Re-export from `packages/ui/src/index.ts` if it surfaces workbench named exports.
- `packages/ui/dist/` — rebuilt.
- Re-snapshot tests (if any) for the illustrations module.

Verify:
- `pnpm --filter @contractor-ops/ui build` succeeds.
- Import path `import { MyTasksIllustration, TemplatesIllustration, NoResultsIllustration } from '@contractor-ops/ui'` resolves in web app.

## Stage 6 — Feature-flags permission gate

Files:
- `apps/web/src/lib/settings-tabs.ts` — extend the `'feature-flags'` entry with a `platformAdmin: true` marker (introduce a new field on the tab type) OR remove the `permission` field and add a discriminant.
- `apps/web/src/hooks/use-permissions.ts` (or sibling) — add `isPlatformAdmin()` derived from current session user. Backed by Better Auth — the session payload from `/api/auth/get-session` exposes `user.role` (per `auth.prisma`). Expose via a new hook `usePlatformAdmin()` or extend `usePermissions`.
- `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx:99` — replace `if (tab.key === 'feature-flags') return canViewAuditLog;` with `if (tab.key === 'feature-flags') return isPlatformAdmin;`.
- `packages/api/src/routers/feature-flags*.ts` — server-side defense: tRPC procedure for `featureFlags.list` must check `ctx.user.role === 'admin'` (Better Auth platform admin) and throw `FORBIDDEN` otherwise. This is the actual security gate; the UI hide is just nice-to-have.
- Tests: `packages/api/src/routers/__tests__/feature-flags.test.ts` — add platform-admin allow / org-admin deny cases.

Verify:
- `pnpm --filter @contractor-ops/api test feature-flags`.
- Dev: log in as org admin (`User.role !== 'admin'`) → no feature-flags tab; deep link `/settings?tab=feature-flags` → tRPC 403. Log in as `User.role === 'admin'` → tab visible and panel loads.

## Stage 7 — Dialog footer sticky + i18n input

### 7.1 Dialog sticky footer

Files:
- `apps/web/src/components/ui/dialog.tsx`:
  - `DialogContent` — change from `grid gap-4 p-4` to `flex max-h-[calc(100dvh-2rem)] flex-col` and split children into header / scrollable body / footer slots. Body region wraps non-header/footer children in `<div className="overflow-y-auto p-4">`; footer detached from negative margins and rendered as `<div className="sticky bottom-0 ...">` OR positioned as the last flex child with non-shrinking height.
  - `DialogFooter` — drop `-mx-4 -mb-4`; keep `border-t bg-muted/50 p-4`. The popup container's `p-4` moves into the body wrapper so footer can sit at popup edge.
- All ~30 `DialogFooter` consumers — verify rendering. Adjust spacing on dialogs that previously relied on the negative-margin trick (e.g., `ksef-setup-dialog`, `chain-editor-dialog`).
- `apps/web/src/components/ui/__tests__/dialog.test.tsx` — update assertions for new structure.

Verify:
- `pnpm --filter @contractor-ops/web test dialog`.
- Dev: open the longest-content modal (e.g., `chain-editor-dialog`, `new-payment-run-dialog`). Confirm body scrolls, footer stays pinned bottom.

### 7.2 New `<I18nInput>` component

Files:
- `apps/web/src/components/ui/i18n-input.tsx` (new) — props `{ value: Record<string, string>; onChange: (v) => void; locales: string[]; defaultLocale: string; placeholder?: string }`. Renders one `<Input>` + adornment dropdown (flags from `/public/flags/*.svg`) showing a per-locale fill dot.
- Find every modal currently rendering N stacked inputs labeled per locale. Likely candidates by grep: `name_en|name_de|labelEn|labelDe|translations` across:
  - `apps/web/src/components/settings/*-tab.tsx` (Image #3 is a Settings modal — confirm).
  - Workflow template editor (template-form.tsx).
- Replace each with `<I18nInput value={form.name} onChange={...} locales={...} />`.

Verify:
- `pnpm --filter @contractor-ops/web test i18n-input` (new test file).
- Dev: in the modal shown in Image #3, single input + flag switcher; fill dot lights up after typing in a language.

### 7.3 Modal padding pass (Image #4)

Files:
- Identify exact modal from Image #4 (likely the same i18n one — confirm during execution). Normalize so DialogHeader, body, DialogFooter each have `p-4` and no nested padding from Card / form wrappers.

Verify:
- Visual diff dev vs prod.

## Risks / open questions

- **R1 — Service-type bug Image #8** may be a different component than `ups-fieldset.tsx`. Plan covers UPS fieldset; if Image #8 is, e.g., `dpd-provider-section.tsx` or a contract-rate select, the exact file in 1.5 swaps but the fix shape (render label not value) holds.
- **R2 — Better Auth admin-plugin role** lives in `User.role` (String, default `'user'`). Confirm session callback exposes `role` on `ctx.user` server-side; if not, add to `auth.config.ts`. Worst case: read role via `ctx.prisma.user.findUnique` once per gated procedure.
- **R3 — Modal sticky footer** may break dialogs that rely on `DialogContent` `grid` layout for centering small forms. Audit one rep dialog per shape (small, medium, scrolling) before global swap.
- **R4 — `variant="line"` deletion** assumes no third-party / story usage. Search `apps/web/storybook` and `packages/ui` for refs before deleting the variant enum.
- **R5 — Templates section-label margin** — fact says match other tabs; if the visual diff isn't obvious from code, capture before/after screenshots during execution and confirm with user.
- **R6 — `NoResultsIllustration` adoption surface** is broad (~10 list pages). If illustration design takes longer than expected, ship the SVG and migrate one page at a time across follow-up commits; do not block Stage 1–3.
