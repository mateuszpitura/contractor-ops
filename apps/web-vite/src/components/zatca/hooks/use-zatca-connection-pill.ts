import type { ZatcaOnboardingState } from '@contractor-ops/einvoice/zatca/types';
import { useQuery } from '@tanstack/react-query';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

export type ZatcaDerivedStatus = 'CONNECTED' | 'IN_PROGRESS' | 'DISCONNECTED' | 'ERROR';

export function useZatcaConnectionPill() {
  const zatcaTrpc = useZatcaTrpc();
  const t = useTranslations('Zatca.connectionPill');

  const stateQuery = useQuery(
    zatcaTrpc.getOnboardingState.queryOptions(undefined, { refetchInterval: 30_000 }),
  );

  const state = stateQuery.data as ZatcaOnboardingState | undefined;

  let status: ZatcaDerivedStatus;
  if (stateQuery.isError) {
    status = 'ERROR';
  } else if (state?.productionCertActive === true) {
    status = 'CONNECTED';
  } else if (state && state.currentStep !== 'tax_details') {
    status = 'IN_PROGRESS';
  } else {
    status = 'DISCONNECTED';
  }

  return {
    isLoading: stateQuery.isLoading,
    status,
    t,
  } as const;
}
