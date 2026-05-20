'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

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
  const t = useTranslations('Time');
  const id = useId();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const title = isBulk ? t('rejectionDialog.bulkTitle', { count }) : t('rejectionDialog.title');

  const description = isBulk
    ? t('rejectionDialog.bulkDescription')
    : t('rejectionDialog.description');

  function handleSubmit() {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setError(t('rejectionDialog.minLengthError'));
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
    // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor={`${id}-rejection-reason`}>{t('rejectionDialog.reasonLabel')}</Label>
          <Textarea
            id={`${id}-rejection-reason`}
            value={reason}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder={t('rejectionDialog.reasonPlaceholder')}
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
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            {t('rejectionDialog.keepReviewing')}
          </Button>
          <Button
            variant="destructive"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={handleSubmit}
            disabled={isSubmitting || reason.trim().length < 10}>
            {isSubmitting ? t('rejectionDialog.rejecting') : t('rejectionDialog.rejectButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
