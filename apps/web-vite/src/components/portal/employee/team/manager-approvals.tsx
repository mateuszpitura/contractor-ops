/**
 * Manager approvals — the caller's reports' pending leave requests with
 * approve/reject actions. Every list is server-scoped to direct reports (96-06);
 * the row's reportWorkerId is validated server-side against the reporting-line
 * edge, so the UI cannot approve for a non-report. Presentational views only; the
 * tRPC boundary is `use-manager-approvals`.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { AlertCircle, Check, ClipboardCheck, Loader2, ShieldOff, X } from 'lucide-react';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { SectionCard, SectionMessage, SectionSkeleton } from '../employee-section-shell.js';
import type { ReportLeaveRow } from './hooks/use-manager-approvals.js';
import { useManagerApprovals } from './hooks/use-manager-approvals.js';

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  CANCELLED: 'outline',
};

interface RejectDialogProps {
  target: ReportLeaveRow | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isRejecting: boolean;
}

export function RejectDialog({ target, onOpenChange, onConfirm, isRejecting }: RejectDialogProps) {
  const t = useTranslations('Portal.employee.team.approvals.reject');
  const reasonId = useId();
  const [reason, setReason] = useState('');

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setReason('');
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const handleConfirm = useCallback(() => onConfirm(reason), [onConfirm, reason]);
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={target !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description', { name: target?.reportName ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-1.5">
            <Label htmlFor={reasonId}>{t('reason')}</Label>
            <Textarea
              id={reasonId}
              rows={3}
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder={t('reasonPlaceholder')}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isRejecting}>
            {!!isRejecting && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ApprovalRowProps {
  row: ReportLeaveRow;
  onApprove: (row: ReportLeaveRow) => void;
  onReject: (row: ReportLeaveRow) => void;
  isBusy: boolean;
}

function ApprovalRow({ row, onApprove, onReject, isBusy }: ApprovalRowProps) {
  const t = useTranslations('Portal.employee.team.approvals');
  const handleApprove = useCallback(() => onApprove(row), [onApprove, row]);
  const handleReject = useCallback(() => onReject(row), [onReject, row]);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{row.reportName ?? t('unnamedReport')}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(row.startDate).toLocaleDateString()} –{' '}
          {new Date(row.endDate).toLocaleDateString()} · {formatHours(row.requestedMinutes)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={STATUS_VARIANT[row.status] ?? 'secondary'}>
          {t(`status.${row.status}`)}
        </Badge>
        <Button size="sm" variant="outline" onClick={handleReject} disabled={isBusy}>
          <X className="me-1 h-3.5 w-3.5" aria-hidden="true" />
          {t('reject.action')}
        </Button>
        <Button size="sm" onClick={handleApprove} disabled={isBusy}>
          <Check className="me-1 h-3.5 w-3.5" aria-hidden="true" />
          {t('approve')}
        </Button>
      </div>
    </li>
  );
}

interface ManagerApprovalsViewProps {
  rows: ReportLeaveRow[];
  onApprove: (row: ReportLeaveRow) => void;
  onReject: (row: ReportLeaveRow) => void;
  isBusy: boolean;
}

export function ManagerApprovalsView({
  rows,
  onApprove,
  onReject,
  isBusy,
}: ManagerApprovalsViewProps) {
  const t = useTranslations('Portal.employee.team.approvals');
  return (
    <SectionCard icon={ClipboardCheck} title={t('title')} description={t('description')}>
      <ul className="divide-y rounded-lg border">
        {rows.map(row => (
          <ApprovalRow
            key={row.id}
            row={row}
            onApprove={onApprove}
            onReject={onReject}
            isBusy={isBusy}
          />
        ))}
      </ul>
    </SectionCard>
  );
}

export function ManagerApprovals() {
  const t = useTranslations('Portal.employee.team.approvals');
  const approvals = useManagerApprovals();
  const { setRejectTarget } = approvals;
  const closeRejectDialog = useCallback(
    (open: boolean) => {
      if (!open) setRejectTarget(null);
    },
    [setRejectTarget],
  );

  if (approvals.isLoading) return <SectionSkeleton rows={4} />;
  if (approvals.isForbidden) {
    return (
      <SectionCard icon={ShieldOff} title={t('title')}>
        <SectionMessage icon={ShieldOff} title={t('forbiddenTitle')} description={t('forbidden')} />
      </SectionCard>
    );
  }
  if (approvals.isError) {
    return (
      <SectionCard icon={ClipboardCheck} title={t('title')}>
        <SectionMessage
          icon={AlertCircle}
          tone="danger"
          title={t('errorTitle')}
          description={t('error')}
        />
      </SectionCard>
    );
  }
  if (approvals.isEmpty) {
    return (
      <SectionCard icon={ClipboardCheck} title={t('title')} description={t('description')}>
        <SectionMessage icon={ClipboardCheck} title={t('emptyTitle')} description={t('empty')} />
      </SectionCard>
    );
  }

  return (
    <>
      <ManagerApprovalsView
        rows={approvals.rows}
        onApprove={approvals.approve}
        onReject={approvals.setRejectTarget}
        isBusy={approvals.isApproving || approvals.isRejecting}
      />
      <RejectDialog
        target={approvals.rejectTarget}
        onOpenChange={closeRejectDialog}
        onConfirm={approvals.confirmReject}
        isRejecting={approvals.isRejecting}
      />
    </>
  );
}
