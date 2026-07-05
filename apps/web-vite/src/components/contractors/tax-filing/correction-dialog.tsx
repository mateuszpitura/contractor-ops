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
import { Loader2 } from 'lucide-react';
import { useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';

export interface CorrectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientName: string;
  onConfirm: (reason: string) => Promise<void>;
  isSubmitting: boolean;
}

/**
 * CORRECTED-filing confirm. A correction supersedes the previously-filed 1099-NEC
 * (the original is kept, never edited) — the copy states that reversibility. Not
 * a delete: content scrolls in DialogBody, the sticky DialogFooter holds actions.
 */
export function CorrectionDialog({
  open,
  onOpenChange,
  recipientName,
  onConfirm,
  isSubmitting,
}: CorrectionDialogProps) {
  const t = useTranslations('Tax1099Filing');
  const reasonId = useId();
  const [reason, setReason] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('correction.title')}</DialogTitle>
          <DialogDescription>
            {t('correction.body', { recipient: recipientName })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-2">
            <Label htmlFor={reasonId} className="font-normal text-sm">
              {t('correction.reasonLabel')}
            </Label>
            <Textarea
              id={reasonId}
              value={reason}
              onChange={event => setReason(event.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}>
            {t('correction.cancel')}
          </Button>
          <Button
            type="button"
            disabled={reason.trim().length === 0 || isSubmitting}
            onClick={async () => {
              await onConfirm(reason.trim());
              setReason('');
            }}>
            {isSubmitting ? <Loader2 className="me-2 size-4 animate-spin" aria-hidden /> : null}
            {t('correction.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
