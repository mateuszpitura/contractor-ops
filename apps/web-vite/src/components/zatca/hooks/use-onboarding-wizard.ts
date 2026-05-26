import type { ZatcaOnboardingState } from '@contractor-ops/einvoice/zatca/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { StepDefinition } from '../stepper.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

const STEP_IDS = [
  'tax_details',
  'csr_generation',
  'compliance_csid',
  'compliance_checks',
  'production_certificate',
] as const;

const STEP_TRANSLATION_KEYS: Record<string, { label: string; shortLabel: string }> = {
  tax_details: { label: 'steps.taxDetails', shortLabel: 'steps.taxDetailsShort' },
  csr_generation: { label: 'steps.csrGeneration', shortLabel: 'steps.csrGenerationShort' },
  compliance_csid: { label: 'steps.complianceCsid', shortLabel: 'steps.complianceCsidShort' },
  compliance_checks: { label: 'steps.complianceChecks', shortLabel: 'steps.complianceChecksShort' },
  production_certificate: {
    label: 'steps.productionCertificate',
    shortLabel: 'steps.productionCertificateShort',
  },
};

const STEP_INDEX_MAP: Record<string, number> = {
  tax_details: 0,
  csr_generation: 1,
  compliance_csid: 2,
  compliance_checks: 3,
  production_certificate: 4,
};

export function useOnboardingWizard() {
  const zatcaTrpc = useZatcaTrpc();
  const t = useTranslations('Zatca.onboarding');
  const queryClient = useQueryClient();

  const onboardingSteps: StepDefinition[] = STEP_IDS.map(id => {
    const keys = STEP_TRANSLATION_KEYS[id];
    return {
      id,
      label: tKey(t, keys?.label ?? id),
      shortLabel: tKey(t, keys?.shortLabel ?? id),
    };
  });

  const stateQuery = useQuery(zatcaTrpc.getOnboardingState.queryOptions());
  const state = stateQuery.data as ZatcaOnboardingState | undefined;

  const serverStep = state?.currentStep ? (STEP_INDEX_MAP[state.currentStep] ?? 0) : 0;
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const activeStep = currentStep ?? serverStep;

  const goNext = useCallback(() => {
    setCurrentStep(prev => {
      const current = prev ?? serverStep;
      return Math.min(current + 1, onboardingSteps.length - 1);
    });
    queryClient.invalidateQueries({
      queryKey: zatcaTrpc.getOnboardingState.queryKey(),
    });
  }, [serverStep, queryClient, onboardingSteps.length, zatcaTrpc]);

  const goBack = useCallback(() => {
    setCurrentStep(prev => {
      const current = prev ?? serverStep;
      return Math.max(current - 1, 0);
    });
  }, [serverStep]);

  const goToStep = useCallback(
    (index: number) => {
      if (index < activeStep) {
        setCurrentStep(index);
      }
    },
    [activeStep],
  );

  return {
    isLoading: stateQuery.isLoading,
    onboardingSteps,
    activeStep,
    goNext,
    goBack,
    goToStep,
    t,
  } as const;
}
