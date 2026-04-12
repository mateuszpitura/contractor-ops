'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RejectionReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isSubmitting: boolean;
  /** When true, title and description adapt for bulk rejection */
  isBulk?: boolean;
  /** Number of timesheets being rejected (shown in bulk mode) */
  count?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Dialog for entering a rejection reason (D-07).
 * Requires a minimum of 10 characters, max 500.
 * Supports both single and bulk rejection modes.
 */
export function RejectionReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
  isBulk = false,
  count = 0,
}: RejectionReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const title = isBulk ? `Reject ${count} Timesheet${count === 1 ? '' : 's'}` : 'Reject Timesheet';

  const description = isBulk
    ? 'All selected timesheets will be rejected with the same reason.'
    : 'Please provide a reason for rejection. The contractor will be notified and can resubmit corrections.';

  function handleSubmit() {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setError('Reason must be at least 10 characters.');
      return;
    }
    setError(null);
    onConfirm(trimmed);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      // Reset state on close
      setReason('');
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="rejection-reason">Rejection Reason</Label>
          <Textarea
            id="rejection-reason"
            value={reason}
            onChange={e => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Describe what needs to be corrected..."
            maxLength={500}
            rows={4}
            className={error ? 'border-destructive' : ''}
          />
          <div className="flex items-center justify-between">
            {error ? <p className="text-xs text-destructive">{error}</p> : <span />}
            <p className="text-xs text-muted-foreground">{reason.length}/500</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Keep Reviewing
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || reason.trim().length < 10}>
            {isSubmitting ? 'Rejecting...' : 'Reject Timesheet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
