/** List page root — fills dashboard main content area without growing the document. */
export const WORKBENCH_TABLE_PAGE_CLASS = 'flex min-h-0 flex-1 flex-col gap-6';

/** Section wrapping a directory table (label + data table). */
export const WORKBENCH_TABLE_SECTION_CLASS = 'flex min-h-0 flex-1 flex-col gap-3';

/** TanStack data-table wrapper (toolbar + bulk actions + shell). */
export const WORKBENCH_DATA_TABLE_CLASS = 'flex min-h-0 flex-1 flex-col gap-4';

/** Tabs root on list pages with a table tab panel. */
export const WORKBENCH_TABLE_TABS_CLASS = 'flex min-h-0 flex-1 flex-col';

/** Active tab panel that hosts a viewport-bound table. */
export const WORKBENCH_TABLE_TAB_PANEL_CLASS =
  'mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden';
