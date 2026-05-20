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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { tDyn } from '@/i18n/typed-keys';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Waive interest dialog (destructive AlertDialog)
// ---------------------------------------------------------------------------

const WAIVE_TYPES = ['STATUTORY_INTEREST', 'COMPENSATION', 'BOTH'] as const;
type WaiveType = (typeof WAIVE_TYPES)[number];

interface WaiveDialogProps {
  invoiceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WaiveDialog({ invoiceId, open, onOpenChange }: WaiveDialogProps) {
  const t = useTranslations('Payments.lateInterest.waive');
  const queryClient = useQueryClient();

  const [waiveType, setWaiveType] = useState<WaiveType>('BOTH');
  const [reason, setReason] = useState('');

  const isReasonValid = reason.trim().length >= 10;

  const waiveMutation = useMutation(
    trpc.latePaymentInterest.waive.mutationOptions({
      onSuccess: () => {
        toast.success(t('successToast'));
        void queryClient.invalidateQueries({
          queryKey: trpc.latePaymentInterest.getForInvoice.queryKey({ invoiceId }),
        });
        onOpenChange(false);
        setReason('');
        setWaiveType('BOTH');
      },
      onError: (error: { message: string }) => {
        toast.error(error.message);
      },
    }),
  );

  const handleConfirm = () => {
    if (!isReasonValid) return;
    waiveMutation.mutate({
      invoiceId,
      waiveType,
      reason: reason.trim(),
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Archive className="size-4" />
            {t('title')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="waive-type">{t('typeLabel')}</Label>
            <Select
              value={waiveType}
              onValueChange={v => {
                if (v) setWaiveType(v as WaiveType);
              }}>
              <SelectTrigger id="waive-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WAIVE_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {tDyn(t, 'types', type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="waive-reason">{t('reasonLabel')}</Label>
            <Textarea
              id="waive-reason"
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
            disabled={!isReasonValid || waiveMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {waiveMutation.isPending ? t('confirming') : t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
