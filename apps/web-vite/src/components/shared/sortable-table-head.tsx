import { TableHead } from '@contractor-ops/ui/components/shadcn/table';
import type { Column, Header } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Sort icon
// ---------------------------------------------------------------------------

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') return <ArrowUp className="h-3 w-3" />;
  if (direction === 'desc') return <ArrowDown className="h-3 w-3" />;
  return <ArrowUpDown className="h-3 w-3 opacity-40" />;
}

// ---------------------------------------------------------------------------
// aria-sort value
// ---------------------------------------------------------------------------

function getAriaSort(column: Column<unknown, unknown>): 'ascending' | 'descending' | undefined {
  const sorted = column.getIsSorted();
  if (sorted === 'asc') return 'ascending';
  if (sorted === 'desc') return 'descending';
  return;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SortableTableHeadProps<TData, TValue> {
  header: Header<TData, TValue>;
  sortAriaLabel?: string;
}

/**
 * A table header cell that renders sort controls when the column is sortable.
 * Extracts the repeated sort-icon + aria-sort + button pattern used across
 * every data-table in the app.
 */
export function SortableTableHead<TData, TValue>({
  header,
  sortAriaLabel,
}: SortableTableHeadProps<TData, TValue>) {
  const column = header.column as unknown as Column<unknown, unknown>;
  const headerDef = header.column.columnDef;

  const widthStyle =
    header.column.getSize() === 150 ? undefined : { width: header.column.getSize() };

  if (header.isPlaceholder) {
    return <TableHead key={header.id} style={widthStyle} />;
  }

  if (!header.column.getCanSort()) {
    return (
      <TableHead key={header.id} style={widthStyle}>
        {flexRender(headerDef.header, header.getContext())}
      </TableHead>
    );
  }

  return (
    <TableHead key={header.id} style={widthStyle} aria-sort={getAriaSort(column)}>
      <button
        type="button"
        className="flex items-center gap-1 uppercase hover:text-foreground"
        onClick={header.column.getToggleSortingHandler()}
        aria-label={sortAriaLabel}>
        {flexRender(headerDef.header, header.getContext())}
        <SortIcon direction={header.column.getIsSorted()} />
      </button>
    </TableHead>
  );
}
