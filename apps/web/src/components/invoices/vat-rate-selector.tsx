'use client';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/trpc/init';

interface VatRateSelectorProps {
  value?: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

interface TaxRateOption {
  id: string;
  code: string;
  description: string;
  ratePercent: number;
  isDefault: boolean;
  isExempt: boolean;
  isReverseCharge: boolean;
}

export function VatRateSelector({ value, onChange, disabled }: VatRateSelectorProps) {
  const t = useTranslations('Invoices.vatRate');
  const ratesQuery = useQuery(trpc.tax.getRates.queryOptions());

  if (ratesQuery.isLoading) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t('loading')}</span>
      </div>
    );
  }

  if (!ratesQuery.data || ratesQuery.data.length === 0) {
    return (
      <div className="flex h-10 items-center rounded-md border border-input bg-muted px-4">
        <span className="text-sm text-muted-foreground">{t('noRates')}</span>
      </div>
    );
  }

  // Group rates by category
  const rates = ratesQuery.data as TaxRateOption[];
  const defaultRates = rates.filter(
    r => !(r.isExempt || r.isReverseCharge) && r.ratePercent > 0 && r.isDefault,
  );
  const reducedRates = rates.filter(
    r => !(r.isExempt || r.isReverseCharge) && r.ratePercent > 0 && !r.isDefault,
  );
  const exemptRates = rates.filter(r => r.isExempt || r.ratePercent === 0);

  return (
    <Select
      value={value}
      onValueChange={code => {
        if (code) onChange(code);
      }}
      disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={t('placeholder')} />
      </SelectTrigger>
      <SelectContent>
        {defaultRates.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-medium text-muted-foreground">
              {t('standardRates')}
            </SelectLabel>
            {defaultRates.map(rate => (
              <SelectItem key={rate.id} value={rate.code}>
                {rate.ratePercent}% &mdash; {rate.description}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {reducedRates.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-medium text-muted-foreground">
              {t('reducedRates')}
            </SelectLabel>
            {reducedRates.map(rate => (
              <SelectItem key={rate.id} value={rate.code}>
                {rate.ratePercent}% &mdash; {rate.description}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {exemptRates.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-medium text-muted-foreground">
              {t('exempt')}
            </SelectLabel>
            {exemptRates.map(rate => (
              <SelectItem key={rate.id} value={rate.code}>
                {rate.code === 'ZW'
                  ? 'ZW \u2014 Tax exempt'
                  : rate.code === 'NP'
                    ? 'NP \u2014 Not applicable'
                    : `${rate.ratePercent}% \u2014 ${rate.description}`}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
