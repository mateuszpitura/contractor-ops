/**
 * Contractor table column visibility toggle. Step 11 codemod port from
 * apps/web/src/components/contractors/contractor-table/data-table-column-toggle.tsx:
 *   - `next-intl`         → `../../../i18n/useTranslations.js`
 *   - `@/i18n/typed-keys` → `../../../i18n/typed-keys.js`
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import type { Table } from '@tanstack/react-table';
import { SlidersHorizontal } from 'lucide-react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

interface DataTableColumnToggleProps<TData> {
  table: Table<TData>;
}

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
              {tDynLoose(t, 'columns', column.id)}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
