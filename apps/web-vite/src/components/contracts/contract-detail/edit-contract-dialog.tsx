import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { useCallback, useId } from 'react';

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

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value),
    [setTitle],
  );
  const handleStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value),
    [setStartDate],
  );
  const handleEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value),
    [setEndDate],
  );
  const handleCurrencyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setCurrency(e.target.value.toUpperCase().slice(0, 3)),
    [setCurrency],
  );
  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
    [setValue],
  );
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-title`}>{t('fields.title')}</Label>
            <Input
              id={`${id}-title`}
              value={title}
              onChange={handleTitleChange}
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
                onChange={handleStartDateChange}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-end`}>{t('fields.endDate')}</Label>
              <Input
                id={`${id}-end`}
                type="date"
                value={endDate}
                onChange={handleEndDateChange}
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
                onChange={handleCurrencyChange}
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
                onChange={handleValueChange}
                placeholder="0.00"
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{t('fields.valueHint')}</p>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
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
