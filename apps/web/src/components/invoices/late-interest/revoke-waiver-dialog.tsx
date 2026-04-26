'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Revoke waiver dialog (destructive AlertDialog)
// ---------------------------------------------------------------------------

interface RevokeWaiverDialogProps {
  invoiceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RevokeWaiverDialog({ invoiceId, open, onOpenChange }: RevokeWaiverDialogProps) {
  const t = useTranslations('Payments.lateInterest.revokeWaiver');
  const utils = trpc.useUtils();

  const [reason, setReason] = useState('');
  const isReasonValid = reason.trim().length >= 10;

  const revokeMutation = trpc.latePaymentInterest.revokeWaiver.useMutation({
    onSuccess: () => {
      toast.success(t('successToast'));
      void utils.latePaymentInterest.getForInvoice.invalidate({ invoiceId });
      onOpenChange(false);
      setReason('');
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const handleConfirm = () => {
    if (!isReasonValid) return;
    revokeMutation.mutate({
      invoiceId,
      reason: reason.trim(),
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="revoke-reason">{t('reasonLabel')}</Label>
            <Textarea
              id="revoke-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
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
            disabled={!isReasonValid || revokeMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {revokeMutation.isPending ? t('confirming') : t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
