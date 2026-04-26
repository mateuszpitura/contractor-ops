'use client';

import { useTranslations } from 'next-intl';
import React, { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { WizardFormValues } from './wizard-dialog';

interface StepBillingProps {
  form: UseFormReturn<WizardFormValues>;
}

const BILLING_MODEL_VALUES = ['FIXED', 'HOURLY', 'PROJECT', 'MILESTONE'] as const;

const CURRENCIES = ['PLN', 'EUR', 'USD'] as const;

/**
 * Step 2: Billing configuration.
 * Fields: billing model, currency, rate, bank account IBAN, payment terms.
 */
export function StepBilling({ form }: StepBillingProps) {
  const id = useId();
  const t = useTranslations('ContractorWizard.fields');
  const tb = useTranslations('ContractorWizard.billingModelOptions');

  const billingModelItems = BILLING_MODEL_VALUES.map(v => ({
    value: v,
    label: tb(v),
  }));

  const _currencyItems = CURRENCIES.map(c => ({
    value: c,
    label: c,
  }));

  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  // Local state for rate input — prevents cursor jumping during typing.
  const rateMinor = watch('rateValueMinor');
  const [rateLocal, setRateLocal] = React.useState(() =>
    typeof rateMinor === 'number' && rateMinor > 0 ? (rateMinor / 100).toString() : '',
  );

  React.useEffect(() => {
    const fromForm =
      typeof rateMinor === 'number' && rateMinor > 0 ? (rateMinor / 100).toString() : '';
    setRateLocal(prev => {
      const prevMinor = Math.round(parseFloat(prev || '0') * 100);
      if (prevMinor !== rateMinor) return fromForm;
      return prev;
    });
  }, [rateMinor]);

  const handleRateBlur = () => {
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
  };

  return (
    <div className="space-y-4">
      {/* Billing model */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('billingModel')}</Label>
        <Select
          value={watch('billingModel') ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onValueChange={value =>
            setValue('billingModel', value ?? '', {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          items={billingModelItems}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('billingModel')} />
          </SelectTrigger>
          <SelectContent>
            {billingModelItems.map(model => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!!errors.billingModel && (
          <p className="text-sm text-destructive">{errors.billingModel.message}</p>
        )}
      </div>

      {/* Currency */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('currency')}</Label>
        <Select
          value={watch('currency') ?? 'PLN'}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onValueChange={value =>
            setValue('currency', value ?? 'PLN', {
              shouldDirty: true,
              shouldValidate: true,
            })
          }>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map(currency => (
              <SelectItem key={currency} value={currency}>
                {currency}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!!errors.currency && <p className="text-sm text-destructive">{errors.currency.message}</p>}
      </div>

      {/* Default rate (display as zloty, store as minor units) */}
      <div className="space-y-2">
        <Label htmlFor={`${id}-rate`} className="text-[13px]">
          {t('rate')}
        </Label>
        <div className="relative">
          <Input
            id={`${id}-rate`}
            type="number"
            step="0.01"
            min="0"
            className="font-mono pe-16"
            value={rateLocal}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setRateLocal(e.target.value)}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onBlur={handleRateBlur}
          />
          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {watch('currency') ?? 'PLN'}
          </span>
        </div>
        {!!errors.rateValueMinor && (
          <p className="text-sm text-destructive">{errors.rateValueMinor.message}</p>
        )}
      </div>

      {/* Bank account IBAN */}
      <div className="space-y-2">
        <Label htmlFor={`${id}-bankAccount`} className="text-[13px]">
          {t('bankAccount')}
        </Label>
        <Input
          id={`${id}-bankAccount`}
          className="font-mono"
          placeholder="PL00 0000 0000 0000 0000 0000 0000"
          {...register('bankAccount')}
        />
        {!!errors.bankAccount && (
          <p className="text-sm text-destructive">{errors.bankAccount.message}</p>
        )}
      </div>

      {/* Payment terms */}
      <div className="space-y-2">
        <Label htmlFor={`${id}-paymentTermsDays`} className="text-[13px]">
          {t('paymentTerms')}
        </Label>
        <Input
          id={`${id}-paymentTermsDays`}
          type="number"
          min="1"
          placeholder="30"
          {...register('paymentTermsDays', {
            setValueAs: (v: string) => {
              const n = parseInt(v, 10);
              return Number.isNaN(n) ? undefined : n;
            },
          })}
        />
      </div>
    </div>
  );
}
