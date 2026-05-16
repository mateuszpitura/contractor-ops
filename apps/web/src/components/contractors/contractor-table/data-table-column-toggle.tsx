'use client';

import type { Table } from '@tanstack/react-table';
import { SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { tDyn } from '@/i18n/typed-keys';

interface DataTableColumnToggleProps<TData> {
  table: Table<TData>;
}

/**
 * Column visibility dropdown for the contractor data table.
 * Persists visibility state to localStorage.
 */
export function DataTableColumnToggle<TData>({ table }: DataTableColumnToggleProps<TData>) {
  const t = useTranslations('Contractors');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
        render={props => (
          <Button {...props} variant="outline" size="icon" className="h-9 w-9">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="sr-only">{t('filters')}</span>
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="w-48">
        {table
          .getAllColumns()
          .filter(
            column =>
              typeof column.accessorFn !== 'undefined' ||
              (column.id !== 'select' && column.getCanHide()),
          )
          .map(column => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
              onCheckedChange={value => column.toggleVisibility(!!value)}
              className="capitalize">
              {tDyn(t, 'columns', column.id)}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
