'use client';

// apps/web/src/components/admin/boe-rate/delete-boe-rate-dialog.tsx
//
// Phase 63 · Plan 05 · D-10 — Destructive confirmation dialog for deleting a BoE rate entry.
// AlertDialog with destructive button last in tab order per UI-SPEC.

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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';

// Source of truth: router output. Avoids drift when the Prisma generator
// changes runtime types (e.g. Decimal vs string|number for ratePercent).
type BoeRateEntry = import('@trpc/server').inferRouterOutputs<
  import('@contractor-ops/api').AppRouter
>['adminBoeRate']['list'][number];

interface DeleteBoeRateDialogProps {
  entry: BoeRateEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteBoeRateDialog({ entry, open, onOpenChange }: DeleteBoeRateDialogProps) {
  const t = useTranslations('Admin.BoeRate');
  const tCommon = useTranslations('Common');

  const queryClient = useQueryClient();

  const deleteMutation = useMutation(
    trpc.adminBoeRate.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.adminBoeRate.list.queryKey(),
        });
        toast.success(t('toastRateDeleted'), {
          description: t('toastRateDeletedDesc'),
        });
        onOpenChange(false);
      },
      onError: error => {
        toast.error(t('toastError'), { description: error.message });
      },
    }),
  );

  const effectiveDate = new Date(entry.effectiveFrom).toISOString().slice(0, 10);
  const rate = Number(entry.ratePercent).toFixed(2);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteDialogTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteDialogBodyDynamic', { date: effectiveDate, rate })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Cancel first in tab order; destructive last */}
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => deleteMutation.mutate({ id: entry.id })}
            disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? t('deleting') : t('deleteRate')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
