/**
 * `useZatcaComplianceWidget` — KPI + expiry derivations for the compliance
 * widget card. Covers loading, the no-cert empty state, the populated
 * "health %" success path, certificate expiry colour bands (>30 days,
 * 7-29 days, <7 days), and the error fallback.
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
import { useZatcaComplianceWidget } from '../use-zatca-compliance-widget.js';

const trpcProxy = createTRPCProxy();

function isoFromNow(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
}

describe('useZatcaComplianceWidget', () => {
  beforeEach(() => {
    setTRPCMock({});
  });

  it('isLoading=true while the stats query is pending', () => {
    setTRPCMock({
      'zatca.getComplianceStats': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() =>
      useZatcaComplianceWidget('production', 'Production'),
    );
    expect(result.current.isLoading).toBe(true);
  });

  it('returns 100% health and no expiry days when stats are empty and no cert date is passed', async () => {
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
    const { result } = renderHookWithProviders(() =>
      useZatcaComplianceWidget('production', 'Production'),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.healthPercent).toBe(100);
    expect(result.current.expiryDays).toBeNull();
    expect(result.current.expiryColor).toBe('text-muted-foreground');
  });

  it('derives health % from cleared + reported when populated', async () => {
    setTRPCMock({
      'zatca.getComplianceStats': () => ({
        total: 4,
        cleared: 2,
        reported: 1,
        rejected: 1,
        pending: 0,
        warning: 0,
      }),
    });
    const { result } = renderHookWithProviders(() =>
      useZatcaComplianceWidget('production', 'Production'),
    );
    await waitFor(() => expect(result.current.healthPercent).toBe(75));
    expect(result.current.stats?.cleared).toBe(2);
  });

  it('uses the muted colour band when the cert is comfortably in date (>=30 days)', async () => {
    setTRPCMock({
      'zatca.getComplianceStats': () => ({
        total: 1,
        cleared: 1,
        reported: 0,
        rejected: 0,
        pending: 0,
        warning: 0,
      }),
    });
    const { result } = renderHookWithProviders(() =>
      useZatcaComplianceWidget('production', 'Production', isoFromNow(90)),
    );
    await waitFor(() => expect(result.current.expiryDays).not.toBeNull());
    expect(result.current.expiryColor).toBe('text-muted-foreground');
  });

  it('switches to amber when the cert expires within 30 days', async () => {
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
    const { result } = renderHookWithProviders(() =>
      useZatcaComplianceWidget('production', 'Production', isoFromNow(10)),
    );
    await waitFor(() => expect(result.current.expiryDays).toBeLessThan(30));
    expect(result.current.expiryColor).toBe('text-amber-600 dark:text-amber-400');
  });

  it('switches to red when the cert expires within 7 days', async () => {
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
    const { result } = renderHookWithProviders(() =>
      useZatcaComplianceWidget('production', 'Production', isoFromNow(3)),
    );
    await waitFor(() => expect(result.current.expiryDays).toBeLessThan(7));
    expect(result.current.expiryColor).toBe('text-red-600 dark:text-red-400');
  });

  it('falls back to 100% / no-stats on query error', async () => {
    setTRPCMock({
      'zatca.getComplianceStats': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useZatcaComplianceWidget('production', 'Production'),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.healthPercent).toBe(100);
    expect(result.current.stats).toBeUndefined();
  });
});
