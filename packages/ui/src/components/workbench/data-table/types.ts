import type {
  ColumnDef,
  OnChangeFn,
  Row,
  RowSelectionState,
  SortingState,
  Table,
  VisibilityState,
} from '@tanstack/react-table';
import type { ComponentType, ReactNode } from 'react';

/**
 * Shape descriptor for a single skeleton column. Drives skeleton dimensions
 * + radius so a loading cell mimics the real column's visual weight instead
 * of rendering a uniform rectangle for every cell. Map by TanStack column id.
 */
export type SkeletonColumnShape = {
  shape?: 'text' | 'badge' | 'avatar' | 'actions' | 'checkbox';
  /** Tailwind width class override (e.g. 'w-32', 'w-1/2'). Used by 'text' only. */
  width?: string;
};

/**
 * Bulk action descriptor. Rendered as a button inside the bulk-action bar
 * that appears above the table when at least one row is selected.
 *
 * Pass `confirm` to wrap the action in an AlertDialog. The action only fires
 * after the user confirms; cancel returns control to the caller's selection.
 */
export interface DataTableBulkAction<TData> {
  id: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  /** Invoked with the currently selected row originals. */
  onRun: (selected: TData[]) => void | Promise<void>;
  variant?: 'default' | 'destructive';
  confirm?: {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
  };
}

/**
 * Server-side default. When `clientPagination` is true, the primitive installs
 * `getPaginationRowModel` and owns the page index/size internally — caller's
 * `pageIndex` / `pageSize` are treated as initial values.
 */
export interface DataTableProps<TData> {
  // ---- required ----------------------------------------------------------
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Total rows known to the server. Drives the chrome count strip + footer. */
  totalRows: number;
  /** Pluralized entity label (e.g. "contractors"). Caller owns plural rules. */
  entityLabel: string;
  /** Heading rendered inside the empty state (zero rows, no filters). */
  emptyTitle: string;
  /** Heading rendered inside the no-results state (filters active, zero rows). */
  noResultsTitle: string;

  // ---- loading -----------------------------------------------------------
  isLoading?: boolean;
  isRefetching?: boolean;
  /** Keep skeletons mounted while a parallel count query is still in flight. */
  forceLoading?: boolean;
  skeletonRows?: number;
  skeletonColumns?: Record<string, SkeletonColumnShape>;

  // ---- pagination --------------------------------------------------------
  pageIndex: number;
  pageSize: number;
  /** Defaults to [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Installs `getPaginationRowModel` locally for client-side mode. */
  clientPagination?: boolean;

  // ---- sorting (server-side only) ----------------------------------------
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;

  // ---- column visibility (controlled) ------------------------------------
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;

  // ---- filters / search --------------------------------------------------
  hasFiltersOrSearch?: boolean;
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  /** Caller-rendered toolbar (filter inputs, search bar). May read loading via context. */
  toolbar?: ReactNode | ((ctx: { disabled: boolean }) => ReactNode);
  /**
   * Caller-rendered bulk-action bar — rendered as a separate sibling between
   * the toolbar and the table shell so it inherits the `gap-4` spacing from
   * the wrapper. Use when consumer drives selection via `onSelectionChange`
   * and needs a custom action bar (dropdown menus, confirm dialogs, etc.)
   * the canonical `bulkActions[]` API can't express.
   */
  bulkBar?: ReactNode;

  // ---- empty (two-tier) --------------------------------------------------
  emptyDescription?: string;
  emptyCta?: string;
  onEmptyCta?: () => void;
  emptyCtaIcon?: ComponentType<{ className?: string }>;
  emptyIcon?: ReactNode;
  /** When set, switches to full AtelierEmptyState variant="page" (first-class lists only). */
  emptyIllustration?: ComponentType<{ className?: string }>;

  // ---- no-results --------------------------------------------------------
  noResultsDescription?: string;
  noResultsCta?: string;

  // ---- row interaction ---------------------------------------------------
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string;
  /** Stable id derivation for selection + expansion. Defaults to the row index. */
  getRowId?: (row: TData, index: number) => string;

  // ---- row expansion (sub-row rendering) ---------------------------------
  /**
   * When set, renders the returned node as a `<TableRow>` immediately after
   * each row whose id is `true` in `expandedRowIds`. Caller owns the expand
   * state (controlled via `expandedRowIds` + `onExpandedChange`).
   *
   * `getRowId` must be set so expansion keys remain stable across pagination.
   */
  renderSubRow?: (row: TData) => ReactNode;
  expandedRowIds?: Record<string, boolean>;
  onExpandedChange?: (next: Record<string, boolean>) => void;

  // ---- bulk actions ------------------------------------------------------
  bulkActions?: DataTableBulkAction<TData>[];
  /**
   * Force row selection on without supplying `bulkActions`. Use when the
   * consumer renders a custom bulk-action bar via `toolbar` or a sibling
   * component and only needs the primitive to own selection state.
   */
  enableRowSelection?: boolean;
  /** Fires with the current selected-row originals whenever selection changes. */
  onSelectionChange?: (selectedRows: TData[]) => void;
  /**
   * Controlled row-selection state — opt in to drive selection from a parent
   * component (cross-component select-all-matching, parent-owned IDs in a
   * wizard, etc.). When set, the primitive forwards the state to TanStack
   * and calls `onRowSelectionChange` on every change.
   */
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  /**
   * Per-row selection predicate. Use to disable selection of rows that are
   * already part of another set (e.g. invoices already attached to a run).
   */
  isRowSelectable?: (row: Row<TData>) => boolean;

  // ---- chrome ------------------------------------------------------------
  /** Render-prop overload receives the TanStack table instance (column toggles). */
  rightSlot?: ReactNode | ((table: Table<TData>) => ReactNode);
  hideDensityToggle?: boolean;
  /**
   * Hide the entire `TableChrome` strip (count + entity label + clear-filters
   * chip + density toggle + rightSlot). Use for wizard / dialog sub-tables
   * that already have their own header / context above. Default false.
   */
  hideChrome?: boolean;
  /**
   * Hide the pagination footer entirely. Use when the caller renders its own
   * (cursor-paginated, "Load more", etc.) below the table. Default false.
   */
  hideFooter?: boolean;
  /** Pass-through to AtelierTableShell.constrainHeight. */
  constrainHeight?: boolean;
  /** Pass-through to AtelierTableShell.fill. */
  fill?: boolean;
  className?: string;
}

/**
 * Default page-size options. Matches the data-table-unification spec.
 */
export const DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100];

/**
 * Default page size for first-class list pages. Sub-tables that opt out of
 * URL state still use this default unless overridden.
 */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Canonical URL search-param keys owned by the primitive. Consumers wiring
 * nuqs (or any other URL-state runtime) should use these literal keys so
 * shareable URLs remain stable across the app.
 *
 * Sub-tables that opt out of URL state ignore these constants; they live
 * here so callers don't drift on key names.
 */
export const DATA_TABLE_URL_KEYS = Object.freeze({
  pageIndex: 'page',
  pageSize: 'size',
  sort: 'sort',
  query: 'q',
  /** Prefix for individual filter values, e.g. `f.status=active`. */
  filterPrefix: 'f.',
});
