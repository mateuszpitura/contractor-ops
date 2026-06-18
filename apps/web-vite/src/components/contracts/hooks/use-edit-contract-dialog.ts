import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

type EditableContract = {
  id: string;
  title: string | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
  currency: string;
  rateValueMinor: number | null;
};

function toDateInputValue(value: string | Date | null): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toIsoDateTime(yyyyMmDd: string): string | undefined {
  if (!yyyyMmDd) return;
  return new Date(`${yyyyMmDd}T00:00:00.000Z`).toISOString();
}

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

export function useEditContractDialog(
  contract: EditableContract,
  open: boolean,
  onOpenChange: (open: boolean) => void,
) {
  const t = useTranslations('ContractDetail.edit');
  const trpc = useTRPC();

  const [title, setTitle] = useState(contract.title ?? '');
  const [startDate, setStartDate] = useState(toDateInputValue(contract.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(contract.endDate));
  const [currency, setCurrency] = useState(contract.currency ?? 'EUR');
  const [value, setValue] = useState(minorToMajor(contract.rateValueMinor));

  useEffect(() => {
    if (!open) return;
    setTitle(contract.title ?? '');
    setStartDate(toDateInputValue(contract.startDate));
    setEndDate(toDateInputValue(contract.endDate));
    setCurrency(contract.currency ?? 'EUR');
    setValue(minorToMajor(contract.rateValueMinor));
  }, [open, contract]);

  const updateMutation = useResourceMutation(trpc.contract.update.mutationOptions({}), {
    successMessage: t('toast.success'),
    invalidate: [trpc.contract.pathFilter()],
    onClose: () => onOpenChange(false),
  });

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sequential field validate-then-build-then-mutate submit orchestration
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

  return {
    currency,
    endDate,
    handleSubmit,
    isPending: updateMutation.isPending,
    setCurrency,
    setEndDate,
    setStartDate,
    setTitle,
    setValue,
    startDate,
    title,
    value,
  } as const;
}
