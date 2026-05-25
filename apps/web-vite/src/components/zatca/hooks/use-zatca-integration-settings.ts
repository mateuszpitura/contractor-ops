import type { ZatcaOnboardingState } from '@contractor-ops/einvoice/zatca/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

export type ZatcaEnvironment = 'sandbox' | 'production';

export function useZatcaIntegrationSettings() {
  const t = useTranslations('Zatca.page');
  const queryClient = useQueryClient();
  const zatcaTrpc = useZatcaTrpc();
  const [wizardOpen, setWizardOpen] = useState(false);
  const openWizard = useCallback(() => setWizardOpen(true), []);
  const closeWizard = useCallback(() => setWizardOpen(false), []);

  const stateQuery = useQuery(zatcaTrpc.getOnboardingState.queryOptions());
  const state = stateQuery.data as ZatcaOnboardingState | undefined;
  const isLoading = stateQuery.isLoading;
  const isConnected = state?.productionCertActive === true;
  const isOnboarding =
    !!state && !state.productionCertActive && state.currentStep !== 'tax_details';
  const showConnectPanel = !(isConnected || isOnboarding || wizardOpen);
  const showWizard = (isOnboarding || wizardOpen) && !isConnected;

  const [environment, setEnvironment] = useState<ZatcaEnvironment>(
    isConnected ? 'production' : 'sandbox',
  );
  // Display labels mirror the legacy container (apps/web parity); kept as literals
  // to avoid expanding the `Zatca.page` i18n bundle in this refactor.
  const environmentLabel: 'Production' | 'Sandbox' =
    environment === 'production' ? 'Production' : 'Sandbox';

  const handleWizardComplete = useCallback(() => {
    setWizardOpen(false);
    setEnvironment('production');
    void queryClient.invalidateQueries({
      queryKey: zatcaTrpc.getOnboardingState.queryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: zatcaTrpc.getComplianceStats.queryKey(),
    });
    toast.success(t('toast.onboardingComplete'));
  }, [queryClient, zatcaTrpc, t]);

  return {
    isLoading,
    wizardOpen,
    openWizard,
    closeWizard,
    state,
    isConnected,
    isOnboarding,
    showConnectPanel,
    showWizard,
    environment,
    environmentLabel,
    setEnvironment,
    handleWizardComplete,
    t,
  } as const;
}
