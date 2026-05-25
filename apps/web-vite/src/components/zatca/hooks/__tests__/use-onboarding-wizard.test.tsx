/**
 * `useOnboardingWizard` — drives the 5-step ZATCA onboarding stepper.
 * Covers loading, the fresh-org "step 0" baseline, server-step resumption,
 * goNext clamping + invalidation, goBack clamping, and goToStep guard
 * (only earlier steps are jumpable).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useOnboardingWizard } from '../use-onboarding-wizard.js';

const trpcProxy = createTRPCProxy();

describe('useOnboardingWizard', () => {
  beforeEach(() => {
    setTRPCMock({});
  });

  it('isLoading=true while the onboarding state query is pending', () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useOnboardingWizard());
    expect(result.current.isLoading).toBe(true);
  });

  it('returns activeStep=0 for a fresh org parked on tax_details', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'tax_details',
        productionCertActive: false,
      }),
    });
    const { result } = renderHookWithProviders(() => useOnboardingWizard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeStep).toBe(0);
    expect(result.current.onboardingSteps).toHaveLength(5);
  });

  it('resumes from the server-reported step', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'compliance_csid',
        productionCertActive: false,
      }),
    });
    const { result } = renderHookWithProviders(() => useOnboardingWizard());
    await waitFor(() => expect(result.current.activeStep).toBe(2));
  });

  it('goNext advances the step and invalidates the onboarding query (clamps at last step)', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'tax_details',
        productionCertActive: false,
      }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useOnboardingWizard());
    await waitFor(() => expect(result.current.activeStep).toBe(0));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => result.current.goNext());
    expect(result.current.activeStep).toBe(1);
    expect(invalidateSpy).toHaveBeenCalled();

    for (let i = 0; i < 10; i++) {
      act(() => result.current.goNext());
    }
    expect(result.current.activeStep).toBe(4);
  });

  it('goBack clamps at step 0', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'tax_details',
        productionCertActive: false,
      }),
    });
    const { result } = renderHookWithProviders(() => useOnboardingWizard());
    await waitFor(() => expect(result.current.activeStep).toBe(0));

    act(() => result.current.goBack());
    expect(result.current.activeStep).toBe(0);

    act(() => result.current.goNext());
    act(() => result.current.goBack());
    expect(result.current.activeStep).toBe(0);
  });

  it('goToStep only allows jumping back to earlier (completed) steps', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'compliance_csid',
        productionCertActive: false,
      }),
    });
    const { result } = renderHookWithProviders(() => useOnboardingWizard());
    await waitFor(() => expect(result.current.activeStep).toBe(2));

    act(() => result.current.goToStep(4));
    expect(result.current.activeStep).toBe(2);

    act(() => result.current.goToStep(1));
    expect(result.current.activeStep).toBe(1);
  });
});
