/**
 * `useZatcaStatsCards` — drives the 3-card KPI row above the ZATCA
 * integration dashboard. Covers loading state, the "no submissions yet"
 * empty-state success rate (defaults to 100%), the populated success rate
 * derivation, and the error fallback (counts coerced to 0).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { useZatcaStatsCards } from '../use-zatca-stats-cards.js';

const trpcProxy = createTRPCProxy();

describe('useZatcaStatsCards', () => {
  beforeEach(() => {
    setTRPCMock({});
  });

  it('isLoading=true while the stats query is pending', () => {
    setTRPCMock({
      'zatca.getComplianceStats': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useZatcaStatsCards());
    expect(result.current.isLoading).toBe(true);
  });

  it('treats zero submissions as 100% success and counts at 0 (empty state)', async () => {
    setTRPCMock({
      'zatca.getComplianceStats': () => ({
        total: 0,
        cleared: 0,
        reported: 0,
        rejected: 0,
        pending: 0,
        warning: 0,
      }),
    });
    const { result } = renderHookWithProviders(() => useZatcaStatsCards());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.successRate).toBe(100);
    expect(result.current.total).toBe(0);
    expect(result.current.successful).toBe(0);
    expect(result.current.pending).toBe(0);
    expect(result.current.rejected).toBe(0);
  });

  it('derives success rate from cleared + reported / total', async () => {
    setTRPCMock({
      'zatca.getComplianceStats': () => ({
        total: 10,
        cleared: 6,
        reported: 2,
        rejected: 1,
        pending: 1,
        warning: 0,
      }),
    });
    const { result } = renderHookWithProviders(() => useZatcaStatsCards());
    await waitFor(() => expect(result.current.total).toBe(10));
    expect(result.current.successful).toBe(8);
    expect(result.current.successRate).toBe(80);
    expect(result.current.rejected).toBe(1);
    expect(result.current.pending).toBe(1);
  });

  it('falls back to safe zeros on query error (no stats payload)', async () => {
    setTRPCMock({
      'zatca.getComplianceStats': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useZatcaStatsCards());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.successRate).toBe(100);
    expect(result.current.total).toBe(0);
    expect(result.current.pending).toBe(0);
    expect(result.current.rejected).toBe(0);
  });
});
