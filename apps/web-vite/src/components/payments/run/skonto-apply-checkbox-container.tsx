import { useSkontoApply } from '../hooks/use-skonto-apply.js';
import { useSkontoApplyEligibility } from '../hooks/use-skonto-apply-eligibility.js';
import { SkontoApplyCheckbox } from './skonto-apply-checkbox.js';

interface SkontoApplyCheckboxContainerProps {
  paymentRunItemId: string;
  invoiceId: string;
  enabled: boolean;
  onSkontoToggle?: (itemId: string, applied: boolean) => void;
}

export function SkontoApplyCheckboxContainer({
  paymentRunItemId,
  invoiceId,
  enabled,
  onSkontoToggle,
}: SkontoApplyCheckboxContainerProps) {
  const eligibility = useSkontoApplyEligibility(invoiceId, enabled);
  const skonto = useSkontoApply({ paymentRunItemId, onSkontoToggle });

  if (!enabled || eligibility.isLoading || !eligibility.showCheckbox) {
    return null;
  }

  return (
    <SkontoApplyCheckbox
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
