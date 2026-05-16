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
import { enumKey } from '@/lib/enum-key';
import type { ContractWizardFormValues } from './wizard-dialog';
import { tDyn, tDynLoose } from '@/i18n/typed-keys';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepFinancialProps {
  form: UseFormReturn<ContractWizardFormValues>;
  preFilledFields?: Set<string>;
}

/**
 * Step 2: Financial terms.
 * Fields: rate (minor units display), currency, billing model, rate type,
 * payment terms, invoice cycle. Shows pre-fill hint when applicable.
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

  // Local state for rate input — prevents cursor jumping during typing.
  // Syncs to form (minor units) on blur only.
  const [rateLocal, setRateLocal] = React.useState(() =>
    typeof rateValueMinor === 'number' && rateValueMinor > 0
      ? (rateValueMinor / 100).toString()
      : '',
  );

  // Sync from form → local when form value changes externally (e.g. pre-fill)
  React.useEffect(() => {
    const fromForm =
      typeof rateValueMinor === 'number' && rateValueMinor > 0
        ? (rateValueMinor / 100).toString()
        : '';
    setRateLocal(prev => {
      // Only overwrite if the form value is substantially different
      // (avoids clobbering user mid-typing)
      const prevMinor = Math.round(parseFloat(prev || '0') * 100);
      if (prevMinor !== rateValueMinor) return fromForm;
      return prev;
    });
  }, [rateValueMinor]);

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

  const isPreFilled = (field: string) => preFilledFields?.has(field);

  return (
    <div className="space-y-4">
      {/* Rate */}
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
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setRateLocal(e.target.value)}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
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

      {/* Currency */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('fields.currency')}</Label>
        <Select
          value={currency}
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

      {/* Billing model */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('fields.billingModel')}</Label>
        <Select
          value={watch('billingModel') ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onValueChange={value =>
            setValue('billingModel', (value ?? '') as ContractWizardFormValues['billingModel'], {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
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

      {/* Rate type */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('fields.rateType')}</Label>
        <Select
          value={watch('rateType') ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onValueChange={value =>
            setValue('rateType', (value ?? '') as ContractWizardFormValues['rateType'], {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
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

      {/* Payment terms */}
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

      {/* Invoice cycle */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('fields.invoiceCycle')}</Label>
        <Select
          value={watch('invoiceCycle') ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onValueChange={value =>
            setValue('invoiceCycle', (value ?? '') as ContractWizardFormValues['invoiceCycle'], {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
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
