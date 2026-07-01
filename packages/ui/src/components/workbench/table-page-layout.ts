/**
 * List page root — DEFAULT (cap) mode. Content-height, document-flow column.
 * The `workbench-list-page` marker drives the globals.css gate (main is the
 * scroll owner; the Outlet wrapper grows so content pushes `AppFooter` down).
 * Pair with the default `AtelierTableShell` (body capped at
 * {@link WORKBENCH_TABLE_BODY_MAX_HEIGHT_CLASS}); the table body scrolls
 * internally and the page scrolls when chrome + table exceed the viewport.
 * Use on pages with pre-table chrome (filters, summary tiles) — e.g. invoices.
 */
export const WORKBENCH_TABLE_PAGE_CLASS = 'workbench-list-page flex min-w-0 flex-col gap-6';

/**
 * List page root — FILL mode. Viewport-locked flex chain: the table grows to
 * fill the viewport and scrolls internally, the page does not scroll. The
 * extra `workbench-list-fill` marker tells the gate to keep main's Outlet
 * wrapper locked (not grow). Pair with `<AtelierTableShell fill>`. Use on
 * table-only pages — e.g. contractors.
 */
export const WORKBENCH_TABLE_PAGE_FILL_CLASS =
  'workbench-list-page workbench-list-fill flex min-h-0 min-w-0 flex-1 flex-col gap-6';

/**
 * Section wrapping a directory table (label + data table). `flex-1 min-h-0` is
 * a no-op in a content-height (cap) page and fills in a fill page, so the same
 * class serves both modes. `overflow-x-clip` (not `-hidden`) contains
 * horizontal blowout without forcing `overflow-y: auto`.
 */
export const WORKBENCH_TABLE_SECTION_CLASS =
  'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-clip';

/** TanStack data-table wrapper (toolbar + bulk actions + shell). */
export const WORKBENCH_DATA_TABLE_CLASS = 'flex min-h-0 flex-1 flex-col gap-4';

/** Cap-mode scrollable table body height (px). Body = min(content, this). */
export const WORKBENCH_TABLE_BODY_MAX_HEIGHT_PX = 400;

/**
 * Tailwind class applied to AtelierTableShell's scroll region in cap mode.
 * Caps the body so tall tables scroll internally at 400px while short tables
 * shrink to content; the page scrolls for everything else.
 */
export const WORKBENCH_TABLE_BODY_MAX_HEIGHT_CLASS = 'max-h-[400px]';

/** Tabs root on list pages with a table tab panel. */
export const WORKBENCH_TABLE_TABS_CLASS = 'flex min-h-0 flex-1 flex-col';

/** Active tab panel that hosts a viewport-bound table. */
export const WORKBENCH_TABLE_TAB_PANEL_CLASS =
  'mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden';

/**
 * Slot for `AtelierEmptyState` `variant="page"` — grows to fill the list-page
 * flex column below headers/tabs.
 */
export const WORKBENCH_EMPTY_STATE_PAGE_CLASS = 'flex min-h-0 flex-1 flex-col w-full';
