/**
 * Invoice selection table columns — ported from
 * apps/web/src/components/payments/invoice-selection-table/columns.tsx.
 * Uses LooseTranslator (parity with payment-run-table/columns).
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import type { ColumnDef, Row, Table } from '@tanstack/react-table';
import { memo, useCallback } from 'react';

import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { formatMinorUnits } from '../../../lib/format-currency.js';

export type ReadyInvoiceRow = {
  id: string;
  invoiceNumber: string;
  totalMinor: number;
  amountToPayMinor: number;
  currency: string;
  dueDate: string | null;
  paymentStatus: string;
  contractor: {
    id: string;
    legalName: string;
    taxId: string;
  } | null;
  billingProfile: {
    id: string;
    bankAccountMasked: string | null;
    preferredCurrency: string | null;
  } | null;
  contract: {
    id: string;
    contractNumber: string;
  } | null;
  _inRunNumber?: string;
};

type DateFormatter = (value: Date | string | null | undefined) => string;

interface HeaderCheckboxProps {
  table: Table<ReadyInvoiceRow>;
  ariaLabel: string;
}

const HeaderCheckbox = memo(function HeaderCheckbox({ table, ariaLabel }: HeaderCheckboxProps) {
  const handleChange = useCallback(
    (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
    [table],
  );
  return (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
      onCheckedChange={handleChange}
      aria-label={ariaLabel}
    />
  );
});

interface RowCheckboxProps {
  row: Row<ReadyInvoiceRow>;
  disabled: boolean;
  ariaLabel: string;
}

const RowCheckbox = memo(function RowCheckbox({ row, disabled, ariaLabel }: RowCheckboxProps) {
  const handleChange = useCallback(
    (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
    [row],
  );
  return (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={handleChange}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  );
});

export function getColumns(
  t: LooseTranslator,
  formatDate?: DateFormatter,
): ColumnDef<ReadyInvoiceRow>[] {
  const fmtDate: DateFormatter =
    formatDate ??
    (v => {
      if (v == null) return '—';
      try {
        return new Date(typeof v === 'string' ? v : v).toLocaleDateString();
      } catch {
        return '—';
      }
    });
  return [
    {
      id: 'select',
      header: ({ table }) => <HeaderCheckbox table={table} ariaLabel={t('selection.selectAll')} />,
      cell: ({ row }) => {
        const inRun = !!row.original._inRunNumber;
        return <RowCheckbox row={row} disabled={inRun} ariaLabel={t('selection.selectRow')} />;
      },
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: 'invoiceNumber',
      header: t('selection.invoiceNumber'),
      cell: ({ row }) => (
        <span className="font-semibold text-sm">{row.original.invoiceNumber}</span>
      ),
      enableHiding: false,
    },
    {
      id: 'contractor',
      accessorFn: row => row.contractor?.legalName ?? '',
      header: t('selection.contractor'),
      cell: ({ row }) => {
        const contractor = row.original.contractor;
        const hasMissingIban = !row.original.billingProfile?.bankAccountMasked;
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-sm truncate">{contractor?.legalName ?? '—'}</span>
            {hasMissingIban && (
              <Badge
                variant="outline"
                className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-[10px] px-1 py-0">
                {t('selection.missingIban')}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'amountToPayMinor',
      header: () => <span className="text-end block">{t('selection.amount')}</span>,
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums text-end block">
          {formatMinorUnits(row.original.amountToPayMinor, null, 'pl-PL')}
        </span>
      ),
    },
    {
      accessorKey: 'currency',
      header: t('selection.currency'),
      cell: ({ row }) => <span className="text-sm">{row.original.currency}</span>,
      enableSorting: false,
    },
    {
      accessorKey: 'dueDate',
      header: t('selection.dueDate'),
      cell: ({ row }) => {
        const dueDate = row.original.dueDate;
        if (!dueDate) return <span className="text-muted-foreground">&mdash;</span>;
        return <span className="text-sm">{fmtDate(dueDate)}</span>;
      },
    },
    {
      id: 'contract',
      accessorFn: row => row.contract?.contractNumber ?? '',
      header: t('selection.contractNumber'),
      cell: ({ row }) => {
        const contract = row.original.contract;
        return (
          <span className="text-sm text-muted-foreground">{contract?.contractNumber ?? '—'}</span>
        );
      },
      enableSorting: false,
    },
    {
      id: 'inRun',
      header: '',
      cell: ({ row }) => {
        const inRun = row.original._inRunNumber;
        if (!inRun) return null;
        return (
          <Badge
            variant="outline"
            className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-[10px]">
            {t('selection.inRun', { runNumber: inRun })}
          </Badge>
        );
      },
      enableSorting: false,
      size: 100,
    },
  ];
}
