/**
 * VAT rate selector.
 */

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Loader2 } from 'lucide-react';
import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import type { TaxRateOption } from './hooks/use-vat-rates.js';
import { useVatRates } from './hooks/use-vat-rates.js';

interface VatRateSelectorViewProps {
  value?: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  rates: TaxRateOption[];
}

export function VatRateSelectorSkeleton() {
  const t = useTranslations('Invoices.vatRate');
  return (
    <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-4">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{t('loading')}</span>
    </div>
  );
}

export function VatRateSelectorEmpty() {
  const t = useTranslations('Invoices.vatRate');
  return (
    <div className="flex h-10 items-center rounded-md border border-input bg-muted px-4">
      <span className="text-sm text-muted-foreground">{t('noRates')}</span>
    </div>
  );
}

export function VatRateSelectorView({
  value,
  onChange,
  disabled,
  rates,
}: VatRateSelectorViewProps) {
  const t = useTranslations('Invoices.vatRate');

  const defaultRates = rates.filter(
    r => !(r.isExempt || r.isReverseCharge) && r.ratePercent > 0 && r.isDefault,
  );
  const reducedRates = rates.filter(
    r => !(r.isExempt || r.isReverseCharge) && r.ratePercent > 0 && !r.isDefault,
  );
  const exemptRates = rates.filter(r => r.isExempt || r.ratePercent === 0);

  const handleValueChange = useCallback(
    (code: string | null) => {
      if (code) onChange(code);
    },
    [onChange],
  );

  return (
    <Select value={value} onValueChange={handleValueChange} disabled={disabled}>
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
                  ? 'ZW — Tax exempt'
                  : rate.code === 'NP'
                    ? 'NP — Not applicable'
                    : `${rate.ratePercent}% — ${rate.description}`}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

interface VatRateSelectorProps {
  value?: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

export function VatRateSelector(props: VatRateSelectorProps) {
  const { isLoading, rates } = useVatRates();

  if (isLoading) return <VatRateSelectorSkeleton />;
  if (rates.length === 0) return <VatRateSelectorEmpty />;

  return <VatRateSelectorView {...props} rates={rates} />;
}
