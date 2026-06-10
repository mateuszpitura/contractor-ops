/**
 * Workflow runs table column visibility toggle.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import type { Column, Table } from '@tanstack/react-table';
import { SlidersHorizontal } from 'lucide-react';
import { memo, useCallback } from 'react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

interface DataTableColumnToggleProps<TData> {
  table: Table<TData>;
}

function ColumnVisibilityCheckboxItem<TData>({
  column,
  label,
}: {
  column: Column<TData, unknown>;
  label: string;
}) {
  const handleCheckedChange = useCallback(
    (value: boolean | 'indeterminate') => column.toggleVisibility(!!value),
    [column],
  );
  return (
    <DropdownMenuCheckboxItem
      checked={column.getIsVisible()}
      onCheckedChange={handleCheckedChange}
      className="capitalize">
      {label}
    </DropdownMenuCheckboxItem>
  );
}

const ColumnVisibilityCheckboxItemMemo = memo(
  ColumnVisibilityCheckboxItem,
) as typeof ColumnVisibilityCheckboxItem;

export function DataTableColumnToggle<TData>({ table }: DataTableColumnToggleProps<TData>) {
  const t = useTranslations('Workflows');
  const renderTrigger = useCallback(
    (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <Button {...props} variant="outline" size="icon" className="h-9 w-9">
        <SlidersHorizontal className="h-4 w-4" />
        <span className="sr-only">{t('filters')}</span>
      </Button>
    ),
    [t],
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={renderTrigger} />
      <DropdownMenuContent align="end" className="w-48">
        {table
          .getAllColumns()
          .filter(
            column =>
              typeof column.accessorFn !== 'undefined' ||
              (column.id !== 'select' && column.getCanHide()),
          )
          .map(column => (
            <ColumnVisibilityCheckboxItemMemo
              key={column.id}
              column={column}
              label={tDynLoose(t, 'columns', column.id)}
            />
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
