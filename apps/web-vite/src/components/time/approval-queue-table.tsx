/**
 * Approval queue table for pending timesheets. Ported from
 * apps/web/src/components/time/approval-queue-table.tsx:
 *   - next-intl → ../../i18n/useTranslations.js
 *   - @/lib/utils → ../../lib/utils.js
 */

import { AtelierTableShell, TableChrome } from '@contractor-ops/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { addDays, format, startOfISOWeek } from 'date-fns';
import { CheckCircle, XCircle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';
import { RejectionReasonDialog } from './rejection-reason-dialog.js';
import { TimeEntryStatusBadge } from './time-entry-status-badge.js';

export interface TimesheetRow {
  id: string;
  weekStartDate: string | Date;
  totalMinutes: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  submittedAt?: string | Date | null;
  contractor: {
    id: string;
    legalName: string;
    email: string | null;
  };
  _count?: { entries: number };
}

interface ApprovalQueueTableProps {
  timesheets: TimesheetRow[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onBulkApprove: (ids: string[]) => void;
  onBulkReject: (ids: string[], reason: string) => void;
  onNavigateToReview: (contractorId: string, weekStartDate: string) => void;
  isLoading?: boolean;
  isApproving?: boolean;
  isRejecting?: boolean;
  isBulkApproving?: boolean;
  isBulkRejecting?: boolean;
}

function formatPeriod(weekStart: string | Date): string {
  const start = typeof weekStart === 'string' ? new Date(weekStart) : weekStart;
  const monday = startOfISOWeek(start);
  const sunday = addDays(monday, 6);
  return `${format(monday, 'MMM d')} - ${format(sunday, 'MMM d')}`;
}

function minutesToDisplay(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function toDateStr(d: string | Date): string {
  if (typeof d === 'string') return d.split('T')[0] ?? d;
  return format(d, 'yyyy-MM-dd');
}

export function ApprovalQueueTable({
  timesheets,
  onApprove,
  onReject,
  onBulkApprove,
  onBulkReject,
  onNavigateToReview,
  isApproving = false,
  isRejecting = false,
  isBulkApproving = false,
  isBulkRejecting = false,
  isLoading = false,
}: ApprovalQueueTableProps) {
  const t = useTranslations('Time');
  const tCommon = useTranslations('Common');
  const tAria = useTranslations('Common.aria');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allSelected = timesheets.length > 0 && selectedIds.size === timesheets.length;
  const someSelected = selectedIds.size > 0;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(timesheets.map(ts => ts.id)));
    }
  }, [allSelected, timesheets]);

  const toggleRow = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSingleReject = useCallback(
    (reason: string) => {
      if (!rejectingId) return;
      setIsSubmitting(true);
      onReject(rejectingId, reason);
      setRejectingId(null);
      setIsSubmitting(false);
    },
    [rejectingId, onReject],
  );

  const handleBulkApproveConfirm = useCallback(() => {
    const ids = Array.from(selectedIds);
    onBulkApprove(ids);
    setSelectedIds(new Set());
    setBulkApproveOpen(false);
  }, [selectedIds, onBulkApprove]);

  const handleBulkRejectConfirm = useCallback(
    (reason: string) => {
      const ids = Array.from(selectedIds);
      onBulkReject(ids, reason);
      setSelectedIds(new Set());
      setBulkRejectOpen(false);
    },
    [selectedIds, onBulkReject],
  );

  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`skel-${i}`} className="flex items-center gap-4 rounded-lg border px-4 py-3">
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <AtelierTableShell
        chrome={
          <TableChrome
            totalCount={timesheets.length}
            entityLabel={t('timesheetEntityLabel', { count: timesheets.length })}
            densityLabels={{
              comfortable: tAria('densityComfortable'),
              compact: tAria('densityCompact'),
            }}
          />
        }>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label={t('approvalQueue.selectAll')}
                />
              </TableHead>
              <TableHead>{t('columns.contractor')}</TableHead>
              <TableHead>{t('columns.period')}</TableHead>
              <TableHead className="text-end">{t('columns.totalHours')}</TableHead>
              <TableHead>{t('columns.entries')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              <TableHead className="text-end">{t('columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timesheets.map(ts => (
              <TableRow
                key={ts.id}
                className={cn('group', selectedIds.has(ts.id) && 'bg-muted/50')}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(ts.id)}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                    onCheckedChange={() => toggleRow(ts.id)}
                    aria-label={`Select timesheet for ${ts.contractor.legalName}`}
                  />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onClick={() =>
                      onNavigateToReview(ts.contractor.id, toDateStr(ts.weekStartDate))
                    }>
                    {ts.contractor.legalName}
                  </button>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatPeriod(ts.weekStartDate)}
                </TableCell>
                <TableCell className="text-end text-sm font-medium">
                  {minutesToDisplay(ts.totalMinutes)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {ts._count?.entries ?? '-'}
                </TableCell>
                <TableCell>
                  <TimeEntryStatusBadge status={ts.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={isApproving}
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onClick={() => onApprove(ts.id)}>
                      <CheckCircle className="me-1.5 h-3.5 w-3.5" />
                      {t('approvalQueue.approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={isRejecting}
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onClick={() => setRejectingId(ts.id)}>
                      <XCircle className="me-1.5 h-3.5 w-3.5" />
                      {t('approvalQueue.reject')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AtelierTableShell>

      {someSelected && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-card px-6 py-3 shadow-lg animate-in slide-in-from-bottom-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('approvalQueue.selected', { count: selectedArray.length })}
            </p>
            <div className="flex items-center gap-2">
              {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                {t('approvalQueue.clear')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                disabled={isBulkRejecting}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => setBulkRejectOpen(true)}>
                {t('approvalQueue.rejectAll')}
              </Button>
              <Button
                size="sm"
                disabled={isBulkApproving}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => setBulkApproveOpen(true)}>
                {t('approvalQueue.approveAll')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <RejectionReasonDialog
        open={rejectingId !== null}
        // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
        onOpenChange={open => {
          if (!open) setRejectingId(null);
        }}
        onConfirm={handleSingleReject}
        isSubmitting={isSubmitting}
      />

      <RejectionReasonDialog
        open={bulkRejectOpen}
        onOpenChange={setBulkRejectOpen}
        onConfirm={handleBulkRejectConfirm}
        isSubmitting={false}
        isBulk
        count={selectedArray.length}
      />

      <AlertDialog open={bulkApproveOpen} onOpenChange={setBulkApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('approvalQueue.bulkApproveTitle', { count: selectedArray.length })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('approvalQueue.bulkApproveDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkApproveConfirm}>
              <CheckCircle className="me-1.5 size-4" />
              {t('approvalQueue.approveAll')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
