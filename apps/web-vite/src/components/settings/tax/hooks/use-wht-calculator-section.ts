import type { WhtServiceType } from '@contractor-ops/validators';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useLocale } from '../../../../i18n/navigation.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

export const SERVICE_TYPES: readonly WhtServiceType[] = [
  'technical_services',
  'management_fees',
  'royalties',
  'rent_equipment',
] as const;

export const CONTRACTOR_COUNTRIES = ['PL', 'DE', 'GB', 'FR', 'AE', 'EG', 'IN', 'US'] as const;
export type ContractorCountry = (typeof CONTRACTOR_COUNTRIES)[number];

export function useWhtCalculatorSection() {
  const trpc = useTRPC();
  const t = useTranslations('TaxAdmin.calculator');
  const locale = useLocale();

  const [contractorResidency, setContractorResidency] = useState<ContractorCountry>('AE');
  const [serviceType, setServiceType] = useState<WhtServiceType>('technical_services');
  const [grossAmountInput, setGrossAmountInput] = useState('1000.00');

  const grossAmountMinor = useMemo(() => {
    const parsed = Number.parseFloat(grossAmountInput.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100);
  }, [grossAmountInput]);

  const isValidInput = grossAmountMinor !== null;

  const calculationQuery = useQuery({
    ...trpc.tax.calculateWht.queryOptions({
      contractorResidency,
      serviceType,
      grossAmountMinor: grossAmountMinor ?? 0,
    }),
    enabled: false,
    retry: false,
  });

  const handleCalculate = async () => {
    if (!isValidInput) return;
    try {
      await calculationQuery.refetch({ throwOnError: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.failed'));
    }
  };

  const result = calculationQuery.data;
  const hasResult = calculationQuery.isFetched && !calculationQuery.isFetching;

  return {
    t,
    locale,
    contractorResidency,
    setContractorResidency,
    serviceType,
    setServiceType,
    grossAmountInput,
    setGrossAmountInput,
    isValidInput,
    calculationQuery,
    handleCalculate,
    result,
    hasResult,
  } as const;
}
