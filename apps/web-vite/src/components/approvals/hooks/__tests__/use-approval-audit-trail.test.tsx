/**
 * Hook spec for `useApprovalAuditTrail` — fetches the audit trail + chain
 * flow for an invoice's approval chain. Covers loading / empty (no
 * invoiceId disables) / error / success paths.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import {
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useApprovalAuditTrail } from '../use-approval-audit-trail.js';

const trpcProxy = createTRPCProxy();

afterEach(() => {
  clearTRPCMock();
});

describe('useApprovalAuditTrail', () => {
  it('skips the query when invoiceId is empty (empty state)', () => {
    const handler = vi.fn();
    setTRPCMock({ 'approval.getAuditTrail': handler });
    const { result } = renderHookWithProviders(() => useApprovalAuditTrail(''));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.events).toEqual([]);
    expect(result.current.flow).toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('skips the query when enabled=false', () => {
    const handler = vi.fn();
    setTRPCMock({ 'approval.getAuditTrail': handler });
    const { result } = renderHookWithProviders(() => useApprovalAuditTrail('inv-1', false));
    expect(result.current.isLoading).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('loading state before query resolves', () => {
    setTRPCMock({
      'approval.getAuditTrail': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useApprovalAuditTrail('inv-1'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.events).toEqual([]);
  });

  it('surfaces events + flow on success', async () => {
    const events = [
      { type: 'system', label: 'submitted', timestamp: '2026-01-01T00:00:00Z' },
      {
        type: 'decision',
        label: 'approve',
        timestamp: '2026-01-02T00:00:00Z',
        actor: { id: 'u-1', name: 'A', email: 'a@x.com', image: null },
      },
    ];
    const flow = { steps: [{ id: 's1' }], chainName: 'Default' };
    setTRPCMock({
      'approval.getAuditTrail': () => ({ events, flow }),
    });
    const { result } = renderHookWithProviders(() => useApprovalAuditTrail('inv-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.events).toHaveLength(2);
    expect(result.current.flow?.chainName).toBe('Default');
  });

  it('defaults events to [] when payload omits the field', async () => {
    setTRPCMock({
      'approval.getAuditTrail': () => ({ flow: { steps: [] } }),
    });
    const { result } = renderHookWithProviders(() => useApprovalAuditTrail('inv-1'));
    await waitFor(() => expect(result.current.flow).toBeDefined());
    expect(result.current.events).toEqual([]);
  });

  it('error path: events stay empty, isLoading resolves to false', async () => {
    setTRPCMock({
      'approval.getAuditTrail': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useApprovalAuditTrail('inv-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.events).toEqual([]);
    expect(result.current.flow).toBeUndefined();
  });
});
