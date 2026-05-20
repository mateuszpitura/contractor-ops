# Facts — UI Consistency Sweep

## Bugs (must fix; no design ambiguity)

- `PinTabButton` no longer renders a `<button>` nested inside the base-ui `TabsTrigger` `<button>`; the React hydration error `<button> cannot be a descendant of <button>` no longer appears in the console on `/settings`.
- `apps/web/src/components/settings/pin-tab-button.tsx` renders as a non-button element (e.g. `<span role="switch" tabIndex={0}>`) with the same click/keyboard handlers, ARIA semantics, and visual treatment as before.
- The pin toggle on `/settings` still: shows only when its parent tab is pinned or active; toggles pinned state on click; keeps `aria-checked`, `role="switch"`, and keyboard activation (Enter/Space).
- The pin toggle still stops pointer/click propagation so clicking it does not activate the surrounding tab.
- Invoice table rows (`apps/web/src/components/invoices/invoice-table/data-table.tsx`) render with one consistent row background; overdue state is communicated by text color only (`text-destructive` on the due-date cell) — no row-level background tint that makes "couple rows have different colors".
- The rounded-border table header (`apps/web/src/components/ui/table.tsx` `TableHeader` with `bg-muted/30`) no longer paints color outside the parent's rounded corners; the header background is clipped to the rounded outer container on every table screen.
- The "service type" field bug visible in Image #8 displays the human-readable label (via `tDyn(t, 'serviceType', type)`) instead of the raw enum value, in every place the WHT service-type select is shown.
- The payments page `isEmpty` calculation no longer compares the page-level `status` string against `'all'` (currently `status === 'all'` is always false because `status` here is `document.readyState`-like noise, not the filter array); the empty state shows when the filter values are at their defaults AND data is empty, not by accident.

## Tabs

- Every detail-page tab list (`contractor-profile/profile-tabs.tsx`, `contract-detail/contract-detail-tabs.tsx`, `equipment-detail/equipment-detail-tabs.tsx`) uses the design-system canonical tab style — the same `TabsList` variant used on `/settings` and `/workflows` (`default`, boxed/rounded).
- The `line` (underline) variant of `TabsList` is no longer used anywhere in `apps/web/src`; the only call sites are migrated to `default`.

## Empty states (per-page + per-tab)

- `/workflows` shows an `AtelierEmptyState` (variant=`subview`) inside each tab panel when that tab's data is empty:
  - `runs` panel — no runs at all → `WorkflowsIllustration`, copy + CTA "Start workflow".
  - `tasks` panel — no tasks assigned → new `MyTasksIllustration` (masked face avatars motif), copy from `EmptyStates.myTasks.*`.
  - `templates` panel — no templates → new `TemplatesIllustration`, copy from `EmptyStates.templates.*`, CTA "New template".
- The contractor profile "Equipment" tab (`tab-equipment.tsx`):
  - `SectionLabel` reads "Equipment" — not "No equipment assigned".
  - When empty, renders `AtelierEmptyState` (variant=`subview`, `EquipmentIllustration`) instead of the in-table `DataTableBody` empty row.
- The settings → Audit log tab shows an `AtelierEmptyState` (variant=`subview`, `AuditLogIllustration`) when there are zero entries; the empty `<table>` with header-only rows is no longer shown.
- Filter/search no-result states across every list page (invoices, payments, equipment, contractors, contracts, workflow runs, audit log, templates) show the new `NoResultsIllustration` instead of a generic `Search`/`SearchX` lucide icon.
- The templates tab section label uses the same bottom margin/padding as section labels in every other tab (the value used by `SectionLabel` in `payments/page.tsx`, `workflows/page.tsx`, etc.) — visually consistent vertical rhythm.

## Illustrations

- Three new illustrations exist in `packages/ui/src/components/workbench/empty-state-illustrations.tsx` and are exported from the `@contractor-ops/ui` index:
  - `MyTasksIllustration` — masked face avatars (motif requested by user) over a checklist; same line style and palette as existing 18 illustrations.
  - `TemplatesIllustration` — stacked-document/blueprint motif (not a duplicate of `WorkflowsIllustration`).
  - `NoResultsIllustration` — magnifying glass + sparkle/empty paper motif; replaces the generic zoom-icon-with-x pattern everywhere.
- All three follow the existing `IllustrationProps` signature and visual conventions (24px viewBox grid, 1.5 stroke, primary-tint accent).

## Tables

- `equipment-table.tsx` is rendered inside `AtelierTableShell` (same shell as contracts / invoices), so the equipment list page background matches every other list page.
- Every list-page table (invoices, payments, equipment, contracts, contractors, workflow runs, audit log) shares the same shell, the same header background treatment, and the same row alternation rules.

## Permissions

- The Settings → "Feature flags" tab is visible only when the current user's `User.role` (Better Auth platform admin field, `auth.prisma`) is `'admin'`.
- Org admins and owners with org-level `settings:read` but `User.role !== 'admin'` no longer see the Feature flags tab in `tabsToRender` and the tab content is not reachable via direct `?tab=feature-flags` deep link.
- `apps/web/src/lib/settings-tabs.ts` records the platform-admin requirement on the `feature-flags` entry (new `platformAdmin: true` flag or equivalent), and `usePermissions` / a sibling hook exposes the platform-admin signal.

## Modals

- `DialogContent` (`apps/web/src/components/ui/dialog.tsx`) uses a flex-column layout: header (fixed), body (scrollable, `overflow-y-auto`), `DialogFooter` (sticky to the bottom of the popup, not part of the scrollable body) on every modal across the app.
- `DialogFooter`'s current `-mx-4 -mb-4` negative-margin trick is replaced by the new layout so footers always rest at the popup's bottom edge with consistent padding.
- The modal shown in Image #4 has consistent paddings between header, body, and footer (no double-padding from nested cards/forms).
- The i18n input shown in Image #3 is replaced by a single `<I18nInput>` (new component) with:
  - One text field bound to the currently selected language.
  - A language switcher adornment (flag + code dropdown) inside the input.
  - Per-language fill indicator: a small dot next to each language in the dropdown — filled if a value exists, hollow if empty.
  - Stores a `{ [locale]: string }` map on the form; switching languages swaps the visible value without losing other languages.

## Verification anchors

- `pnpm typecheck` passes.
- `pnpm test` passes (existing tests for `pin-tab-button`, `tab-equipment`, `dialog`, `invoice-side-panel`, `tabs` continue to pass; updated tests cover the new behaviors).
- No `<button> cannot ... <button>` nor `cannot contain a nested <button>` console error appears on `/settings` page load.
- `rg -n 'variant="line"' apps/web/src` returns zero results (excluding tests asserting the variant existed historically, if any).
- `rg -n 'TabsList' apps/web/src | rg -v 'variant='` audit shows no implicit fallback to `line` anywhere.
