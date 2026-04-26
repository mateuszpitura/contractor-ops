'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Currency formatter for EUR
// ---------------------------------------------------------------------------

function formatEUR(minorAmount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorAmount / 100);
}

// ---------------------------------------------------------------------------
// PaymentRun Skonto apply checkbox for DE invoice lines
// ---------------------------------------------------------------------------

interface SkontoApplyCheckboxProps {
  paymentRunItemId: string;
  invoiceId: string;
  /** Whether the invoice is within the Skonto discount window. */
  isWithinWindow: boolean;
  /** Skonto discount percentage. */
  discountPercent: number;
  /** Discount amount in minor units (cents). */
  discountAmountMinor: number;
  /** Original amount in minor units. */
  originalAmountMinor: number;
  /** Discounted amount in minor units. */
  discountedAmountMinor: number;
  /** Window expiry date string for display. */
  windowExpiryDate?: string;
  /** Callback when Skonto is toggled — parent updates the run total. */
  onSkontoToggle?: (itemId: string, applied: boolean) => void;
}

export function SkontoApplyCheckbox({
  paymentRunItemId,
  invoiceId,
  isWithinWindow,
  discountPercent,
  discountAmountMinor,
  originalAmountMinor,
  discountedAmountMinor,
  windowExpiryDate,
  onSkontoToggle,
}: SkontoApplyCheckboxProps) {
  const t = useTranslations('Payments.skonto.paymentRun');
  const utils = trpc.useUtils();

  const [applied, setApplied] = useState(false);

  const applyMutation = trpc.payment.applySkontoToItem.useMutation({
    onSuccess: () => {
      void utils.payment.invalidate();
    },
    onError: error => {
      toast.error(error.message);
      // Revert optimistic update
      setApplied(prev => !prev);
      onSkontoToggle?.(paymentRunItemId, !applied);
    },
  });

  const handleToggle = useCallback(
    (checked: boolean) => {
      setApplied(!!checked);
      onSkontoToggle?.(paymentRunItemId, !!checked);
      applyMutation.mutate({
        paymentRunItemId,
        invoiceId,
        applySkontoDiscount: !!checked,
      });
    },
    [paymentRunItemId, invoiceId, applyMutation, onSkontoToggle],
  );

  // Past-window: disabled checkbox with explanation
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
          {t('pastWindowDescription', { date: windowExpiryDate })}
        </Label>
      </div>
    );
  }

  // Within window: active checkbox
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={`skonto-${paymentRunItemId}`}
        checked={applied}
        onCheckedChange={handleToggle}
        disabled={applyMutation.isPending}
        aria-label={t('applyLabel', {
          percent: discountPercent,
          amount: formatEUR(discountAmountMinor),
        })}
      />
      <Label
        htmlFor={`skonto-${paymentRunItemId}`}
        className={cn('text-sm cursor-pointer', applied && 'text-green-700 dark:text-green-400')}>
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
