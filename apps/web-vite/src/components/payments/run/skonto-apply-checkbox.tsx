/**
 * Skonto apply checkbox.
 */

import { formatMinorAsCurrency } from '@contractor-ops/shared';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Label } from '@contractor-ops/ui/components/shadcn/label';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';
import type { useSkontoApply as UseSkontoApply } from '../hooks/use-skonto-apply.js';
import { useSkontoApply } from '../hooks/use-skonto-apply.js';
import { useSkontoApplyEligibility } from '../hooks/use-skonto-apply-eligibility.js';

function formatEUR(minorAmount: number): string {
  return formatMinorAsCurrency(minorAmount, 'EUR', 'de-DE');
}

interface SkontoApplyCheckboxViewProps {
  paymentRunItemId: string;
  invoiceId: string;
  isWithinWindow: boolean;
  discountPercent: number;
  discountAmountMinor: number;
  originalAmountMinor: number;
  discountedAmountMinor: number;
  windowExpiryDate?: string;
  onSkontoToggle?: (itemId: string, applied: boolean) => void;
  skonto: ReturnType<typeof UseSkontoApply>;
}

export function SkontoApplyCheckboxView({
  paymentRunItemId,
  isWithinWindow,
  discountPercent,
  discountAmountMinor,
  discountedAmountMinor,
  windowExpiryDate,
  skonto,
}: SkontoApplyCheckboxViewProps) {
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

interface SkontoApplyCheckboxProps {
  paymentRunItemId: string;
  invoiceId: string;
  enabled: boolean;
  onSkontoToggle?: (itemId: string, applied: boolean) => void;
}

export function SkontoApplyCheckbox({
  paymentRunItemId,
  invoiceId,
  enabled,
  onSkontoToggle,
}: SkontoApplyCheckboxProps) {
  const eligibility = useSkontoApplyEligibility(invoiceId, enabled);
  const skonto = useSkontoApply({ paymentRunItemId, onSkontoToggle });

  if (!enabled || eligibility.isLoading || !eligibility.showCheckbox) {
    return null;
  }

  return (
    <SkontoApplyCheckboxView
      paymentRunItemId={paymentRunItemId}
      invoiceId={invoiceId}
      isWithinWindow={eligibility.isWithinWindow}
      discountPercent={eligibility.discountPercent}
      discountAmountMinor={eligibility.discountAmountMinor}
      originalAmountMinor={eligibility.originalAmountMinor}
      discountedAmountMinor={eligibility.discountedAmountMinor}
      windowExpiryDate={eligibility.windowExpiryDate}
      onSkontoToggle={onSkontoToggle}
      skonto={skonto}
    />
  );
}
