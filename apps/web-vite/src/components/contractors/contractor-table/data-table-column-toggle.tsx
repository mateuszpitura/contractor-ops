/**
 * Contractor table column visibility toggle.
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
import type { HTMLAttributes, ReactElement } from 'react';
import { memo, useCallback } from 'react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

interface DataTableColumnToggleProps<TData> {
  table: Table<TData>;
}

export function DataTableColumnToggle<TData>({ table }: DataTableColumnToggleProps<TData>) {
  const t = useTranslations('Contractors');
  const renderTrigger = useCallback(
    (props: HTMLAttributes<HTMLButtonElement>) => (
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
            <ColumnVisibilityItem
              key={column.id}
              column={column as Column<TData>}
              label={tDynLoose(t, 'columns', column.id)}
            />
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ColumnVisibilityItemProps<TData> {
  column: Column<TData>;
  label: string;
}

const ColumnVisibilityItem = memo(function ColumnVisibilityItem<TData>({
  column,
  label,
}: ColumnVisibilityItemProps<TData>) {
  const handleChange = useCallback((value: boolean) => column.toggleVisibility(!!value), [column]);
  return (
    <DropdownMenuCheckboxItem
      checked={column.getIsVisible()}
      onCheckedChange={handleChange}
      className="capitalize">
      {label}
    </DropdownMenuCheckboxItem>
  );
}) as <TData>(props: ColumnVisibilityItemProps<TData>) => ReactElement;
