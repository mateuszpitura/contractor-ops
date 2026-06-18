import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import type { ColumnDef, Row, Table } from '@tanstack/react-table';
import { CheckCircle2, XCircle } from 'lucide-react';
import { memo, useCallback, useId, useState } from 'react';

import { Link } from '../../../i18n/navigation.js';
import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { formatMinorUnits } from '../../../lib/money.js';
import { SlaBadge } from '../sla-badge.js';

function stopRowPropagation(e: React.MouseEvent) {
  e.stopPropagation();
}

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

function RejectTriggerButton(props: React.HTMLAttributes<HTMLButtonElement> & { label: string }) {
  const { label, onClick, ...rest } = props;
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onClick?.(e);
    },
    [onClick],
  );
  return (
    <Button
      {...rest}
      variant="ghost"
      size="sm"
      className="h-7 gap-1 text-destructive hover:text-destructive"
      onClick={handleClick}>
      <XCircle className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

function RejectPopover({
  stepId,
  onReject,
  t,
  isRejecting = false,
}: {
  stepId: string;
  onReject: (stepId: string, comment: string) => void;
  t: LooseTranslator;
  isRejecting?: boolean;
}) {
  const reactId = useId();
  const [comment, setComment] = useState('');
  const [open, setOpen] = useState(false);

  const handleReject = useCallback(() => {
    if (comment.length >= 10) {
      onReject(stepId, comment);
      setComment('');
      setOpen(false);
    }
  }, [comment, onReject, stepId]);

  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value),
    [],
  );
  const handleDismiss = useCallback(() => {
    setOpen(false);
    setComment('');
  }, []);

  const rejectLabel = t('actions.reject');
  const renderTrigger = useCallback(
    (props: React.HTMLAttributes<HTMLButtonElement>) => (
      <RejectTriggerButton {...props} label={rejectLabel} />
    ),
    [rejectLabel],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={renderTrigger} />
      <PopoverContent className="w-80 p-4" align="end" onClick={stopRowPropagation}>
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
              onChange={handleCommentChange}
              placeholder={t('rejectPopover.commentPlaceholder')}
              className="min-h-[80px]"
            />
            {comment.length > 0 && comment.length < 10 && (
              <p className="text-[12px] text-destructive">{t('rejectPopover.minChars')}</p>
            )}
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              {t('rejectPopover.dismiss')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={comment.length < 10 || isRejecting}
              onClick={handleReject}>
              {t('rejectPopover.confirm')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type TranslateFunction = LooseTranslator;

interface ColumnCallbacks {
  onApprove: (stepId: string) => void;
  onReject: (stepId: string, comment: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

const SelectAllHeader = memo(function SelectAllHeader({
  table,
  label,
}: {
  table: Table<ApprovalQueueRow>;
  label: string;
}) {
  const handleChange = useCallback(
    (value: boolean) => table.toggleAllPageRowsSelected(!!value),
    [table],
  );
  return (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
      onCheckedChange={handleChange}
      aria-label={label}
    />
  );
});

const SelectRowCell = memo(function SelectRowCell({
  row,
  label,
}: {
  row: Row<ApprovalQueueRow>;
  label: string;
}) {
  const handleChange = useCallback((value: boolean) => row.toggleSelected(!!value), [row]);
  return (
    <Checkbox checked={row.getIsSelected()} onCheckedChange={handleChange} aria-label={label} />
  );
});

function InvoiceLinkCell({ row }: { row: Row<ApprovalQueueRow> }) {
  const invoice = row.original.invoice;
  if (!invoice) return <span className="text-muted-foreground">&mdash;</span>;
  return (
    <Link
      href={`/invoices/${row.original.approvalFlow.resourceId}`}
      className="font-mono text-sm text-primary hover:underline"
      onClick={stopRowPropagation}>
      {invoice.invoiceNumber}
    </Link>
  );
}

const ApproveActionButton = memo(function ApproveActionButton({
  stepId,
  onApprove,
  disabled,
  label,
}: {
  stepId: string;
  onApprove: (stepId: string) => void;
  disabled?: boolean;
  label: string;
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onApprove(stepId);
    },
    [onApprove, stepId],
  );
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1 text-primary hover:text-primary"
      disabled={disabled}
      onClick={handleClick}>
      <CheckCircle2 className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
});

export function getColumns(
  t: TranslateFunction,
  callbacks: ColumnCallbacks,
  locale: string = 'en',
): ColumnDef<ApprovalQueueRow>[] {
  const selectAllLabel = t('columns.selectAll');
  const selectRowLabel = t('columns.selectRow');
  const approveLabel = t('actions.approve');

  return [
    {
      id: 'select',
      header: ({ table }) => <SelectAllHeader table={table} label={selectAllLabel} />,
      cell: ({ row }) => <SelectRowCell row={row} label={selectRowLabel} />,
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      id: 'invoiceNumber',
      accessorFn: row => row.invoice?.invoiceNumber ?? '',
      header: t('columns.invoice'),
      cell: ({ row }) => <InvoiceLinkCell row={row} />,
      enableHiding: false,
    },
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
    {
      id: 'slaDeadline',
      accessorFn: row => row.slaDeadline,
      header: t('columns.sla'),
      cell: ({ row }) => {
        const step = row.original;
        const slaHours = step.slaStatus?.hoursRemaining ?? undefined;

        return <SlaBadge slaDeadline={step.slaDeadline} status={step.status} slaHours={slaHours} />;
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">{t('columns.actions')}</span>,
      cell: ({ row }) => (
        <ActionsCell row={row} callbacks={callbacks} t={t} approveLabel={approveLabel} />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 200,
    },
  ];
}

function ActionsCell({
  row,
  callbacks,
  t,
  approveLabel,
}: {
  row: Row<ApprovalQueueRow>;
  callbacks: ColumnCallbacks;
  t: TranslateFunction;
  approveLabel: string;
}) {
  const step = row.original;
  if (step.status !== 'PENDING') return null;

  return (
    <div
      className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      data-row-click-ignore>
      <ApproveActionButton
        stepId={step.id}
        onApprove={callbacks.onApprove}
        disabled={callbacks.isApproving}
        label={approveLabel}
      />
      <RejectPopover
        stepId={step.id}
        onReject={callbacks.onReject}
        t={t}
        isRejecting={callbacks.isRejecting}
      />
    </div>
  );
}
