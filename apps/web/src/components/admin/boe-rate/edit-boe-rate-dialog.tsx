'use client';

// apps/web/src/components/admin/boe-rate/edit-boe-rate-dialog.tsx
//
// Phase 63 · Plan 05 · D-10 — Dialog for editing an existing BoE base rate entry.
// Warning tooltip shown for cron-sourced (BOE_API) entries.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/trpc/init';

// Source of truth: router output. Avoids drift when the Prisma generator
// changes runtime types (e.g. Decimal vs string|number for ratePercent).
type BoeRateEntry = import('@trpc/server').inferRouterOutputs<
  import('@contractor-ops/api').AppRouter
>['adminBoeRate']['list'][number];

interface EditBoeRateDialogProps {
  entry: BoeRateEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditBoeRateDialog({ entry, open, onOpenChange }: EditBoeRateDialogProps) {
  const t = useTranslations('Admin.BoeRate');
  const tCommon = useTranslations('Common');

  const [ratePercent, setRatePercent] = useState('');
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();

  useEffect(() => {
    setRatePercent(Number(entry.ratePercent).toFixed(2));
    setNotes(entry.notes ?? '');
  }, [entry]);

  const updateMutation = useMutation(
    trpc.adminBoeRate.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.adminBoeRate.list.queryKey(),
        });
        toast.success(t('toastRateUpdated'), {
          description: t('toastRateUpdatedDesc'),
        });
        onOpenChange(false);
      },
      onError: error => {
        toast.error(t('toastError'), { description: error.message });
      },
    }),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const rate = parseFloat(ratePercent);
    if (Number.isNaN(rate) || rate < 0 || rate > 99.99) {
      toast.error(t('toastValidationError'), {
        description: t('validationRateRange'),
      });
      return;
    }

    updateMutation.mutate({
      id: entry.id,
      ratePercent: rate,
      notes: notes || undefined,
    });
  }

  const effectiveDate = new Date(entry.effectiveFrom).toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editDialogTitle')}</DialogTitle>
          <DialogDescription>{t('editDialogDesc', { date: effectiveDate })}</DialogDescription>
        </DialogHeader>

        {entry.source === 'BOE_API' && (
          <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('editApiSourceWarning')}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('colEffectiveFrom')}</Label>
            <Input type="date" value={effectiveDate} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-rate-percent">{t('colRatePercent')}</Label>
            <Input
              id="edit-rate-percent"
              type="number"
              step="0.01"
              min="0"
              max="99.99"
              value={ratePercent}
              onChange={e => setRatePercent(e.target.value)}
              className="tabular-nums"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">{t('colNotes')}</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('editNotesPlaceholder')}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t('saving') : t('saveChanges')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
