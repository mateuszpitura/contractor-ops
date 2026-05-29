/**
 * List page root — fills dashboard main content area without growing the
 * document. The `workbench-list-page` token has no Tailwind effect; it's
 * the marker the shell-level CSS keys on (`:has(.workbench-list-page)`)
 * to opt main into viewport-bound scroll. Pages without it inherit the
 * document-scroll behaviour so footers and forms breathe naturally.
 */
export const WORKBENCH_TABLE_PAGE_CLASS = 'workbench-list-page flex min-h-0 flex-1 flex-col gap-6';

/** Section wrapping a directory table (label + data table). */
export const WORKBENCH_TABLE_SECTION_CLASS = 'flex min-h-0 flex-1 flex-col gap-3';

/** TanStack data-table wrapper (toolbar + bulk actions + shell). */
export const WORKBENCH_DATA_TABLE_CLASS = 'flex min-h-0 flex-1 flex-col gap-4';

/** Tabs root on list pages with a table tab panel. */
export const WORKBENCH_TABLE_TABS_CLASS = 'flex min-h-0 flex-1 flex-col';

/** Active tab panel that hosts a viewport-bound table. */
export const WORKBENCH_TABLE_TAB_PANEL_CLASS =
  'mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden';
