/**
 * Add BoE rate dialog.
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
import { useCallback, useEffect, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useBoeRateInsert, useBoeRateValidation } from '../hooks/use-admin-boe-rate.js';

interface AddBoeRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validation: ReturnType<typeof useBoeRateValidation>;
  insertMutation: ReturnType<typeof useBoeRateInsert>;
}

export function AddBoeRateDialog({
  open,
  onOpenChange,
  validation,
  insertMutation,
}: AddBoeRateDialogProps) {
  const t = useTranslations('Admin.BoeRate');
  const tCommon = useTranslations('Common');
  const { validateRate, validateDate } = validation;

  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [ratePercent, setRatePercent] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) {
      setEffectiveFrom('');
      setRatePercent('');
      setNotes('');
    }
  }, [open]);

  const handleEffectiveFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEffectiveFrom(e.target.value),
    [],
  );

  const handleRatePercentChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setRatePercent(e.target.value),
    [],
  );

  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value),
    [],
  );

  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const rate = validateRate(ratePercent);
      if (rate === null) return;
      if (!validateDate(effectiveFrom)) return;

      insertMutation.mutate({
        effectiveFrom: new Date(effectiveFrom),
        ratePercent: rate,
        notes: notes || undefined,
      });
    },
    [effectiveFrom, insertMutation, notes, ratePercent, validateDate, validateRate],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addDialogTitle')}</DialogTitle>
          <DialogDescription>{t('addDialogDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className={dialogFormLayoutClassName}>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-effective-from">{t('colEffectiveFrom')}</Label>
              <Input
                id="add-effective-from"
                type="date"
                value={effectiveFrom}
                onChange={handleEffectiveFromChange}
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
                onChange={handleRatePercentChange}
                className="tabular-nums"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-notes">{t('notesOptionalLabel')}</Label>
              <Textarea
                id="add-notes"
                value={notes}
                onChange={handleNotesChange}
                placeholder={t('notesPlaceholder')}
                rows={3}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
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
