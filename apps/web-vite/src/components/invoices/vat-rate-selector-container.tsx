import { useVatRates } from './hooks/use-vat-rates.js';
import {
  VatRateSelector,
  VatRateSelectorEmpty,
  VatRateSelectorSkeleton,
} from './vat-rate-selector.js';

interface VatRateSelectorContainerProps {
  value?: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

export function VatRateSelectorContainer(props: VatRateSelectorContainerProps) {
  const { isLoading, rates } = useVatRates();

  if (isLoading) return <VatRateSelectorSkeleton />;
  if (rates.length === 0) return <VatRateSelectorEmpty />;

  return <VatRateSelector {...props} rates={rates} />;
}
