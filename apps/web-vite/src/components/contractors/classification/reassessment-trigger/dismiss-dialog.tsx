// Phase 60 · CLASS-08 — ReassessmentTriggerDismissDialog.
// Step 11 codemod port from apps/web/src/components/contractors/classification/reassessment-trigger/dismiss-dialog.tsx.

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
import { useState } from 'react';

import { useTranslations } from '../../../../i18n/useTranslations.js';

const MIN_REASON_LENGTH = 10;

export interface ReassessmentTriggerDismissDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onConfirm: (reason: string) => void | Promise<void>;
  isSubmitting?: boolean;
}

export function ReassessmentTriggerDismissDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: ReassessmentTriggerDismissDialogProps) {
  const t = useTranslations('Classification.polish.reassessmentTrigger');
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  const isValid = reason.length >= MIN_REASON_LENGTH;

  async function handleConfirm() {
    setAttempted(true);
    if (!isValid) return;
    await onConfirm(reason);
    setReason('');
    setAttempted(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) {
          setReason('');
          setAttempted(false);
        }
        onOpenChange(next);
      }}>
      <DialogContent data-slot="reassessment-trigger-dismiss-dialog">
        <DialogHeader>
          <DialogTitle>{t('dismissHeading')}</DialogTitle>
          <DialogDescription>{t('dismissBody')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rt-dismiss-reason">{t('dismissReasonLabel')}</Label>
          <Textarea
            id="rt-dismiss-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            minLength={MIN_REASON_LENGTH}
            maxLength={1000}
            rows={4}
            aria-invalid={attempted && !isValid ? true : undefined}
            aria-describedby={attempted && !isValid ? 'rt-dismiss-reason-error' : undefined}
          />
          {attempted && !isValid ? (
            <p id="rt-dismiss-reason-error" role="alert" className="text-destructive text-xs">
              {t('dismissReasonMinLength')}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}>
            {t('dismissCancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isSubmitting}>
            {t('dismissConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
