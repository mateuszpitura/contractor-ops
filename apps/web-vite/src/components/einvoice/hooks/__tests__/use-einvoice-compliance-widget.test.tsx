/**
 * `useEinvoiceComplianceWidget` — section hook for the e-invoicing dashboard widget.
 *
 * Covers:
 *   - loading: both queries pending → isLoading true, empty statuses
 *   - empty: no statuses + no peppol participant → statuses [], peppolState null
 *   - success: statuses passed through and peppol status mapped to UI state
 *   - peppol mapping: ACTIVE→active, PENDING→onboarding, REGISTERED→onboarding,
 *     SUSPENDED→suspended, unknown→error
 *   - error: when complianceStatuses query throws, statuses default to []
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import {
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useEinvoiceComplianceWidget } from '../use-einvoice-compliance-widget.js';

const trpcProxy = createTRPCProxy();

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    profileId: 'sa-1',
    state: 'active',
    country: 'SA',
    displayName: 'Saudi Arabia',
    healthScore: 100,
    capabilities: {
      canGenerate: true,
      canParse: true,
      canSign: true,
      canQRCode: true,
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useEinvoiceComplianceWidget', () => {
  it('reports loading while compliance + peppol queries are pending', () => {
    let resolveCompliance!: (v: unknown) => void;
    let resolvePeppol!: (v: unknown) => void;
    setTRPCMock({
      'einvoice.complianceStatuses': () =>
        new Promise(res => {
          resolveCompliance = res;
        }),
      'peppol.getStatus': () =>
        new Promise(res => {
          resolvePeppol = res;
        }),
    });

    const { result, unmount } = renderHookWithProviders(() => useEinvoiceComplianceWidget());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.statuses).toEqual([]);
    expect(result.current.peppolState).toBeNull();

    // unblock the suspended promises so React Query can settle and unmount cleanly
    resolveCompliance({ statuses: [] });
    resolvePeppol(null);
    unmount();
  });

  it('returns empty statuses + null peppolState when nothing is configured', async () => {
    setTRPCMock({
      'einvoice.complianceStatuses': () => ({ statuses: [] }),
      'peppol.getStatus': () => null,
    });

    const { result } = renderHookWithProviders(() => useEinvoiceComplianceWidget());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.statuses).toEqual([]);
    expect(result.current.peppolState).toBeNull();
  });

  it('passes statuses through and exposes localized state labels', async () => {
    const statuses = [
      makeStatus({ profileId: 'sa-1', displayName: 'Saudi Arabia', state: 'active' }),
      makeStatus({ profileId: 'de-1', displayName: 'Germany', state: 'sandbox' }),
    ];
    setTRPCMock({
      'einvoice.complianceStatuses': () => ({ statuses }),
      'peppol.getStatus': () => null,
    });

    const { result } = renderHookWithProviders(() => useEinvoiceComplianceWidget());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.statuses).toEqual(statuses);
    expect(typeof result.current.stateLabels.active).toBe('string');
    expect(result.current.stateLabels.active.length).toBeGreaterThan(0);
    expect(typeof result.current.t).toBe('function');
  });

  it('maps peppol participant ACTIVE status to "active"', async () => {
    setTRPCMock({
      'einvoice.complianceStatuses': () => ({ statuses: [] }),
      'peppol.getStatus': () => ({ participant: { status: 'ACTIVE' } }),
    });

    const { result } = renderHookWithProviders(() => useEinvoiceComplianceWidget());

    await waitFor(() => expect(result.current.peppolState).toBe('active'));
  });

  it('maps PENDING/REGISTERED → onboarding and SUSPENDED → suspended', async () => {
    setTRPCMock({
      'einvoice.complianceStatuses': () => ({ statuses: [] }),
      'peppol.getStatus': () => ({ participant: { status: 'PENDING' } }),
    });
    const pending = renderHookWithProviders(() => useEinvoiceComplianceWidget());
    await waitFor(() => expect(pending.result.current.peppolState).toBe('onboarding'));

    setTRPCMock({
      'einvoice.complianceStatuses': () => ({ statuses: [] }),
      'peppol.getStatus': () => ({ participant: { status: 'REGISTERED' } }),
    });
    const registered = renderHookWithProviders(() => useEinvoiceComplianceWidget());
    await waitFor(() => expect(registered.result.current.peppolState).toBe('onboarding'));

    setTRPCMock({
      'einvoice.complianceStatuses': () => ({ statuses: [] }),
      'peppol.getStatus': () => ({ participant: { status: 'SUSPENDED' } }),
    });
    const suspended = renderHookWithProviders(() => useEinvoiceComplianceWidget());
    await waitFor(() => expect(suspended.result.current.peppolState).toBe('suspended'));
  });

  it('maps unknown peppol participant status to "error"', async () => {
    setTRPCMock({
      'einvoice.complianceStatuses': () => ({ statuses: [] }),
      'peppol.getStatus': () => ({ participant: { status: 'WHATEVER' } }),
    });

    const { result } = renderHookWithProviders(() => useEinvoiceComplianceWidget());

    await waitFor(() => expect(result.current.peppolState).toBe('error'));
  });

  it('keeps statuses empty when complianceStatuses query rejects', async () => {
    setTRPCMock({
      'einvoice.complianceStatuses': () => {
        throw new Error('boom');
      },
      'peppol.getStatus': () => null,
    });

    const { result } = renderHookWithProviders(() => useEinvoiceComplianceWidget());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.statuses).toEqual([]);
  });
});
