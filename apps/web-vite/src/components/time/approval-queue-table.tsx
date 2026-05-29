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
import type { ColumnDef } from '@tanstack/react-table';
import { addDays, format, startOfISOWeek } from 'date-fns';
import { CheckCircle, XCircle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { SimpleDataTable } from '../shared/simple-data-table.js';
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

  const columns = useMemo<ColumnDef<TimesheetRow, unknown>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            aria-label={t('approvalQueue.selectAll')}
          />
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
            onCheckedChange={() => toggleRow(row.original.id)}
            aria-label={`Select timesheet for ${row.original.contractor.legalName}`}
          />
        ),
        size: 48,
      },
      {
        id: 'contractor',
        accessorFn: row => row.contractor.legalName,
        header: t('columns.contractor'),
        cell: ({ row }) => (
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() =>
              onNavigateToReview(row.original.contractor.id, toDateStr(row.original.weekStartDate))
            }>
            {row.original.contractor.legalName}
          </button>
        ),
      },
      {
        id: 'period',
        accessorFn: row => new Date(row.weekStartDate).getTime(),
        header: t('columns.period'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatPeriod(row.original.weekStartDate)}
          </span>
        ),
      },
      {
        id: 'totalHours',
        accessorKey: 'totalMinutes',
        header: () => <span className="block text-end">{t('columns.totalHours')}</span>,
        cell: ({ row }) => (
          <span className="block text-end text-sm font-medium">
            {minutesToDisplay(row.original.totalMinutes)}
          </span>
        ),
      },
      {
        id: 'entries',
        accessorFn: row => row._count?.entries ?? 0,
        header: t('columns.entries'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original._count?.entries ?? '-'}
          </span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: t('columns.status'),
        cell: ({ row }) => <TimeEntryStatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: () => <span className="block text-end">{t('columns.actions')}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
            <Button
              size="sm"
              variant="default"
              disabled={isApproving}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => onApprove(row.original.id)}>
              <CheckCircle className="me-1.5 h-3.5 w-3.5" />
              {t('approvalQueue.approve')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              disabled={isRejecting}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => setRejectingId(row.original.id)}>
              <XCircle className="me-1.5 h-3.5 w-3.5" />
              {t('approvalQueue.reject')}
            </Button>
          </div>
        ),
      },
    ],
    [
      t,
      allSelected,
      toggleAll,
      selectedIds,
      toggleRow,
      onNavigateToReview,
      onApprove,
      isApproving,
      isRejecting,
    ],
  );

  return (
    <>
      <SimpleDataTable
        columns={columns}
        data={timesheets}
        isLoading={isLoading}
        entityLabel={t('timesheetEntityLabel', { count: timesheets.length })}
        emptyTitle={t('approvalQueue.empty.heading')}
        emptyDescription={t('approvalQueue.empty.body')}
        noResultsTitle={t('approvalQueue.empty.heading')}
        noResultsDescription={t('approvalQueue.empty.body')}
        rowClassName={row => `group ${selectedIds.has(row.id) ? 'bg-muted/50' : ''}`}
      />

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
