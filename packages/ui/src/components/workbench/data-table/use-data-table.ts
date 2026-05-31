import type {
  ColumnDef,
  OnChangeFn,
  Row,
  RowSelectionState,
  SortingState,
  Table,
  VisibilityState,
} from '@tanstack/react-table';
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DEFAULT_PAGE_SIZE_OPTIONS } from './types.js';

interface UseDataTableOptions<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  /** Server-side rendered page index (0-based). */
  pageIndex: number;
  pageSize: number;
  totalRows: number;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  clientPagination?: boolean;
  pageSizeOptions?: readonly number[];
  enableRowSelection?: boolean;
  getRowId?: (row: TData, index: number) => string;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  controlledRowSelection?: RowSelectionState;
  onControlledRowSelectionChange?: OnChangeFn<RowSelectionState>;
  isRowSelectable?: (row: Row<TData>) => boolean;
}

interface UseDataTableResult<TData> {
  table: Table<TData>;
  rowSelection: RowSelectionState;
  setRowSelection: OnChangeFn<RowSelectionState>;
  clearSelection: () => void;
  selectedRows: TData[];
  visibleRowCount: number;
  /** True when the footer should hide (totalRows ≤ smallest page-size option). */
  shouldHideFooter: boolean;
}

/**
 * Internal TanStack wiring for the canonical DataTable. Owns row selection
 * state (only when `enableRowSelection` is true) and reacts to caller-driven
 * pagination + sort signals.
 *
 * Selection auto-clears whenever the caller changes pagination or sort —
 * selecting rows on page 1 must not carry over after the user paginates to
 * page 2 with a different result set.
 */
export function useDataTable<TData>(opts: UseDataTableOptions<TData>): UseDataTableResult<TData> {
  const {
    data,
    columns,
    pageIndex,
    pageSize,
    totalRows,
    sorting,
    onSortingChange,
    clientPagination = false,
    columnVisibility,
    onColumnVisibilityChange,
    controlledRowSelection,
    onControlledRowSelectionChange,
    isRowSelectable,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    enableRowSelection = false,
    getRowId,
  } = opts;

  const [uncontrolledRowSelection, setUncontrolledRowSelection] = useState<RowSelectionState>({});
  const isControlled = controlledRowSelection !== undefined;
  const rowSelection = isControlled ? controlledRowSelection : uncontrolledRowSelection;
  const setRowSelection: OnChangeFn<RowSelectionState> = isControlled
    ? // biome-ignore lint/suspicious/noEmptyBlockStatements: noop fallback when caller omits handler
      (onControlledRowSelectionChange ?? (() => {}))
    : setUncontrolledRowSelection;
  const previousSignature = useRef<string>(`${pageIndex}:${pageSize}:${JSON.stringify(sorting)}`);

  // biome-ignore lint/correctness/useExhaustiveDependencies: setRowSelection identity flips with isControlled; adding it would re-run on every controlled-mode render
  useEffect(() => {
    const signature = `${pageIndex}:${pageSize}:${JSON.stringify(sorting)}`;
    if (signature !== previousSignature.current) {
      previousSignature.current = signature;
      if (!isControlled && Object.keys(rowSelection).length > 0) {
        setRowSelection({});
      }
    }
  }, [pageIndex, pageSize, sorting, rowSelection]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: setRowSelection is conditionally bound; stable for the lifetime of a single (controlled|uncontrolled) mode
  const clearSelection = useCallback(() => setRowSelection({}), []);

  const handleSortingChange = useCallback<OnChangeFn<SortingState>>(
    updater => {
      if (!onSortingChange) return;
      onSortingChange(updater);
    },
    [onSortingChange],
  );

  const tableState = useMemo(
    () => ({
      pagination: { pageIndex, pageSize },
      sorting: sorting ?? [],
      rowSelection,
    }),
    [pageIndex, pageSize, sorting, rowSelection],
  );

  // Client mode bundles client-side sort with client-side pagination — for
  // in-memory lists they always go together. Server mode keeps sorting
  // manual so the caller drives the tRPC orderBy input.
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const effectiveSorting = clientPagination ? internalSorting : (sorting ?? []);

  const table = useReactTable({
    data,
    columns,
    state: {
      ...tableState,
      sorting: effectiveSorting,
      ...(columnVisibility === undefined ? {} : { columnVisibility }),
    },
    enableRowSelection: isRowSelectable ?? enableRowSelection,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange,
    onSortingChange: clientPagination
      ? setInternalSorting
      : onSortingChange
        ? handleSortingChange
        : undefined,
    manualPagination: !clientPagination,
    manualSorting: !clientPagination,
    pageCount: clientPagination ? undefined : Math.max(1, Math.ceil(totalRows / pageSize)),
    getCoreRowModel: getCoreRowModel(),
    ...(clientPagination
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          getSortedRowModel: getSortedRowModel(),
        }
      : {}),
    getRowId,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: rowSelection is the upstream driver of table.getSelectedRowModel() output
  const selectedRows = useMemo(
    () => table.getSelectedRowModel().rows.map(row => row.original),
    [table, rowSelection],
  );

  const visibleRowCount = clientPagination ? data.length : totalRows;
  const smallestOption = pageSizeOptions[0] ?? 10;
  const shouldHideFooter = visibleRowCount <= smallestOption;

  return {
    table,
    rowSelection,
    setRowSelection,
    clearSelection,
    selectedRows,
    visibleRowCount,
    shouldHideFooter,
  };
}
