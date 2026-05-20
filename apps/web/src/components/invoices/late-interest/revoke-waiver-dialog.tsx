'use client';

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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Revoke waiver dialog (destructive AlertDialog)
// ---------------------------------------------------------------------------

interface RevokeWaiverDialogProps {
  invoiceId: string;
  waiverId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RevokeWaiverDialog({
  invoiceId,
  waiverId,
  open,
  onOpenChange,
}: RevokeWaiverDialogProps) {
  const t = useTranslations('Payments.lateInterest.revokeWaiver');
  const queryClient = useQueryClient();

  const [reason, setReason] = useState('');
  const isReasonValid = reason.trim().length >= 10;

  const revokeMutation = useMutation(
    trpc.latePaymentInterest.revokeWaiver.mutationOptions({
      onSuccess: () => {
        toast.success(t('successToast'));
        void queryClient.invalidateQueries({
          queryKey: trpc.latePaymentInterest.getForInvoice.queryKey({ invoiceId }),
        });
        onOpenChange(false);
        setReason('');
      },
      onError: (error: { message: string }) => {
        toast.error(error.message);
      },
    }),
  );

  const handleConfirm = () => {
    if (!isReasonValid) return;
    revokeMutation.mutate({
      waiverId,
      revokeReason: reason.trim(),
    });
  };

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
