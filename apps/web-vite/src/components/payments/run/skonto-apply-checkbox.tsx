/**
 * Skonto apply checkbox.
 */

import { formatMinorAsCurrency } from '@contractor-ops/shared';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Label } from '@contractor-ops/ui/components/shadcn/label';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';
import type { useSkontoApply } from '../hooks/use-skonto-apply.js';

function formatEUR(minorAmount: number): string {
  return formatMinorAsCurrency(minorAmount, 'EUR', 'de-DE');
}

interface SkontoApplyCheckboxProps {
  paymentRunItemId: string;
  invoiceId: string;
  isWithinWindow: boolean;
  discountPercent: number;
  discountAmountMinor: number;
  originalAmountMinor: number;
  discountedAmountMinor: number;
  windowExpiryDate?: string;
  onSkontoToggle?: (itemId: string, applied: boolean) => void;
  skonto: ReturnType<typeof useSkontoApply>;
}

export function SkontoApplyCheckbox({
  paymentRunItemId,
  isWithinWindow,
  discountPercent,
  discountAmountMinor,
  discountedAmountMinor,
  windowExpiryDate,
  skonto,
}: SkontoApplyCheckboxProps) {
  const t = useTranslations('Payments.skonto.paymentRun');
  const { applied, handleToggle, isPending } = skonto;

  if (!isWithinWindow) {
    return (
      <div className="flex items-center gap-2 opacity-60">
        <Checkbox
          id={`skonto-${paymentRunItemId}`}
          checked={false}
          disabled
          aria-label={t('pastWindowLabel')}
        />
        <Label
          htmlFor={`skonto-${paymentRunItemId}`}
          className="text-sm text-muted-foreground cursor-not-allowed">
          {t('pastWindowDescription', { date: windowExpiryDate ?? '' })}
        </Label>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={`skonto-${paymentRunItemId}`}
        checked={applied}
        onCheckedChange={handleToggle}
        disabled={isPending}
        aria-label={t('applyLabel', {
          percent: discountPercent,
          amount: formatEUR(discountAmountMinor),
        })}
      />
      <Label
        htmlFor={`skonto-${paymentRunItemId}`}
        className={cn('text-sm cursor-pointer', applied && 'text-green-800 dark:text-green-400')}>
        {t('applyDescription', {
          percent: discountPercent,
          amount: formatEUR(discountAmountMinor),
        })}
      </Label>
      {applied && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {t('newAmount', { amount: formatEUR(discountedAmountMinor) })}
        </span>
      )}
    </div>
  );
}
