import type { ZatcaOnboardingState } from '@contractor-ops/einvoice/zatca/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

const STATUS_VARIANT: Record<
  string,
  { variant: 'success' | 'warning' | 'info' | 'destructive' | 'outline'; labelKey: string }
> = {
  production: { variant: 'success', labelKey: 'statusLabels.production' },
  sandbox: { variant: 'warning', labelKey: 'statusLabels.sandbox' },
  compliance: { variant: 'info', labelKey: 'statusLabels.onboarding' },
  none: { variant: 'outline', labelKey: 'statusLabels.notConnected' },
};

export function useZatcaStatusCard() {
  const zatcaTrpc = useZatcaTrpc();
  const t = useTranslations('Zatca.statusCard');
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const openWizard = useCallback(() => setWizardOpen(true), []);
  const closeWizard = useCallback(() => setWizardOpen(false), []);

  const stateQuery = useQuery(zatcaTrpc.getOnboardingState.queryOptions());
  const state = stateQuery.data as ZatcaOnboardingState | undefined;
  const isConnected = state?.productionCertActive === true;
  const isOnboarding = state && !state.productionCertActive && state.currentStep !== 'tax_details';
  const certStatus = state?.productionCertActive
    ? 'production'
    : state?.complianceCsidReceived
      ? 'compliance'
      : 'none';
  const statusConfig = STATUS_VARIANT[certStatus] ?? STATUS_VARIANT.none;

  const handleWizardComplete = useCallback(() => {
    setWizardOpen(false);
    queryClient.invalidateQueries({
      queryKey: zatcaTrpc.getOnboardingState.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: zatcaTrpc.getComplianceStats.queryKey(),
    });
    toast.success(t('toast.onboardingComplete'));
  }, [queryClient, zatcaTrpc, t]);

  return {
    isLoading: stateQuery.isLoading,
    wizardOpen,
    openWizard,
    closeWizard,
    isConnected,
    isOnboarding,
    statusConfig,
    handleWizardComplete,
    t,
  } as const;
}
