import type { InvoiceMatchStatusInput, InvoiceStatusInput } from '@contractor-ops/ui';
import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import type { ColumnDef, Row, Table } from '@tanstack/react-table';
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Inbox,
  Mail,
  Upload,
  XCircle,
} from 'lucide-react';
import type { ComponentType, MouseEvent } from 'react';
import { memo, useCallback } from 'react';

import { Link } from '../../../i18n/navigation.js';
import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { enumKey } from '../../../lib/enum-key.js';
import { formatMinorUnits } from '../../../lib/money.js';
import type { EInvoiceComplianceStatus } from './einvoice-compliance-cell.js';
import { EInvoiceComplianceCell } from './einvoice-compliance-cell.js';
import { KsefSourceBadge } from './ksef-source-badge.js';

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  issueDate: string | null;
  dueDate: string | null;
  subtotalMinor: number;
  totalMinor: number;
  currency: string;
  status: string;
  matchStatus: string;
  source: string;
  contractor: {
    id: string;
    legalName: string;
    countryCode?: string;
    isBusinessCustomer?: boolean;
  } | null;
  eInvoiceLifecycle?: {
    validationStatus: 'NOT_VALIDATED' | 'VALID' | 'WARNINGS' | 'INVALID';
    transmissionStatus: 'NOT_SENT' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
  } | null;
  overdueInterestMinor?: number | null;
  skontoTerm?: {
    discountPercent: number;
    discountDays: number;
    netDays: number;
  } | null;
};

export function deriveComplianceStatus(
  lifecycle: InvoiceRow['eInvoiceLifecycle'],
): EInvoiceComplianceStatus {
  if (!lifecycle) return 'notGenerated';
  if (lifecycle.transmissionStatus === 'FAILED') return 'failed';
  if (lifecycle.transmissionStatus === 'SENT' || lifecycle.transmissionStatus === 'DELIVERED')
    return 'transmitted';
  if (lifecycle.validationStatus === 'INVALID') return 'invalid';
  if (lifecycle.validationStatus === 'WARNINGS') return 'warnings';
  if (lifecycle.validationStatus === 'VALID') return 'valid';
  return 'notGenerated';
}

const STATUS_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  RECEIVED: Inbox,
  MATCHED: CheckCircle2,
  UNMATCHED: AlertCircle,
  DISCREPANCY: AlertTriangle,
  APPROVAL_PENDING: Clock,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  READY_FOR_PAYMENT: Banknote,
  PAID: Check,
  UNDER_REVIEW: Clock,
  VOID: XCircle,
  PARTIALLY_PAID: Banknote,
};

const matchStatusLabels: Record<string, string> = {
  MATCHED: 'strongMatch',
  PARTIAL: 'partialMatch',
  DISCREPANCY: 'discrepancy',
  UNMATCHED: 'unmatched',
  MANUALLY_CONFIRMED: 'manualMatch',
};

const NON_OVERDUE_STATUSES = new Set(['PAID', 'VOID']);

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || NON_OVERDUE_STATUSES.has(status)) return false;
  return new Date(dueDate) < new Date();
}

type DateFormatter = (value: Date | string | null | undefined) => string;

interface SelectAllHeaderProps {
  table: Table<InvoiceRow>;
  ariaLabel: string;
}

// memo: rendered in TanStack table header per render
const SelectAllHeader = memo(function SelectAllHeader({ table, ariaLabel }: SelectAllHeaderProps) {
  const handleCheckedChange = useCallback(
    (value: boolean | 'indeterminate') => {
      table.toggleAllPageRowsSelected(!!value);
    },
    [table],
  );
  return (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
      onCheckedChange={handleCheckedChange}
      aria-label={ariaLabel}
    />
  );
});

interface SelectRowCellProps {
  row: Row<InvoiceRow>;
  ariaLabel: string;
}

// memo: rendered per row in invoice table select column
const SelectRowCell = memo(function SelectRowCell({ row, ariaLabel }: SelectRowCellProps) {
  const handleCheckedChange = useCallback(
    (value: boolean | 'indeterminate') => {
      row.toggleSelected(!!value);
    },
    [row],
  );
  return (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={handleCheckedChange}
      aria-label={ariaLabel}
    />
  );
});

const stopPropagation = (event: MouseEvent<HTMLAnchorElement>) => {
  event.stopPropagation();
};

export function getColumns(
  t: LooseTranslator,
  formatDate?: DateFormatter,
): ColumnDef<InvoiceRow>[] {
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
    {
      id: 'select',
      header: ({ table }) => <SelectAllHeader table={table} ariaLabel={t('columns.selectAll')} />,
      cell: ({ row }) => <SelectRowCell row={row} ariaLabel={t('columns.selectRow')} />,
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: 'invoiceNumber',
      header: t('columns.invoiceNumber'),
      cell: ({ row }) => (
        <span className="font-mono text-[13px]">{row.original.invoiceNumber}</span>
      ),
      enableHiding: false,
    },
    {
      id: 'contractor',
      accessorFn: row => row.contractor?.legalName ?? '',
      header: t('columns.contractor'),
      cell: ({ row }) => {
        const contractor = row.original.contractor;
        if (!contractor) return <span className="text-muted-foreground">&mdash;</span>;
        return (
          <Link
            href={`/contractors/${contractor.id}`}
            className="text-sm text-primary hover:underline"
            onClick={stopPropagation}>
            {contractor.legalName}
          </Link>
        );
      },
    },
    {
      accessorKey: 'issueDate',
      header: t('columns.issueDate'),
      cell: ({ row }) => {
        const issueDate = row.original.issueDate;
        if (!issueDate) return <span className="text-muted-foreground">&mdash;</span>;
        try {
          return <span className="text-sm">{fmtDate(issueDate)}</span>;
        } catch {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
      },
    },
    {
      accessorKey: 'dueDate',
      header: t('columns.dueDate'),
      cell: ({ row }) => {
        const dueDate = row.original.dueDate;
        if (!dueDate) return <span className="text-muted-foreground">&mdash;</span>;
        try {
          const overdue = isOverdue(dueDate, row.original.status);
          if (overdue) {
            return (
              <span
                className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive"
                aria-label={`${fmtDate(dueDate)} — ${t('overdueFilter')}`}>
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{fmtDate(dueDate)}</span>
              </span>
            );
          }
          return <span className="text-sm">{fmtDate(dueDate)}</span>;
        } catch {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
      },
    },
    {
      accessorKey: 'subtotalMinor',
      header: () => <span className="text-end block">{t('columns.netAmount')}</span>,
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums text-end block">
          {formatMinorUnits(row.original.subtotalMinor, null, 'pl-PL')}
        </span>
      ),
    },
    {
      accessorKey: 'totalMinor',
      header: () => <span className="text-end block">{t('columns.grossAmount')}</span>,
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums text-end block">
          {formatMinorUnits(row.original.totalMinor, null, 'pl-PL')}
        </span>
      ),
    },
    {
      accessorKey: 'currency',
      header: t('columns.currency'),
      cell: ({ row }) => <span className="text-sm">{row.original.currency}</span>,
    },
    {
      accessorKey: 'status',
      header: t('columns.status'),
      cell: ({ row }) => {
        const status = row.original.status;
        const Icon = STATUS_ICONS[status];
        const variant = statusToVariant('invoice', status as InvoiceStatusInput);
        return (
          <AtelierStatusPill variant={variant}>
            {Icon ? <Icon className="h-3 w-3" /> : null}
            {tDynLoose(t, 'status', enumKey(status))}
          </AtelierStatusPill>
        );
      },
    },
    {
      accessorKey: 'matchStatus',
      header: t('columns.matchStatus'),
      cell: ({ row }) => {
        const matchStatus = row.original.matchStatus;
        const labelKey = matchStatusLabels[matchStatus];
        if (!labelKey) {
          return <span className="text-sm text-muted-foreground">&mdash;</span>;
        }
        const variant = statusToVariant('invoice-match', matchStatus as InvoiceMatchStatusInput);
        return (
          <AtelierStatusPill variant={variant}>
            {tDynLoose(t, 'matchStatus', enumKey(labelKey))}
          </AtelierStatusPill>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'source',
      header: t('columns.source'),
      cell: ({ row }) => {
        const source = row.original.source;
        if (source === 'KSEF') {
          return <KsefSourceBadge />;
        }
        if (source === 'MANUAL_UPLOAD') {
          return <Upload className="h-4 w-4 text-muted-foreground" />;
        }
        if (source === 'EMAIL_INTAKE') {
          return <Mail className="h-4 w-4 text-muted-foreground" />;
        }
        return <span className="text-muted-foreground">&mdash;</span>;
      },
      enableSorting: false,
    },
    {
      id: 'einvoiceCompliance',
      accessorFn: row => deriveComplianceStatus(row.eInvoiceLifecycle),
      header: t('columns.einvoiceCompliance'),
      cell: ({ row }) => {
        const status = deriveComplianceStatus(row.original.eInvoiceLifecycle);
        return (
          <EInvoiceComplianceCell
            status={status}
            invoiceId={row.original.id}
            className="inline-flex"
          />
        );
      },
      enableSorting: false,
    },
    {
      id: 'overdueInterest',
      accessorFn: row => row.overdueInterestMinor ?? null,
      header: () => <span className="text-end block">{t('columns.overdueInterest')}</span>,
      cell: ({ row }) => {
        const amount = row.original.overdueInterestMinor;
        if (amount == null) {
          return <span className="text-muted-foreground text-end block">&mdash;</span>;
        }
        return (
          <span className="font-mono text-sm tabular-nums text-end block text-amber-700 dark:text-amber-400">
            {formatMinorUnits(amount, null, 'pl-PL')}
          </span>
        );
      },
      enableSorting: true,
    },
    {
      id: 'skonto',
      accessorFn: row => row.skontoTerm?.discountPercent ?? null,
      header: t('columns.skonto'),
      cell: ({ row }) => {
        const term = row.original.skontoTerm;
        if (!term) {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
        return (
          <span className="text-sm tabular-nums">
            {term.discountPercent}% {term.discountDays}/{term.netDays}
          </span>
        );
      },
      enableSorting: true,
    },
  ];
}
