'use client';

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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Editable contract surface. We intentionally limit the dialog to a small,
 * well-bounded set of fields (identity + date window + commercial terms).
 * The full PATCH surface (`contractUpdateSchema`) is much larger and includes
 * fields whose editing flows are owned by dedicated UI (status transitions,
 * amendments, expiry reminders, etc.) — keeping the dialog focused avoids
 * letting two surfaces edit the same field with different semantics.
 */
type EditableContract = {
  id: string;
  title: string | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
  currency: string;
  rateValueMinor: number | null;
};

type EditContractDialogProps = {
  contract: EditableContract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** YYYY-MM-DD slice of an ISO datetime / Date, suitable for `<input type="date">`. */
function toDateInputValue(value: string | Date | null): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/** YYYY-MM-DD from a date input back to a full ISO datetime at UTC midnight. */
function toIsoDateTime(yyyyMmDd: string): string | undefined {
  if (!yyyyMmDd) return;
  // Anchor at UTC midnight so the wire value is timezone-independent.
  return new Date(`${yyyyMmDd}T00:00:00.000Z`).toISOString();
}

/** Minor-units (integer) <-> major-units (decimal string) round-trip helpers. */
function minorToMajor(minor: number | null): string {
  if (minor == null) return '';
  return (minor / 100).toFixed(2);
}

function majorToMinor(major: string): number | null {
  if (!major.trim()) return null;
  const parsed = Number.parseFloat(major.replace(',', '.'));
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

/**
 * Reasonable currency set — covers the EU + UK + US trio that the app
 * currently supports. The router accepts any ISO-4217 3-letter code, so an
 * `<Input>` is more forgiving than a `<Select>` for forward compatibility.
 */
const CURRENCY_PATTERN = '^[A-Z]{3}$';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditContractDialog({ contract, open, onOpenChange }: EditContractDialogProps) {
  const t = useTranslations('ContractDetail.edit');
  const queryClient = useQueryClient();
  const id = useId();

  const [title, setTitle] = useState(contract.title ?? '');
  const [startDate, setStartDate] = useState(toDateInputValue(contract.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(contract.endDate));
  const [currency, setCurrency] = useState(contract.currency ?? 'EUR');
  const [value, setValue] = useState(minorToMajor(contract.rateValueMinor));

  // Re-hydrate form state whenever the dialog is (re)opened against a new
  // contract instance — the parent keeps the dialog mounted for transitions,
  // so we cannot rely on unmount to reset local state.
  useEffect(() => {
    if (!open) return;
    setTitle(contract.title ?? '');
    setStartDate(toDateInputValue(contract.startDate));
    setEndDate(toDateInputValue(contract.endDate));
    setCurrency(contract.currency ?? 'EUR');
    setValue(minorToMajor(contract.rateValueMinor));
  }, [open, contract]);

  const updateMutation = useMutation(
    trpc.contract.update.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.success'));
        queryClient.invalidateQueries(trpc.contract.pathFilter());
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const handleSubmit = useCallback(() => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error(t('validation.titleRequired'));
      return;
    }
    if (!startDate) {
      toast.error(t('validation.startRequired'));
      return;
    }
    if (endDate && endDate <= startDate) {
      toast.error(t('validation.endAfterStart'));
      return;
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      toast.error(t('validation.currencyFormat'));
      return;
    }

    const rateValueMinor = majorToMinor(value);
    if (value.trim() && rateValueMinor === null) {
      toast.error(t('validation.valueFormat'));
      return;
    }

    // Send only the fields that actually changed. The PATCH schema treats
    // every field as optional and the router only writes provided keys, so
    // this keeps the audit diff tight.
    const data: Record<string, unknown> = {};
    if (trimmedTitle !== (contract.title ?? '')) {
      data.title = trimmedTitle;
    }
    const startIso = toIsoDateTime(startDate);
    if (startIso && startIso !== toIsoDateTime(toDateInputValue(contract.startDate))) {
      data.startDate = startIso;
    }
    const endIso = endDate ? toIsoDateTime(endDate) : null;
    const currentEndIso = contract.endDate
      ? toIsoDateTime(toDateInputValue(contract.endDate))
      : null;
    if (endIso !== currentEndIso) {
      data.endDate = endIso;
    }
    if (currency !== contract.currency) {
      data.currency = currency;
    }
    if (rateValueMinor !== contract.rateValueMinor) {
      data.rateValueMinor = rateValueMinor;
    }

    if (Object.keys(data).length === 0) {
      toast.info(t('toast.noChanges'));
      onOpenChange(false);
      return;
    }

    updateMutation.mutate({
      id: contract.id,
      data: data as Parameters<typeof updateMutation.mutate>[0]['data'],
    });
  }, [title, startDate, endDate, currency, value, contract, updateMutation, t, onOpenChange]);

  const isPending = updateMutation.isPending;

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
