'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

// ---------------------------------------------------------------------------
// Row type matching the tRPC payment.readyForPayment response shape
// ---------------------------------------------------------------------------

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
  // If invoice is in a draft run, populated by the query
  _inRunNumber?: string;
};

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatMinorUnits(minor: number): string {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

type TranslateFunction = (key: string) => string;
type DateFormatter = (value: Date | string | null | undefined) => string;

export function getColumns(
  t: TranslateFunction,
  formatDate?: DateFormatter,
): ColumnDef<ReadyInvoiceRow>[] {
  const fmtDate: DateFormatter =
    formatDate ??
    (v => {
      if (v == null) return '\u2014';
      try {
        return new Date(typeof v === 'string' ? v : v).toLocaleDateString();
      } catch {
        return '\u2014';
      }
    });
  return [
    // 1. Checkbox
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          // biome-ignore lint/nursery/noJsxPropsBind: column definition
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('selection.selectAll')}
        />
      ),
      cell: ({ row }) => {
        const inRun = !!row.original._inRunNumber;
        return (
          <Checkbox
            checked={row.getIsSelected()}
            // biome-ignore lint/nursery/noJsxPropsBind: column definition
            onCheckedChange={value => row.toggleSelected(!!value)}
            disabled={inRun}
            aria-label={t('selection.selectRow')}
            // biome-ignore lint/nursery/noJsxPropsBind: column definition
            onClick={e => e.stopPropagation()}
          />
        );
      },
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },

    // 2. Invoice number
    {
      accessorKey: 'invoiceNumber',
      header: t('selection.invoiceNumber'),
      cell: ({ row }) => (
        <span className="font-semibold text-sm">{row.original.invoiceNumber}</span>
      ),
      enableHiding: false,
    },

    // 3. Contractor
    {
      id: 'contractor',
      accessorFn: row => row.contractor?.legalName ?? '',
      header: t('selection.contractor'),
      cell: ({ row }) => {
        const contractor = row.original.contractor;
        const hasMissingIban = !row.original.billingProfile?.bankAccountMasked;
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-sm truncate">{contractor?.legalName ?? '\u2014'}</span>
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

    // 4. Amount
    {
      accessorKey: 'amountToPayMinor',
      header: () => <span className="text-end block">{t('selection.amount')}</span>,
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums text-end block">
          {formatMinorUnits(row.original.amountToPayMinor)}
        </span>
      ),
    },

    // 5. Currency
    {
      accessorKey: 'currency',
      header: t('selection.currency'),
      cell: ({ row }) => <span className="text-sm">{row.original.currency}</span>,
      enableSorting: false,
    },

    // 6. Due date
    {
      accessorKey: 'dueDate',
      header: t('selection.dueDate'),
      cell: ({ row }) => {
        const dueDate = row.original.dueDate;
        if (!dueDate) return <span className="text-muted-foreground">&mdash;</span>;
        return <span className="text-sm">{fmtDate(dueDate)}</span>;
      },
    },

    // 7. Contract number
    {
      id: 'contract',
      accessorFn: row => row.contract?.contractNumber ?? '',
      header: t('selection.contractNumber'),
      cell: ({ row }) => {
        const contract = row.original.contract;
        return (
          <span className="text-sm text-muted-foreground">
            {contract?.contractNumber ?? '\u2014'}
          </span>
        );
      },
      enableSorting: false,
    },

    // 8. In-run indicator
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
