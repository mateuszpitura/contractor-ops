/**
 * `useZatcaStatusCard` — settings/integrations tab card. Covers loading,
 * disconnected ("none"), onboarding ("compliance"), connected ("production")
 * branches, wizard open/close, and the wizard-complete side effects
 * (invalidation + toast).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

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
import { useZatcaStatusCard } from '../use-zatca-status-card.js';

const trpcProxy = createTRPCProxy();

describe('useZatcaStatusCard', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    setTRPCMock({});
  });

  it('isLoading=true while the onboarding query is pending', () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useZatcaStatusCard());
    expect(result.current.isLoading).toBe(true);
  });

  it('maps a fresh org to the outlined "not connected" status config', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'tax_details',
        productionCertActive: false,
        complianceCsidReceived: false,
      }),
    });
    const { result } = renderHookWithProviders(() => useZatcaStatusCard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isOnboarding).toBe(false);
    expect(result.current.statusConfig.variant).toBe('outline');
  });

  it('maps an onboarding org (compliance CSID received) to the info "compliance" config', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'compliance_checks',
        productionCertActive: false,
        complianceCsidReceived: true,
      }),
    });
    const { result } = renderHookWithProviders(() => useZatcaStatusCard());
    await waitFor(() => expect(result.current.isOnboarding).toBe(true));
    expect(result.current.statusConfig.variant).toBe('info');
  });

  it('maps a fully connected org to the success "production" config', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'production_certificate',
        productionCertActive: true,
        complianceCsidReceived: true,
      }),
    });
    const { result } = renderHookWithProviders(() => useZatcaStatusCard());
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.statusConfig.variant).toBe('success');
  });

  it('toggles wizardOpen via openWizard / closeWizard', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'tax_details',
        productionCertActive: false,
        complianceCsidReceived: false,
      }),
    });
    const { result } = renderHookWithProviders(() => useZatcaStatusCard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.wizardOpen).toBe(false);

    act(() => result.current.openWizard());
    expect(result.current.wizardOpen).toBe(true);

    act(() => result.current.closeWizard());
    expect(result.current.wizardOpen).toBe(false);
  });

  it('invalidates onboarding + stats and toasts on handleWizardComplete', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'compliance_csid',
        productionCertActive: false,
        complianceCsidReceived: true,
      }),
      'zatca.getComplianceStats': () => ({
        total: 0,
        cleared: 0,
        reported: 0,
        rejected: 0,
        pending: 0,
        warning: 0,
      }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useZatcaStatusCard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => result.current.handleWizardComplete());

    expect(result.current.wizardOpen).toBe(false);
    expect(invalidateSpy).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });
});
