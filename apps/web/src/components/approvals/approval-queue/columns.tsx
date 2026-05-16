'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Link } from '@/i18n/navigation';
import type { TranslatorOf } from '@/i18n/typed-keys';

import { formatMinorUnits } from '@/lib/format-currency';
import { SlaBadge } from '../sla-badge';

// ---------------------------------------------------------------------------
// Row type matching the tRPC approval.listPending response shape
// ---------------------------------------------------------------------------

export type ApprovalQueueRow = {
  id: string;
  stepOrder: number;
  name: string;
  status: string;
  approverUserId: string | null;
  approverRole: string | null;
  slaDeadline: string | null;
  createdAt: string;
  approvalFlow: {
    id: string;
    resourceId: string;
    resourceType: string;
    status: string;
    startedAt: string;
    chainConfigId: string | null;
  };
  approver: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  invoice: {
    id: string;
    invoiceNumber: string;
    sellerName: string | null;
    totalMinor: number;
    currency: string;
    createdAt: string;
    contractor: {
      id: string;
      legalName: string;
    } | null;
  } | null;
  slaStatus: {
    level: string;
    label: string;
    percentage: number | null;
    hoursRemaining: number | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Reject popover sub-component
// ---------------------------------------------------------------------------

function RejectPopover({
  onReject,
  t,
}: {
  onReject: (comment: string) => void;
  t: (key: string) => string;
}) {
  const reactId = useId();
  const [comment, setComment] = useState('');
  const [open, setOpen] = useState(false);

  const handleReject = () => {
    if (comment.length >= 10) {
      onReject(comment);
      setComment('');
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
        render={props => (
          <Button
            {...props}
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-destructive hover:text-destructive"
            // biome-ignore lint/nursery/noJsxPropsBind: stopPropagation in render-prop
            onClick={e => {
              e.stopPropagation();
              props.onClick?.(e);
            }}>
            <XCircle className="h-3.5 w-3.5" />
            {t('actions.reject')}
          </Button>
        )}
      />
      {/* biome-ignore lint/nursery/noJsxPropsBind: stopPropagation on popover */}
      <PopoverContent className="w-80 p-4" align="end" onClick={e => e.stopPropagation()}>
        <div className="space-y-3">
          <h4 className="font-medium text-sm">{t('rejectPopover.heading')}</h4>
          <div className="space-y-1.5">
            <label
              htmlFor={`${reactId}-reject-comment`}
              className="text-[12px] text-muted-foreground">
              {t('rejectPopover.commentLabel')}
            </label>
            <Textarea
              id={`${reactId}-reject-comment`}
              value={comment}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setComment(e.target.value)}
              placeholder={t('rejectPopover.commentPlaceholder')}
              className="min-h-[80px]"
            />
            {comment.length > 0 && comment.length < 10 && (
              <p className="text-[12px] text-destructive">{t('rejectPopover.minChars')}</p>
            )}
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              // biome-ignore lint/nursery/noJsxPropsBind: dismiss handler in popover
              onClick={() => {
                setOpen(false);
                setComment('');
              }}>
              {t('rejectPopover.dismiss')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={comment.length < 10}
              // biome-ignore lint/nursery/noJsxPropsBind: local handler in popover
              onClick={handleReject}>
              {t('rejectPopover.confirm')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

type TranslateFunction = TranslatorOf<'Approvals'>;

interface ColumnCallbacks {
  onApprove: (stepId: string) => void;
  onReject: (stepId: string, comment: string) => void;
}

/**
 * Returns all column definitions for the approval queue data table.
 * Accepts a translation function for headers and labels, and action callbacks.
 */
export function getColumns(
  t: TranslateFunction,
  callbacks: ColumnCallbacks,
  locale: string = 'en',
): ColumnDef<ApprovalQueueRow>[] {
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

    // 2. Invoice #
    {
      id: 'invoiceNumber',
      accessorFn: row => row.invoice?.invoiceNumber ?? '',
      header: t('columns.invoice'),
      cell: ({ row }) => {
        const invoice = row.original.invoice;
        if (!invoice) return <span className="text-muted-foreground">&mdash;</span>;
        return (
          <Link
            href={`/invoices/${row.original.approvalFlow.resourceId}`}
            className="font-mono text-sm text-primary hover:underline"
            // biome-ignore lint/nursery/noJsxPropsBind: column definition
            onClick={e => e.stopPropagation()}>
            {invoice.invoiceNumber}
          </Link>
        );
      },
      enableHiding: false,
    },

    // 3. Contractor
    {
      id: 'contractorName',
      accessorFn: row => row.invoice?.contractor?.legalName ?? row.invoice?.sellerName ?? '',
      header: t('columns.contractor'),
      cell: ({ row }) => {
        const invoice = row.original.invoice;
        const name = invoice?.contractor?.legalName ?? invoice?.sellerName ?? '';
        return <span className="text-sm">{name}</span>;
      },
    },

    // 4. Amount
    {
      id: 'totalMinor',
      accessorFn: row => row.invoice?.totalMinor ?? 0,
      header: () => <span className="text-end block">{t('columns.amount')}</span>,
      cell: ({ row }) => {
        const invoice = row.original.invoice;
        if (!invoice) return <span className="text-muted-foreground">&mdash;</span>;

        return (
          <span className="block text-end font-mono text-sm tabular-nums">
            {formatMinorUnits(invoice.totalMinor, invoice.currency, locale)}
          </span>
        );
      },
    },

    // 5. Submitted
    {
      id: 'submittedAt',
      accessorFn: row => row.approvalFlow.startedAt,
      header: t('columns.submitted'),
      cell: ({ row }) => {
        const startedAt = row.original.approvalFlow.startedAt;
        if (!startedAt) return <span className="text-muted-foreground">&mdash;</span>;

        try {
          const date = new Date(startedAt);
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffHours / 24);

          let label: string;
          if (diffDays > 0) {
            label = `${diffDays}d ago`;
          } else if (diffHours > 0) {
            label = `${diffHours}h ago`;
          } else {
            const diffMin = Math.floor(diffMs / 60000);
            label = `${Math.max(1, diffMin)}m ago`;
          }

          return <span className="text-sm text-muted-foreground">{label}</span>;
        } catch {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
      },
    },

    // 6. SLA remaining
    {
      id: 'slaDeadline',
      accessorFn: row => row.slaDeadline,
      header: t('columns.sla'),
      cell: ({ row }) => {
        const step = row.original;
        const slaHours = step.slaStatus?.hoursRemaining == null ? undefined : undefined;

        return <SlaBadge slaDeadline={step.slaDeadline} status={step.status} slaHours={slaHours} />;
      },
    },

    // 7. Actions (visible on hover)
    {
      id: 'actions',
      header: () => null,
      cell: ({ row }) => {
        const step = row.original;
        if (step.status !== 'PENDING') return null;

        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: onClick only stops propagation to prevent row click
          <div
            className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            role="presentation"
            // biome-ignore lint/nursery/noJsxPropsBind: column definition
            onClick={e => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-primary hover:text-primary"
              // biome-ignore lint/nursery/noJsxPropsBind: column definition
              onClick={e => {
                e.stopPropagation();
                callbacks.onApprove(step.id);
              }}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('actions.approve')}
            </Button>
            {/* biome-ignore lint/nursery/noJsxPropsBind: column definition */}
            <RejectPopover onReject={comment => callbacks.onReject(step.id, comment)} t={t} />
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
      size: 200,
    },
  ];
}
