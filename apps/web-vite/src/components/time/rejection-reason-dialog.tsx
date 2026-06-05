/**
 * Rejection reason dialog (single + bulk).
 */

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
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';

interface RejectionReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isSubmitting: boolean;
  isBulk?: boolean;
  count?: number;
}

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

  const handleSubmit = useCallback(() => {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setError(t('rejectionDialog.minLengthError'));
      return;
    }
    setError(null);
    onConfirm(trimmed);
  }, [reason, t, onConfirm]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setReason('');
        setError(null);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const handleReasonChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setReason(e.target.value);
      if (error) setError(null);
    },
    [error],
  );

  const handleCancelClick = useCallback(() => handleOpenChange(false), [handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-2 py-2">
          <Label htmlFor={`${id}-rejection-reason`}>{t('rejectionDialog.reasonLabel')}</Label>
          <Textarea
            id={`${id}-rejection-reason`}
            value={reason}
            onChange={handleReasonChange}
            placeholder={t('rejectionDialog.reasonPlaceholder')}
            maxLength={500}
            rows={4}
            className={error ? 'border-destructive' : ''}
          />
          <div className="flex items-center justify-between">
            {error ? <p className="text-xs text-destructive">{error}</p> : <span />}
            <p className="text-xs text-muted-foreground">{reason.length}/500</p>
          </div>
        </DialogBody>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancelClick} disabled={isSubmitting}>
            {t('rejectionDialog.keepReviewing')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || reason.trim().length < 10}>
            {isSubmitting ? t('rejectionDialog.rejecting') : t('rejectionDialog.rejectButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
