/**
 * Edit BoE rate dialog.
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
  dialogFormLayoutClassName,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { AlertTriangleIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type {
  BoeRateEntry,
  useBoeRateUpdate,
  useBoeRateValidation,
} from '../hooks/use-admin-boe-rate.js';

export type { BoeRateEntry };

interface EditBoeRateDialogProps {
  entry: BoeRateEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validation: ReturnType<typeof useBoeRateValidation>;
  updateMutation: ReturnType<typeof useBoeRateUpdate>;
}

export function EditBoeRateDialog({
  entry,
  open,
  onOpenChange,
  validation,
  updateMutation,
}: EditBoeRateDialogProps) {
  const t = useTranslations('Admin.BoeRate');
  const tCommon = useTranslations('Common');
  const { validateRate } = validation;

  const [ratePercent, setRatePercent] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setRatePercent(Number(entry.ratePercent).toFixed(2));
    setNotes(entry.notes ?? '');
  }, [entry]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const rate = validateRate(ratePercent);
      if (rate === null) return;

      updateMutation.mutate({
        id: entry.id,
        ratePercent: rate,
        notes: notes || undefined,
      });
    },
    [entry.id, notes, ratePercent, updateMutation, validateRate],
  );

  const effectiveDate = new Date(entry.effectiveFrom).toISOString().slice(0, 10);

  const handleRatePercentChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setRatePercent(e.target.value),
    [],
  );
  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value),
    [],
  );
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editDialogTitle')}</DialogTitle>
          <DialogDescription>{t('editDialogDesc', { date: effectiveDate })}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={dialogFormLayoutClassName}>
          <DialogBody className="space-y-4">
            {entry.source === 'BOE_API' && (
              <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-sm text-warning">
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t('editApiSourceWarning')}</span>
              </div>
            )}
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
                onChange={handleRatePercentChange}
                className="tabular-nums"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">{t('colNotes')}</Label>
              <Textarea
                id="edit-notes"
                value={notes}
                onChange={handleNotesChange}
                placeholder={t('editNotesPlaceholder')}
                rows={3}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
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
