/**
 * Hook spec for `useApprovalChain` — resolves an approval chain config by id.
 * Covers loading / empty (no chainConfigId disables the query) / error
 * (handler throws) / success (steps array surfaced) paths.
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
import { useApprovalChain } from '../use-approval-chain.js';

const trpcProxy = createTRPCProxy();

afterEach(() => {
  clearTRPCMock();
});

describe('useApprovalChain', () => {
  it('skips the query when chainConfigId is null (empty state)', async () => {
    const handler = vi.fn();
    setTRPCMock({ 'approval.getChain': handler });
    const { result } = renderHookWithProviders(() => useApprovalChain(null));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.chain).toBeUndefined();
    expect(result.current.steps).toEqual([]);
    expect(handler).not.toHaveBeenCalled();
  });

  it('skips the query when enabled=false', async () => {
    const handler = vi.fn();
    setTRPCMock({ 'approval.getChain': handler });
    const { result } = renderHookWithProviders(() => useApprovalChain('chain-1', false));
    expect(result.current.isLoading).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('loading state before the query resolves', () => {
    setTRPCMock({
      'approval.getChain': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useApprovalChain('chain-1'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.steps).toEqual([]);
  });

  it('surfaces chain + steps array on success', async () => {
    const steps = [
      {
        name: 'Manager',
        approverUserId: null,
        approverRole: 'MANAGER',
        slaHours: 24,
        required: true,
      },
      {
        name: 'Director',
        approverUserId: 'u-1',
        approverRole: null,
        slaHours: 48,
        required: true,
      },
    ];
    setTRPCMock({
      'approval.getChain': () => ({ name: 'Finance Chain', stepsJson: steps }),
    });
    const { result } = renderHookWithProviders(() => useApprovalChain('chain-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.chain?.name).toBe('Finance Chain');
    expect(result.current.steps).toHaveLength(2);
    expect(result.current.steps[0]?.name).toBe('Manager');
  });

  it('returns empty steps when stepsJson is not an array', async () => {
    setTRPCMock({
      'approval.getChain': () => ({ name: 'Bad', stepsJson: null }),
    });
    const { result } = renderHookWithProviders(() => useApprovalChain('chain-1'));
    await waitFor(() => expect(result.current.chain).toBeDefined());
    expect(result.current.steps).toEqual([]);
  });

  it('error path: chain stays undefined, steps stays empty', async () => {
    setTRPCMock({
      'approval.getChain': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useApprovalChain('chain-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.chain).toBeUndefined();
    expect(result.current.steps).toEqual([]);
  });
});
