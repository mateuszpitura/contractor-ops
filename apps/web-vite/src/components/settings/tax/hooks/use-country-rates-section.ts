import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

export const SUPPORTED_COUNTRIES = ['PL', 'DE', 'GB', 'SA', 'AE', 'EG'] as const;
export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];
export const DEFAULT_COUNTRY: SupportedCountry = 'PL';

type ValidationState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'valid' }
  | { status: 'invalid' }
  | { status: 'error'; message: string };

export function useCountryRatesSection() {
  const trpc = useTRPC();
  const t = useTranslations('TaxAdmin.rates');
  const queryClient = useQueryClient();

  const [country, setCountry] = useState<SupportedCountry>(DEFAULT_COUNTRY);
  const [validateCode, setValidateCode] = useState('');
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle' });

  const ratesQuery = useQuery(trpc.tax.getRatesByCountry.queryOptions({ countryCode: country }));

  const handleValidate = async () => {
    const code = validateCode.trim().toUpperCase();
    if (!code) {
      setValidation({ status: 'idle' });
      return;
    }
    setValidation({ status: 'pending' });
    try {
      const result = await queryClient.fetchQuery(trpc.tax.validateRate.queryOptions({ code }));
      setValidation({ status: result.valid ? 'valid' : 'invalid' });
    } catch (err) {
      setValidation({
        status: 'error',
        message: err instanceof Error ? err.message : t('validation.unknownError'),
      });
    }
  };

  return {
    t,
    country,
    setCountry,
    validateCode,
    setValidateCode,
    validation,
    handleValidate,
    ratesQuery,
    rates: ratesQuery.data ?? [],
    isLoading: ratesQuery.isLoading,
  } as const;
}
