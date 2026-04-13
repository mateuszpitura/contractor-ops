'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle2, Download, MoreHorizontal, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PaymentRunBadge } from '../payment-run-badge';

// ---------------------------------------------------------------------------
// Row type matching the tRPC payment.list response shape
// ---------------------------------------------------------------------------

export type PaymentRunRow = {
  id: string;
  runNumber: string | null;
  status: string;
  createdAt: string;
  invoiceCount: number;
  totalMinor: number;
  currency: string | null;
  exportFormat: string | null;
  exportedAt: string | null;
  _count?: { items: number };
};

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatMinorUnits(minor: number, currency?: string | null): string {
  const formatted = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
  return currency ? `${formatted} ${currency}` : formatted;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString('pl-PL');
}

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

type TranslateFunction = (key: string) => string;

interface ColumnActions {
  onDownloadExport?: (run: PaymentRunRow) => void;
  onMarkAllPaid?: (run: PaymentRunRow) => void;
  onCancelRun?: (run: PaymentRunRow) => void;
}

export function getColumns(
  t: TranslateFunction,
  actions: ColumnActions,
): ColumnDef<PaymentRunRow>[] {
  return [
    // 1. Run number
    {
      accessorKey: 'runNumber',
      header: t('columns.runNumber'),
      cell: ({ row }) => (
        <span className="font-semibold text-sm text-primary cursor-pointer hover:underline">
          {row.original.runNumber ?? row.original.id.slice(0, 8)}
        </span>
      ),
      enableHiding: false,
    },

    // 2. Status badge
    {
      accessorKey: 'status',
      header: t('columns.status'),
      cell: ({ row }) => <PaymentRunBadge status={row.original.status} />,
      enableSorting: false,
    },

    // 3. Created (relative date with tooltip)
    {
      accessorKey: 'createdAt',
      header: t('columns.created'),
      cell: ({ row }) => (
        <span
          className="text-sm text-muted-foreground"
          title={new Date(row.original.createdAt).toLocaleString('pl-PL')}>
          {formatRelativeDate(row.original.createdAt)}
        </span>
      ),
    },

    // 4. Invoice count
    {
      accessorKey: 'invoiceCount',
      header: t('columns.invoices'),
      cell: ({ row }) => <span className="text-sm">{row.original.invoiceCount}</span>,
      enableSorting: false,
    },

    // 5. Total
    {
      accessorKey: 'totalMinor',
      header: () => <span className="text-end block">{t('columns.total')}</span>,
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums text-end block">
          {formatMinorUnits(row.original.totalMinor, row.original.currency)}
        </span>
      ),
    },

    // 6. Export format
    {
      accessorKey: 'exportFormat',
      header: t('columns.format'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.exportFormat ?? '\u2014'}
        </span>
      ),
      enableSorting: false,
    },

    // 7. Actions dropdown
    {
      id: 'actions',
      header: t('columns.actions'),
      cell: ({ row }) => {
        const run = row.original;
        const showDownload = !!run.exportedAt;
        const showMarkPaid = run.status === 'EXPORTED';
        const showCancel =
          run.status === 'DRAFT' || run.status === 'LOCKED' || run.status === 'EXPORTED';

        if (!(showDownload || showMarkPaid || showCancel)) return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={props => (
                <Button
                  {...props}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={e => {
                    e.stopPropagation();
                    props.onClick?.(e);
                  }}>
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">{t('columns.actions')}</span>
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              {showDownload && (
                <DropdownMenuItem
                  onClick={e => {
                    e.stopPropagation();
                    actions.onDownloadExport?.(run);
                  }}>
                  <Download className="me-2 h-4 w-4" />
                  {t('actions.downloadExport')}
                </DropdownMenuItem>
              )}
              {showMarkPaid && (
                <DropdownMenuItem
                  onClick={e => {
                    e.stopPropagation();
                    actions.onMarkAllPaid?.(run);
                  }}>
                  <CheckCircle2 className="me-2 h-4 w-4" />
                  {t('actions.markAllPaid')}
                </DropdownMenuItem>
              )}
              {!!showCancel && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={e => {
                    e.stopPropagation();
                    actions.onCancelRun?.(run);
                  }}>
                  <XCircle className="me-2 h-4 w-4" />
                  {t('actions.cancelRun')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
