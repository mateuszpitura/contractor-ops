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
import { useId } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useEditContractDialog } from '../hooks/use-edit-contract-dialog.js';

type EditContractDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  edit: ReturnType<typeof useEditContractDialog>;
};

const CURRENCY_PATTERN = '^[A-Z]{3}$';

export function EditContractDialog({ open, onOpenChange, edit }: EditContractDialogProps) {
  const t = useTranslations('ContractDetail.edit');
  const id = useId();

  const {
    currency,
    endDate,
    handleSubmit,
    isPending,
    setCurrency,
    setEndDate,
    setStartDate,
    setTitle,
    setValue,
    startDate,
    title,
    value,
  } = edit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-title`}>{t('fields.title')}</Label>
            <Input
              id={`${id}-title`}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('fields.titlePlaceholder')}
              disabled={isPending}
              maxLength={255}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-start`}>{t('fields.startDate')}</Label>
              <Input
                id={`${id}-start`}
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-end`}>{t('fields.endDate')}</Label>
              <Input
                id={`${id}-end`}
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-currency`}>{t('fields.currency')}</Label>
              <Input
                id={`${id}-currency`}
                value={currency}
                onChange={e => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="EUR"
                pattern={CURRENCY_PATTERN}
                maxLength={3}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{t('fields.currencyHint')}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-value`}>{t('fields.value')}</Label>
              <Input
                id={`${id}-value`}
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="0.00"
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{t('fields.valueHint')}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t('actions.saving') : t('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
