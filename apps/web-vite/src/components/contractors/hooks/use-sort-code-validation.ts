import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

type ValidationStatus = 'VALID' | 'WARN' | 'INVALID';

export interface SortCodeValidationOutcome {
  status: ValidationStatus;
  warnings: string[];
}

export function useSortCodeValidation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Payments.ukBank');

  const validate = useCallback(
    async (sortCode: string, accountNumber: string): Promise<SortCodeValidationOutcome> => {
      try {
        const data = await queryClient.fetchQuery(
          trpc.bacs.validateSortCode.queryOptions({ sortCode, accountNumber }),
        );
        return data as SortCodeValidationOutcome;
      } catch (err) {
        const message = err instanceof Error ? err.message : t('validationFailedFallback');
        return { status: 'INVALID', warnings: [message] };
      }
    },
    [queryClient, trpc.bacs.validateSortCode, t],
  );

  return { validate } as const;
}
