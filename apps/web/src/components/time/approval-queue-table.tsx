'use client';

import { addDays, format, startOfISOWeek } from 'date-fns';
import { CheckCircle, XCircle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { RejectionReasonDialog } from './rejection-reason-dialog';
import { TimeEntryStatusBadge } from './time-entry-status-badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  if (typeof d === 'string') return d.split('T')[0]!;
  return format(d, 'yyyy-MM-dd');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Table of pending timesheets for manager approval (D-05, D-07).
 * Supports bulk selection with batch approve/reject.
 * Clicking contractor name navigates to per-contractor review.
 */
export function ApprovalQueueTable({
  timesheets,
  onApprove,
  onReject,
  onBulkApprove,
  onBulkReject,
  onNavigateToReview,
  isLoading = false,
}: ApprovalQueueTableProps) {
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
      setSelectedIds(new Set(timesheets.map(t => t.id)));
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
      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all timesheets"
                />
              </TableHead>
              <TableHead>Contractor</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-end">Total Hours</TableHead>
              <TableHead>Entries</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-end">Actions</TableHead>
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
                    onCheckedChange={() => toggleRow(ts.id)}
                    aria-label={`Select timesheet for ${ts.contractor.legalName}`}
                  />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
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
                    <Button size="sm" variant="default" onClick={() => onApprove(ts.id)}>
                      <CheckCircle className="me-1.5 h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setRejectingId(ts.id)}>
                      <XCircle className="me-1.5 h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Batch action bar */}
      {someSelected && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-card px-6 py-3 shadow-lg animate-in slide-in-from-bottom-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedArray.length} timesheet{selectedArray.length !== 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setBulkRejectOpen(true)}>
                Reject All
              </Button>
              <Button size="sm" onClick={() => setBulkApproveOpen(true)}>
                Approve All
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Single rejection dialog */}
      <RejectionReasonDialog
        open={rejectingId !== null}
        onOpenChange={open => {
          if (!open) setRejectingId(null);
        }}
        onConfirm={handleSingleReject}
        isSubmitting={isSubmitting}
      />

      {/* Bulk rejection dialog */}
      <RejectionReasonDialog
        open={bulkRejectOpen}
        onOpenChange={setBulkRejectOpen}
        onConfirm={handleBulkRejectConfirm}
        isSubmitting={false}
        isBulk
        count={selectedArray.length}
      />

      {/* Bulk approve confirmation */}
      <AlertDialog open={bulkApproveOpen} onOpenChange={setBulkApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Approve {selectedArray.length} Timesheet{selectedArray.length !== 1 ? 's' : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will approve all selected timesheets. The contractors will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkApproveConfirm}>Approve All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
