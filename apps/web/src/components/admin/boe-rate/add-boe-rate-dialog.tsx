'use client';

// apps/web/src/components/admin/boe-rate/add-boe-rate-dialog.tsx
//
// Phase 63 · Plan 05 · D-10 — Dialog for adding a new BoE base rate entry.

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';

interface AddBoeRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddBoeRateDialog({ open, onOpenChange }: AddBoeRateDialogProps) {
  const t = useTranslations('Admin.BoeRate');
  const tCommon = useTranslations('Common');

  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [ratePercent, setRatePercent] = useState('');
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();

  const insertMutation = useMutation(
    trpc.adminBoeRate.insert.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.adminBoeRate.list.queryKey(),
        });
        toast.success(t('toastRateAdded'), {
          description: t('toastRateAddedDesc'),
        });
        resetForm();
        onOpenChange(false);
      },
      onError: error => {
        toast.error(t('toastError'), { description: error.message });
      },
    }),
  );

  function resetForm() {
    setEffectiveFrom('');
    setRatePercent('');
    setNotes('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const rate = parseFloat(ratePercent);
    if (Number.isNaN(rate) || rate < 0 || rate > 99.99) {
      toast.error(t('toastValidationError'), {
        description: t('validationRateRange'),
      });
      return;
    }

    if (!effectiveFrom) {
      toast.error(t('toastValidationError'), {
        description: t('validationDateRequired'),
      });
      return;
    }

    insertMutation.mutate({
      effectiveFrom: new Date(effectiveFrom),
      ratePercent: rate,
      notes: notes || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addDialogTitle')}</DialogTitle>
          <DialogDescription>{t('addDialogDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-effective-from">{t('colEffectiveFrom')}</Label>
            <Input
              id="add-effective-from"
              type="date"
              value={effectiveFrom}
              onChange={e => setEffectiveFrom(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-rate-percent">{t('colRatePercent')}</Label>
            <Input
              id="add-rate-percent"
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
            <Label htmlFor="add-notes">{t('notesOptionalLabel')}</Label>
            <Textarea
              id="add-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={insertMutation.isPending}>
              {insertMutation.isPending ? t('saving') : t('saveRate')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
