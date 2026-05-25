/**
 * `useDashboardHome` — single tRPC boundary for the dashboard home section.
 *
 * Covers:
 *   - pending state while `dashboard.bootstrap` is in flight
 *   - error surfaces verbatim when bootstrap rejects
 *   - kpis come straight through on success
 *   - spendMonths input is forwarded into the queryKey (cache differentiation)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { useDashboardHome } from '../use-dashboard-home.js';

const trpcProxy = createTRPCProxy();

const kpisFixture = {
  activeContractors: { value: 42 },
  pendingApprovals: { value: 7 },
  readyToPayTotal: { valueMinor: 1234500 },
  expiringContracts: { value: 3 },
  openTasks: { value: 12 },
};

beforeEach(() => {
  setTRPCMock({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDashboardHome', () => {
  it('returns isPending=true while bootstrap is in flight', () => {
    setTRPCMock({ 'dashboard.bootstrap': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => useDashboardHome());
    expect(result.current.isPending).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.kpis).toBeUndefined();
  });

  it('surfaces the rejection on the error field', async () => {
    setTRPCMock({
      'dashboard.bootstrap': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useDashboardHome());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(String(result.current.error)).toContain('boom');
    expect(result.current.kpis).toBeUndefined();
  });

  it('exposes kpis verbatim on success', async () => {
    setTRPCMock({
      'dashboard.bootstrap': () => ({
        kpis: kpisFixture,
        spendTrend: [],
        deadlines: [],
        activity: [],
      }),
    });
    const { result } = renderHookWithProviders(() => useDashboardHome());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.kpis).toEqual(kpisFixture);
  });

  it('forwards spendMonths into the bootstrap input so cache keys differentiate', async () => {
    const calls: unknown[] = [];
    setTRPCMock({
      'dashboard.bootstrap': (input?: unknown) => {
        calls.push(input);
        return { kpis: kpisFixture, spendTrend: [], deadlines: [], activity: [] };
      },
    });
    const { result } = renderHookWithProviders(() => useDashboardHome('12'));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(calls.at(0)).toEqual({ spendMonths: '12' });
  });

  it('defaults spendMonths to "6" when no argument is provided', async () => {
    const calls: unknown[] = [];
    setTRPCMock({
      'dashboard.bootstrap': (input?: unknown) => {
        calls.push(input);
        return { kpis: kpisFixture, spendTrend: [], deadlines: [], activity: [] };
      },
    });
    const { result } = renderHookWithProviders(() => useDashboardHome());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(calls.at(0)).toEqual({ spendMonths: '6' });
  });
});
