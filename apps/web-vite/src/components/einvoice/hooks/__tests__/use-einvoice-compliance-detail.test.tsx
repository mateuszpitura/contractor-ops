/**
 * `useEinvoiceComplianceDetail` — settings-page detail hook.
 *
 * Covers:
 *   - loading: query pending → isLoading true, statuses []
 *   - empty: query resolves with no statuses → empty list
 *   - success: statuses passed through with translated state labels
 *   - error: query rejects → statuses default to []
 *   - formatTimeAgo: "just now" / minutes / hours / days / "never" branches
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
import { useEinvoiceComplianceDetail } from '../use-einvoice-compliance-detail.js';

const trpcProxy = createTRPCProxy();

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    profileId: 'pl-1',
    state: 'active',
    country: 'PL',
    displayName: 'KSeF Poland',
    healthScore: 95,
    lastSyncAt: new Date().toISOString(),
    lastErrorMessage: null,
    capabilities: {
      canGenerate: true,
      canParse: true,
      canSign: true,
      canQRCode: false,
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useEinvoiceComplianceDetail', () => {
  it('reports loading while the query is pending', () => {
    let resolve!: (v: unknown) => void;
    setTRPCMock({
      'einvoice.complianceStatuses': () =>
        new Promise(res => {
          resolve = res;
        }),
    });

    const { result, unmount } = renderHookWithProviders(() => useEinvoiceComplianceDetail());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.statuses).toEqual([]);

    resolve({ statuses: [] });
    unmount();
  });

  it('returns an empty list when no profiles are configured', async () => {
    setTRPCMock({
      'einvoice.complianceStatuses': () => ({ statuses: [] }),
    });

    const { result } = renderHookWithProviders(() => useEinvoiceComplianceDetail());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.statuses).toEqual([]);
  });

  it('passes statuses through with localized state labels and a t function', async () => {
    const statuses = [
      makeStatus({ profileId: 'pl-1', displayName: 'KSeF Poland', state: 'active' }),
      makeStatus({ profileId: 'de-1', displayName: 'XRechnung Germany', state: 'sandbox' }),
    ];
    setTRPCMock({
      'einvoice.complianceStatuses': () => ({ statuses }),
    });

    const { result } = renderHookWithProviders(() => useEinvoiceComplianceDetail());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.statuses).toEqual(statuses);
    expect(typeof result.current.stateLabels.active).toBe('string');
    expect(result.current.stateLabels.active.length).toBeGreaterThan(0);
    expect(typeof result.current.t).toBe('function');
  });

  it('defaults statuses to [] when the query rejects', async () => {
    setTRPCMock({
      'einvoice.complianceStatuses': () => {
        throw new Error('boom');
      },
    });

    const { result } = renderHookWithProviders(() => useEinvoiceComplianceDetail());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.statuses).toEqual([]);
  });

  it('formatTimeAgo returns the "never" copy when no date is provided', async () => {
    setTRPCMock({
      'einvoice.complianceStatuses': () => ({ statuses: [] }),
    });

    const { result } = renderHookWithProviders(() => useEinvoiceComplianceDetail());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const never = result.current.formatTimeAgo(undefined);
    expect(typeof never).toBe('string');
    expect(never.length).toBeGreaterThan(0);
    // i18n key fallback ("timeNever") or translated copy — both are non-empty strings.
  });

  it('formatTimeAgo branches across just-now / minutes / hours / days', async () => {
    setTRPCMock({
      'einvoice.complianceStatuses': () => ({ statuses: [] }),
    });

    const { result } = renderHookWithProviders(() => useEinvoiceComplianceDetail());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const now = new Date();
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60_000);

    expect(result.current.formatTimeAgo(now)).toMatch(/.+/);
    expect(result.current.formatTimeAgo(fiveMinAgo)).toMatch(/.+/);
    expect(result.current.formatTimeAgo(twoHoursAgo)).toMatch(/.+/);
    expect(result.current.formatTimeAgo(twoDaysAgo)).toMatch(/.+/);

    // All branches must yield distinct human-readable strings — proves the
    // minutes/hours/days conditionals are reachable from real Date inputs.
    const outputs = new Set([
      result.current.formatTimeAgo(now),
      result.current.formatTimeAgo(fiveMinAgo),
      result.current.formatTimeAgo(twoHoursAgo),
      result.current.formatTimeAgo(twoDaysAgo),
    ]);
    expect(outputs.size).toBe(4);
  });
});
