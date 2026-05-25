/**
 * `useZatcaIntegrationSettings` — orchestrates the wizard open/close,
 * environment toggle, and post-completion invalidation/toast for the
 * `/settings/integrations/zatca` page. Covers loading, the three visual
 * states (connect / wizard / connected), environment label derivation, and
 * the wizard-complete side effects (toast + invalidation + env flip).
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
import { useZatcaIntegrationSettings } from '../use-zatca-integration-settings.js';

const trpcProxy = createTRPCProxy();

describe('useZatcaIntegrationSettings', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    setTRPCMock({});
  });

  it('isLoading=true while the onboarding state query is pending', () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useZatcaIntegrationSettings());
    expect(result.current.isLoading).toBe(true);
  });

  it('renders the connect panel when org has no ZATCA setup yet', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'tax_details',
        productionCertActive: false,
      }),
    });
    const { result } = renderHookWithProviders(() => useZatcaIntegrationSettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.showConnectPanel).toBe(true);
    expect(result.current.showWizard).toBe(false);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.environment).toBe('sandbox');
  });

  it('shows the wizard when openWizard() flips local state, then closes again', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'tax_details',
        productionCertActive: false,
      }),
    });
    const { result } = renderHookWithProviders(() => useZatcaIntegrationSettings());
    await waitFor(() => expect(result.current.showConnectPanel).toBe(true));

    act(() => result.current.openWizard());
    expect(result.current.showWizard).toBe(true);
    expect(result.current.showConnectPanel).toBe(false);

    act(() => result.current.closeWizard());
    expect(result.current.showWizard).toBe(false);
    expect(result.current.showConnectPanel).toBe(true);
  });

  it('treats mid-onboarding orgs as showWizard without an explicit openWizard()', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'compliance_csid',
        productionCertActive: false,
      }),
    });
    const { result } = renderHookWithProviders(() => useZatcaIntegrationSettings());
    await waitFor(() => expect(result.current.showWizard).toBe(true));
    expect(result.current.isOnboarding).toBe(true);
    expect(result.current.isConnected).toBe(false);
  });

  it('exposes environment + label and reacts to setEnvironment', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'production_certificate',
        productionCertActive: true,
      }),
    });
    const { result } = renderHookWithProviders(() => useZatcaIntegrationSettings());
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    // `environment` is seeded once on the first render (before the query has
    // resolved) so a connected org still starts in sandbox until the user
    // promotes it — mirror that contract here.
    expect(result.current.environmentLabel).toBe('Sandbox');

    act(() => result.current.setEnvironment('production'));
    expect(result.current.environment).toBe('production');
    expect(result.current.environmentLabel).toBe('Production');

    act(() => result.current.setEnvironment('sandbox'));
    expect(result.current.environmentLabel).toBe('Sandbox');
  });

  it('flips to production + invalidates queries + toasts on wizard completion', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'compliance_csid',
        productionCertActive: false,
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
    const { result, queryClient } = renderHookWithProviders(() => useZatcaIntegrationSettings());
    await waitFor(() => expect(result.current.isOnboarding).toBe(true));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => result.current.handleWizardComplete());

    expect(result.current.environment).toBe('production');
    expect(result.current.wizardOpen).toBe(false);
    expect(invalidateSpy).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });
});
