import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import React, { useCallback, useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import type { ContractWizardFormValues } from './wizard-dialog.js';

const CURRENCIES = ['PLN', 'EUR', 'USD'] as const;

const BILLING_MODELS = [
  'MONTHLY_RETAINER',
  'HOURLY',
  'DAILY',
  'MILESTONE',
  'DELIVERABLE_BASED',
  'MIXED',
] as const;

const RATE_TYPES = [
  'MONTHLY_FIXED',
  'PER_HOUR',
  'PER_DAY',
  'PER_MILESTONE',
  'PER_DELIVERABLE',
] as const;

const INVOICE_CYCLES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ON_DELIVERABLE', 'AD_HOC'] as const;

interface StepFinancialProps {
  form: UseFormReturn<ContractWizardFormValues>;
  preFilledFields?: Set<string>;
}

/**
 * Step 2: Financial terms.
 */
export function StepFinancial({ form, preFilledFields }: StepFinancialProps) {
  const id = useId();
  const t = useTranslations('Contracts.wizard');

  const billingModelItems = BILLING_MODELS.map(m => ({
    value: m,
    label: tDynLoose(t, 'billingModelOptions', enumKey(m)),
  }));

  const rateTypeItems = RATE_TYPES.map(rt => ({
    value: rt,
    label: tDynLoose(t, 'rateTypeOptions', enumKey(rt)),
  }));

  const invoiceCycleItems = INVOICE_CYCLES.map(c => ({
    value: c,
    label: tDynLoose(t, 'invoiceCycleOptions', enumKey(c)),
  }));

  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const rateValueMinor = watch('rateValueMinor');
  const currency = watch('currency') ?? 'PLN';

  const [rateLocal, setRateLocal] = React.useState(() =>
    typeof rateValueMinor === 'number' && rateValueMinor > 0
      ? (rateValueMinor / 100).toString()
      : '',
  );

  React.useEffect(() => {
    const fromForm =
      typeof rateValueMinor === 'number' && rateValueMinor > 0
        ? (rateValueMinor / 100).toString()
        : '';
    setRateLocal(prev => {
      const prevMinor = Math.round(parseFloat(prev || '0') * 100);
      if (prevMinor !== rateValueMinor) return fromForm;
      return prev;
    });
  }, [rateValueMinor]);

  const handleRateBlur = useCallback(() => {
    const value = parseFloat(rateLocal);
    if (!Number.isNaN(value) && value >= 0) {
      setValue('rateValueMinor', Math.round(value * 100), {
        shouldDirty: true,
        shouldValidate: true,
      });
      setRateLocal(value.toFixed(2));
    } else {
      setValue('rateValueMinor', 0, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setRateLocal('');
    }
  }, [rateLocal, setValue]);

  const handleRateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setRateLocal(e.target.value),
    [],
  );

  const handleCurrencyChange = useCallback(
    (value: string | null) =>
      setValue('currency', value ?? 'PLN', {
        shouldDirty: true,
        shouldValidate: true,
      }),
    [setValue],
  );

  const handleBillingModelChange = useCallback(
    (value: string | null) =>
      setValue('billingModel', (value ?? '') as ContractWizardFormValues['billingModel'], {
        shouldDirty: true,
        shouldValidate: true,
      }),
    [setValue],
  );

  const handleRateTypeChange = useCallback(
    (value: string | null) =>
      setValue('rateType', (value ?? '') as ContractWizardFormValues['rateType'], {
        shouldDirty: true,
        shouldValidate: true,
      }),
    [setValue],
  );

  const handleInvoiceCycleChange = useCallback(
    (value: string | null) =>
      setValue('invoiceCycle', (value ?? '') as ContractWizardFormValues['invoiceCycle'], {
        shouldDirty: true,
        shouldValidate: true,
      }),
    [setValue],
  );

  const isPreFilled = (field: string) => preFilledFields?.has(field);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${id}-rate`} className="text-[13px]">
          {t('fields.rate')}
        </Label>
        <div className="relative">
          <Input
            id={`${id}-rate`}
            type="number"
            step="0.01"
            min="0"
            className="font-mono pe-16"
            value={rateLocal}
            onChange={handleRateChange}
            onBlur={handleRateBlur}
          />
          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {currency}
          </span>
        </div>
        {isPreFilled('rateValueMinor') && (
          <p className="text-xs text-muted-foreground">{t('preFilled')}</p>
        )}
        {!!errors.rateValueMinor && (
          <p className="text-sm text-destructive">{errors.rateValueMinor.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-[13px]">{t('fields.currency')}</Label>
        <Select value={currency} onValueChange={handleCurrencyChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map(c => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isPreFilled('currency') && (
          <p className="text-xs text-muted-foreground">{t('preFilled')}</p>
        )}
        {!!errors.currency && <p className="text-sm text-destructive">{errors.currency.message}</p>}
      </div>

      <div className="space-y-2">
        <Label className="text-[13px]">{t('fields.billingModel')}</Label>
        <Select
          value={watch('billingModel') ?? ''}
          onValueChange={handleBillingModelChange}
          items={billingModelItems}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('fields.billingModelPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {billingModelItems.map(model => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isPreFilled('billingModel') && (
          <p className="text-xs text-muted-foreground">{t('preFilled')}</p>
        )}
        {!!errors.billingModel && (
          <p className="text-sm text-destructive">{errors.billingModel.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-[13px]">{t('fields.rateType')}</Label>
        <Select
          value={watch('rateType') ?? ''}
          onValueChange={handleRateTypeChange}
          items={rateTypeItems}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('fields.rateTypePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {rateTypeItems.map(rt => (
              <SelectItem key={rt.value} value={rt.value}>
                {rt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!!errors.rateType && <p className="text-sm text-destructive">{errors.rateType.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-paymentTermsDays`} className="text-[13px]">
          {t('fields.paymentTerms')}
        </Label>
        <Input
          id={`${id}-paymentTermsDays`}
          type="number"
          min="1"
          placeholder="30"
          {...register('paymentTermsDays', { valueAsNumber: true })}
        />
        {!!errors.paymentTermsDays && (
          <p className="text-sm text-destructive">{errors.paymentTermsDays.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-[13px]">{t('fields.invoiceCycle')}</Label>
        <Select
          value={watch('invoiceCycle') ?? ''}
          onValueChange={handleInvoiceCycleChange}
          items={invoiceCycleItems}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('fields.invoiceCyclePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {invoiceCycleItems.map(cycle => (
              <SelectItem key={cycle.value} value={cycle.value}>
                {cycle.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!!errors.invoiceCycle && (
          <p className="text-sm text-destructive">{errors.invoiceCycle.message}</p>
        )}
      </div>
    </div>
  );
}
