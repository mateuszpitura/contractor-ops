import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle2, Download, MoreHorizontal, XCircle } from 'lucide-react';
import type * as React from 'react';
import { memo, useCallback } from 'react';

import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { formatMinorUnits } from '../../../lib/format-currency.js';
import { PaymentRunBadge } from '../payment-run-badge.js';

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

type DateFormatter = (value: Date | string | null | undefined) => string;
type DateTimeFormatter = (value: Date | string | null | undefined) => string;

function formatRelativeDate(dateStr: string, formatDateFn: DateFormatter): string {
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
  return formatDateFn(date);
}

type TranslateFunction = LooseTranslator;

interface ColumnActions {
  onDownloadExport?: (run: PaymentRunRow) => void;
  onMarkAllPaid?: (run: PaymentRunRow) => void;
  onCancelRun?: (run: PaymentRunRow) => void;
}

type ButtonProps = React.ComponentProps<typeof Button>;

interface DropdownTriggerButtonProps extends ButtonProps {
  srLabel: string;
}

const DropdownTriggerButton = memo(function DropdownTriggerButton({
  srLabel,
  onClick,
  ...rest
}: DropdownTriggerButtonProps) {
  const handleClick = useCallback<NonNullable<ButtonProps['onClick']>>(
    e => {
      e.stopPropagation();
      onClick?.(e);
    },
    [onClick],
  );
  return (
    <Button {...rest} variant="ghost" size="icon" className="h-8 w-8" onClick={handleClick}>
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">{srLabel}</span>
    </Button>
  );
});

interface ActionMenuItemProps {
  run: PaymentRunRow;
  action: ((run: PaymentRunRow) => void) | undefined;
  icon: React.ReactNode;
  label: string;
  className?: string;
}

type DropdownMenuItemProps = React.ComponentProps<typeof DropdownMenuItem>;

const ActionMenuItem = memo(function ActionMenuItem({
  run,
  action,
  icon,
  label,
  className,
}: ActionMenuItemProps) {
  const handleClick = useCallback<NonNullable<DropdownMenuItemProps['onClick']>>(
    e => {
      e.stopPropagation();
      action?.(run);
    },
    [run, action],
  );
  return (
    <DropdownMenuItem className={className} onClick={handleClick}>
      {icon}
      {label}
    </DropdownMenuItem>
  );
});

interface ActionsCellProps {
  run: PaymentRunRow;
  t: TranslateFunction;
  actions: ColumnActions;
}

const ActionsCell = memo(function ActionsCell({ run, t, actions }: ActionsCellProps) {
  const showDownload = !!run.exportedAt;
  const showMarkPaid = run.status === 'EXPORTED';
  const showCancel = run.status === 'DRAFT' || run.status === 'LOCKED' || run.status === 'EXPORTED';

  if (!(showDownload || showMarkPaid || showCancel)) return null;

  const srLabel = t('columns.actions');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<DropdownTriggerButton srLabel={srLabel} />} />
      <DropdownMenuContent align="end">
        {showDownload && (
          <ActionMenuItem
            run={run}
            action={actions.onDownloadExport}
            icon={<Download className="me-2 h-4 w-4" />}
            label={t('actions.downloadExport')}
          />
        )}
        {showMarkPaid && (
          <ActionMenuItem
            run={run}
            action={actions.onMarkAllPaid}
            icon={<CheckCircle2 className="me-2 h-4 w-4" />}
            label={t('actions.markAllPaid')}
          />
        )}
        {!!showCancel && (
          <ActionMenuItem
            run={run}
            action={actions.onCancelRun}
            icon={<XCircle className="me-2 h-4 w-4" />}
            label={t('actions.cancelRun')}
            className="text-destructive"
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export function getColumns(
  t: TranslateFunction,
  actions: ColumnActions,
  formatDate?: DateFormatter,
  formatDateTime?: DateTimeFormatter,
): ColumnDef<PaymentRunRow>[] {
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
  const fmtDateTime: DateTimeFormatter =
    formatDateTime ??
    (v => {
      if (v == null) return '\u2014';
      try {
        return new Date(typeof v === 'string' ? v : v).toLocaleString();
      } catch {
        return '\u2014';
      }
    });
  return [
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
    {
      accessorKey: 'status',
      header: t('columns.status'),
      cell: ({ row }) => <PaymentRunBadge status={row.original.status} />,
      enableSorting: false,
    },
    {
      accessorKey: 'createdAt',
      header: t('columns.created'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground" title={fmtDateTime(row.original.createdAt)}>
          {formatRelativeDate(row.original.createdAt, fmtDate)}
        </span>
      ),
    },
    {
      accessorKey: 'invoiceCount',
      header: t('columns.invoices'),
      cell: ({ row }) => <span className="text-sm">{row.original.invoiceCount}</span>,
      enableSorting: false,
    },
    {
      accessorKey: 'totalMinor',
      header: () => <span className="text-end block">{t('columns.total')}</span>,
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums text-end block">
          {formatMinorUnits(row.original.totalMinor, row.original.currency, 'pl-PL')}
        </span>
      ),
    },
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
    {
      id: 'actions',
      header: t('columns.actions'),
      cell: ({ row }) => <ActionsCell run={row.original} t={t} actions={actions} />,
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
