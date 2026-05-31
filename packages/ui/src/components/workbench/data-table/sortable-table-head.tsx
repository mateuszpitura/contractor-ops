import type { Column, Header } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { useUITranslations } from '../../../i18n/translations-provider.js';
import { TableHead } from '../../shadcn/table.js';

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') return <ArrowUp className="h-3 w-3" />;
  if (direction === 'desc') return <ArrowDown className="h-3 w-3" />;
  return <ArrowUpDown className="h-3 w-3 opacity-40" />;
}

function getAriaSort(column: Column<unknown, unknown>): 'ascending' | 'descending' | undefined {
  const sorted = column.getIsSorted();
  if (sorted === 'asc') return 'ascending';
  if (sorted === 'desc') return 'descending';
  return;
}

interface SortableTableHeadProps<TData, TValue> {
  header: Header<TData, TValue>;
  /** Pre-formatted aria-label for the sort button. Falls back to translator. */
  sortAriaLabel?: string;
}

export function SortableTableHead<TData, TValue>({
  header,
  sortAriaLabel,
}: SortableTableHeadProps<TData, TValue>) {
  const t = useUITranslations();
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

  const ariaLabel = sortAriaLabel ?? t('aria.sortBy', { column: String(header.column.id) });

  return (
    <TableHead key={header.id} style={widthStyle} aria-sort={getAriaSort(column)}>
      <button
        type="button"
        className="flex items-center gap-1 uppercase hover:text-foreground"
        onClick={header.column.getToggleSortingHandler()}
        aria-label={ariaLabel}>
        {flexRender(headerDef.header, header.getContext())}
        <SortIcon direction={header.column.getIsSorted()} />
      </button>
    </TableHead>
  );
}
