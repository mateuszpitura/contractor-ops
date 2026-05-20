# Goal — UI Consistency Sweep

Bring the dashboard's tables, tabs, modals, empty states, and platform-admin gating into a single coherent design-system pass while fixing five concrete bugs surfaced during review (nested-button hydration error on `/settings`, equipment table chrome mismatch, header bg bleed past rounded corners, invoice row color drift, broken payments empty-state filter logic, and the service-type select rendering raw enum values).

The work also adds three missing illustrations (`MyTasksIllustration`, `TemplatesIllustration`, `NoResultsIllustration`), a reusable `<I18nInput>` component, restricts the Feature Flags settings tab to Better Auth platform admins, and pins modal action rows to the bottom of `DialogContent`.

## Shared understanding

- Facts: [facts.md](./facts.md) — gated and approved.

## Execution plan

- Plan: [plan.md](./plan.md) — gated and approved. Seven staged commits (bugs → tabs → empty states → no-results illustration → new SVGs → permission gate → dialog footer + i18n input).

## Done condition

The dashboard ships with:

1. Zero `<button> cannot be a descendant of <button>` console errors on any settings page.
2. One canonical tab style across `/settings`, `/workflows`, contractor / contract / equipment detail pages — `line` variant removed.
3. Atelier empty states (subview variant) on every list page and every tab panel that can be empty (workflows runs / my tasks / templates, audit log, contractor equipment tab, payments).
4. A single `NoResultsIllustration` covering every filter / search no-result, replacing the generic zoom + x icon.
5. `MyTasksIllustration`, `TemplatesIllustration`, `NoResultsIllustration` exported from `@contractor-ops/ui`.
6. Equipment list page rendered inside `AtelierTableShell`; rounded-border table headers no longer paint past their corner.
7. Invoice rows visually homogeneous; overdue conveyed only by `text-destructive` on the due-date cell.
8. Payments page empty state triggered by the correct filter predicate (`statuses.length === 0` etc.), not a stale `status === 'all'` comparison.
9. Service-type select renders the human label of the selected option, not the enum value.
10. Settings → Feature flags tab visible only when `User.role === 'admin'` (Better Auth platform admin); tRPC procedure enforces same gate server-side.
11. `DialogFooter` sticks to the bottom of every modal; modal padding consistent across header / body / footer.
12. New `<I18nInput>` replaces the per-locale stacked inputs in the modal from Image #3, with flag adornment dropdown and per-locale fill dots.
13. `pnpm typecheck` and `pnpm test` both pass.

Done! Launch a goal with `/goal goals/ui-consistency-sweep/goal.md`
