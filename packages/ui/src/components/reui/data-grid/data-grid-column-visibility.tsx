// @ts-nocheck — vendored from reui registry; types relaxed pending upstream verbatimModuleSyntax fix

import type { Column, Table } from '@tanstack/react-table';
import type { ReactElement } from 'react';
import { useCallback } from 'react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../shadcn/dropdown-menu.js';
import { getColumnHeaderLabel } from './data-grid.js';

const preventSelectDefault = (event: Event) => event.preventDefault();

function DataGridColumnVisibilityItem<TData>({ column }: { column: Column<TData, unknown> }) {
  const handleCheckedChange = useCallback(
    (value: boolean) => column.toggleVisibility(!!value),
    [column],
  );

  return (
    <DropdownMenuCheckboxItem
      className="capitalize"
      checked={column.getIsVisible()}
      onSelect={preventSelectDefault}
      onCheckedChange={handleCheckedChange}>
      {getColumnHeaderLabel(column)}
    </DropdownMenuCheckboxItem>
  );
}

function DataGridColumnVisibility<TData>({
  table,
  trigger,
}: {
  table: Table<TData>;
  trigger: ReactElement<Record<string, unknown>>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[150px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-medium">Toggle Columns</DropdownMenuLabel>
          {table
            .getAllColumns()
            .filter(column => column.getCanHide())
            .map(column => (
              <DataGridColumnVisibilityItem key={column.id} column={column} />
            ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { DataGridColumnVisibility };
