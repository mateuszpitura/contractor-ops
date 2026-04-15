'use client';

import type { ColumnDef } from '@tanstack/react-table';
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
import {
  type EInvoiceComplianceStatus,
  EInvoiceStatusCell,
} from '@/components/invoices/einvoice-status-cell';
import { KsefSourceBadge } from '@/components/invoices/ksef-badge';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from '@/i18n/navigation';
import { enumKey } from '@/lib/enum-key';

// ---------------------------------------------------------------------------
// Row type matching the tRPC invoice.list response shape
// ---------------------------------------------------------------------------

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
  /**
   * EInvoiceLifecycle projection, selected by `invoice.list` for the
   * Phase 61 compliance column. `null` / `undefined` → "not generated" bucket.
   * Optional so existing row fixtures (tests pre-dating Plan 61-08) keep working.
   */
  eInvoiceLifecycle?: {
    validationStatus: 'NOT_VALIDATED' | 'VALID' | 'WARNINGS' | 'INVALID';
    transmissionStatus: 'NOT_SENT' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
  } | null;
  /**
   * Phase 63 — late-payment interest computed total for GB B2B invoices.
   * Minor units (pence). `null` → not applicable.
   */
  overdueInterestMinor?: number | null;
  /**
   * Phase 63 — Skonto term summary for DE invoices.
   * `null` → no Skonto configured.
   */
  skontoTerm?: {
    discountPercent: number;
    discountDays: number;
    netDays: number;
  } | null;
};

/**
 * Maps the joined lifecycle row to the public compliance-status enum used
 * by the filter chips + summary tile. Mirrors the server-side bucket logic
 * in `einvoice.listByOrg`. Kept client-side too so the cell renders
 * consistently with the chip filter without an extra round-trip.
 */
export function deriveComplianceStatus(
  lifecycle: InvoiceRow['eInvoiceLifecycle'],
): EInvoiceComplianceStatus {
  if (!lifecycle) return 'notGenerated';
  if (lifecycle.transmissionStatus === 'FAILED') return 'failed';
  if (
    lifecycle.transmissionStatus === 'SENT' ||
    lifecycle.transmissionStatus === 'DELIVERED'
  )
    return 'transmitted';
  if (lifecycle.validationStatus === 'INVALID') return 'invalid';
  if (lifecycle.validationStatus === 'WARNINGS') return 'warnings';
  if (lifecycle.validationStatus === 'VALID') return 'valid';
  return 'notGenerated';
}

// ---------------------------------------------------------------------------
// Invoice status badge colors per UI-SPEC
// ---------------------------------------------------------------------------

const statusBadgeConfig: Record<
  string,
  { className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  RECEIVED: {
    className: 'bg-muted text-muted-foreground',
    Icon: Inbox,
  },
  MATCHED: {
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
    Icon: CheckCircle2,
  },
  UNMATCHED: {
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    Icon: AlertCircle,
  },
  DISCREPANCY: {
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
    Icon: AlertTriangle,
  },
  APPROVAL_PENDING: {
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    Icon: Clock,
  },
  APPROVED: {
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
    Icon: CheckCircle2,
  },
  REJECTED: {
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
    Icon: XCircle,
  },
  READY_FOR_PAYMENT: {
    className: 'bg-primary/10 text-primary',
    Icon: Banknote,
  },
  PAID: {
    className: 'bg-muted text-muted-foreground',
    Icon: Check,
  },
  UNDER_REVIEW: {
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    Icon: Clock,
  },
  VOID: {
    className: 'bg-muted text-muted-foreground',
    Icon: XCircle,
  },
};

// ---------------------------------------------------------------------------
// Match status indicator colors
// ---------------------------------------------------------------------------

const matchStatusConfig: Record<string, { dotClass: string; label: string }> = {
  MATCHED: { dotClass: 'bg-green-500', label: 'strongMatch' },
  PARTIAL: { dotClass: 'bg-amber-500', label: 'partialMatch' },
  DISCREPANCY: { dotClass: 'bg-red-500', label: 'discrepancy' },
  UNMATCHED: { dotClass: 'bg-muted-foreground', label: 'unmatched' },
  MANUALLY_CONFIRMED: { dotClass: 'bg-blue-500', label: 'manualMatch' },
};

// ---------------------------------------------------------------------------
// Currency / minor-unit formatter
// ---------------------------------------------------------------------------

function formatMinorUnits(minor: number): string {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

// ---------------------------------------------------------------------------
// Overdue detection
// ---------------------------------------------------------------------------

const NON_OVERDUE_STATUSES = new Set(['PAID', 'VOID']);

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || NON_OVERDUE_STATUSES.has(status)) return false;
  return new Date(dueDate) < new Date();
}

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

type TranslateFunction = (key: string) => string;

/**
 * Returns all column definitions for the invoice data table.
 * Accepts a translation function for headers and labels.
 */
export function getColumns(t: TranslateFunction): ColumnDef<InvoiceRow>[] {
  return [
    // 1. Select checkbox
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          // biome-ignore lint/nursery/noJsxPropsBind: column definition
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('columns.selectAll')}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          // biome-ignore lint/nursery/noJsxPropsBind: column definition
          onCheckedChange={value => row.toggleSelected(!!value)}
          aria-label={t('columns.selectRow')}
          // biome-ignore lint/nursery/noJsxPropsBind: column definition
          onClick={e => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },

    // 2. Invoice number (monospace)
    {
      accessorKey: 'invoiceNumber',
      header: t('columns.invoiceNumber'),
      cell: ({ row }) => (
        <span className="font-mono text-[13px]">{row.original.invoiceNumber}</span>
      ),
      enableHiding: false,
    },

    // 3. Contractor (link)
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
            // biome-ignore lint/nursery/noJsxPropsBind: column definition
            onClick={e => e.stopPropagation()}>
            {contractor.legalName}
          </Link>
        );
      },
    },

    // 4. Issue date
    {
      accessorKey: 'issueDate',
      header: t('columns.issueDate'),
      cell: ({ row }) => {
        const issueDate = row.original.issueDate;
        if (!issueDate) return <span className="text-muted-foreground">&mdash;</span>;
        try {
          return <span className="text-sm">{new Date(issueDate).toLocaleDateString('pl-PL')}</span>;
        } catch {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
      },
    },

    // 5. Due date (destructive if overdue)
    {
      accessorKey: 'dueDate',
      header: t('columns.dueDate'),
      cell: ({ row }) => {
        const dueDate = row.original.dueDate;
        if (!dueDate) return <span className="text-muted-foreground">&mdash;</span>;
        try {
          const overdue = isOverdue(dueDate, row.original.status);
          return (
            <span className={`text-sm ${overdue ? 'text-destructive font-medium' : ''}`}>
              {new Date(dueDate).toLocaleDateString('pl-PL')}
            </span>
          );
        } catch {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
      },
    },

    // 6. Net amount (right-aligned)
    {
      accessorKey: 'subtotalMinor',
      header: () => <span className="text-end block">{t('columns.netAmount')}</span>,
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums text-end block">
          {formatMinorUnits(row.original.subtotalMinor)}
        </span>
      ),
    },

    // 7. Gross amount (right-aligned)
    {
      accessorKey: 'totalMinor',
      header: () => <span className="text-end block">{t('columns.grossAmount')}</span>,
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums text-end block">
          {formatMinorUnits(row.original.totalMinor)}
        </span>
      ),
    },

    // 8. Currency
    {
      accessorKey: 'currency',
      header: t('columns.currency'),
      cell: ({ row }) => <span className="text-sm">{row.original.currency}</span>,
    },

    // 9. Status badge
    {
      accessorKey: 'status',
      header: t('columns.status'),
      cell: ({ row }) => {
        const status = row.original.status;
        const config = statusBadgeConfig[status];
        if (!config) {
          return <Badge variant="secondary">{t(`status.${enumKey(status)}`)}</Badge>;
        }
        const { className, Icon } = config;
        return (
          <Badge variant="secondary" className={`gap-1 ${className}`}>
            <Icon className="h-3 w-3" />
            {t(`status.${enumKey(status)}`)}
          </Badge>
        );
      },
    },

    // 10. Match status (dot + label)
    {
      accessorKey: 'matchStatus',
      header: t('columns.matchStatus'),
      cell: ({ row }) => {
        const matchStatus = row.original.matchStatus;
        const config = matchStatusConfig[matchStatus];
        if (!config) {
          return <span className="text-sm text-muted-foreground">&mdash;</span>;
        }
        return (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className={`inline-block h-2 w-2 rounded-full ${config.dotClass}`} />
            {t(`matchStatus.${enumKey(config.label)}`)}
          </span>
        );
      },
      enableSorting: false,
    },

    // 11. Source (icon only, KSeF badge for KSEF source)
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

    // 12. E-invoice compliance (Phase 61 · Plan 61-08)
    {
      id: 'einvoiceCompliance',
      accessorFn: row => deriveComplianceStatus(row.eInvoiceLifecycle),
      header: t('columns.einvoiceCompliance'),
      cell: ({ row }) => {
        const status = deriveComplianceStatus(row.original.eInvoiceLifecycle);
        return (
          <EInvoiceStatusCell
            status={status}
            invoiceId={row.original.id}
            // biome-ignore lint/nursery/noJsxPropsBind: stopPropagation to avoid opening side panel
            className="inline-flex"
          />
        );
      },
      enableSorting: false,
    },

    // 13. Overdue interest (Phase 63 · Plan 63-07 — PAY-06)
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
            {formatMinorUnits(amount)}
          </span>
        );
      },
      enableSorting: true,
    },

    // 14. Skonto (Phase 63 · Plan 63-07 — PAY-07)
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
