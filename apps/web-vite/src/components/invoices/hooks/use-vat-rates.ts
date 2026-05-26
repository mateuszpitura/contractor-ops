import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export interface TaxRateOption {
  id: string;
  code: string;
  description: string;
  ratePercent: number;
  isDefault: boolean;
  isExempt: boolean;
  isReverseCharge: boolean;
}

export function useVatRates() {
  const trpc = useTRPC();
  const ratesQuery = useQuery(trpc.tax.getRates.queryOptions());

  return {
    isLoading: ratesQuery.isLoading,
    rates: (ratesQuery.data ?? []) as TaxRateOption[],
  } as const;
}
