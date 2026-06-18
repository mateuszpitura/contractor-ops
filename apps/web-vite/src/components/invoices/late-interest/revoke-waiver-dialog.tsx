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
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { XCircle } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';

interface RevokeWaiverDialogProps {
  waiverId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (waiverId: string, revokeReason: string) => void;
  isPending: boolean;
}

export function RevokeWaiverDialog({
  waiverId,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: RevokeWaiverDialogProps) {
  const t = useTranslations('Payments.lateInterest.revokeWaiver');
  const revokeReasonId = useId();

  const [reason, setReason] = useState('');
  const isReasonValid = reason.trim().length >= 10;

  const handleReasonChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setReason(event.target.value);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!isReasonValid) return;
    onConfirm(waiverId, reason);
    setReason('');
  }, [isReasonValid, onConfirm, waiverId, reason]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <XCircle className="size-4" />
            {t('title')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={revokeReasonId}>{t('reasonLabel')}</Label>
            <Textarea
              id={revokeReasonId}
              value={reason}
              onChange={handleReasonChange}
              placeholder={t('reasonPlaceholder')}
              minLength={10}
              className="min-h-[80px]"
            />
            {reason.length > 0 && !isReasonValid && (
              <p className="text-xs text-destructive">{t('reasonMinLength')}</p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isReasonValid || isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {isPending ? t('confirming') : t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
