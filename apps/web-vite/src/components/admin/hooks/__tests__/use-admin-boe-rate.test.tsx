/**
 * `use-admin-boe-rate` — exhaustive coverage of the BoE-rate domain hooks:
 *   - useBoeRateList: loading / empty / success / error
 *   - useBoeRatePollerStatus: no entries / no api entries / rate-changed / unchanged
 *   - useBoeRateInsert / Update / Delete: invalidation + success toast + error toast
 *   - useBoeRateValidation: range and required-date checks
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
import type { BoeRateEntry } from '../use-admin-boe-rate.js';
import {
  useBoeRateDelete,
  useBoeRateInsert,
  useBoeRateList,
  useBoeRatePollerStatus,
  useBoeRateUpdate,
  useBoeRateValidation,
} from '../use-admin-boe-rate.js';

const trpcProxy = createTRPCProxy();

function makeEntry(overrides: Partial<BoeRateEntry> = {}): BoeRateEntry {
  return {
    id: 'rate-1',
    effectiveFrom: '2024-08-01T00:00:00.000Z',
    ratePercent: '5.25',
    source: 'BOE_API',
    recordedByUserId: null,
    recordedAt: '2024-08-01T00:00:00.000Z',
    createdAt: '2024-08-01T00:00:00.000Z',
    notes: null,
    ...overrides,
  };
}

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
  setTRPCMock({});
});

describe('useBoeRateList', () => {
  it('isLoading=true while the list query is pending', () => {
    setTRPCMock({ 'adminBoeRate.list': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => useBoeRateList());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.entries).toBeUndefined();
  });

  it('returns an empty entries array on a resolved-empty response', async () => {
    setTRPCMock({ 'adminBoeRate.list': () => [] });
    const { result } = renderHookWithProviders(() => useBoeRateList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toEqual([]);
  });

  it('surfaces the success payload as entries', async () => {
    const sample = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
    setTRPCMock({ 'adminBoeRate.list': () => sample });
    const { result } = renderHookWithProviders(() => useBoeRateList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toEqual(sample);
  });

  it('keeps entries undefined when the query errors', async () => {
    setTRPCMock({
      'adminBoeRate.list': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useBoeRateList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toBeUndefined();
  });
});

describe('useBoeRatePollerStatus', () => {
  it('leaves all fields undefined/empty while the list is still loading', () => {
    setTRPCMock({ 'adminBoeRate.list': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => useBoeRatePollerStatus());
    expect(result.current.entries).toBeUndefined();
    expect(result.current.apiEntries).toEqual([]);
    expect(result.current.latestApiEntry).toBeNull();
    expect(result.current.rateChanged).toBe(true);
  });

  it('returns an empty apiEntries list when only manual rates exist', async () => {
    setTRPCMock({
      'adminBoeRate.list': () => [makeEntry({ source: 'MANUAL' })],
    });
    const { result } = renderHookWithProviders(() => useBoeRatePollerStatus());
    await waitFor(() => expect(result.current.entries).not.toBeUndefined());
    expect(result.current.apiEntries).toEqual([]);
    expect(result.current.latestApiEntry).toBeNull();
  });

  it('flags rateChanged=true when only one BOE_API entry is present', async () => {
    const api = makeEntry({ id: 'api-1', source: 'BOE_API', ratePercent: '5.25' });
    setTRPCMock({ 'adminBoeRate.list': () => [api] });
    const { result } = renderHookWithProviders(() => useBoeRatePollerStatus());
    await waitFor(() => expect(result.current.latestApiEntry).not.toBeNull());
    expect(result.current.rateChanged).toBe(true);
    expect(result.current.latestApiEntry).toEqual(api);
  });

  it('marks rateChanged=false when two BOE_API entries have the same rate', async () => {
    setTRPCMock({
      'adminBoeRate.list': () => [
        makeEntry({ id: 'a', source: 'BOE_API', ratePercent: '5.25' }),
        makeEntry({ id: 'b', source: 'BOE_API', ratePercent: '5.25' }),
      ],
    });
    const { result } = renderHookWithProviders(() => useBoeRatePollerStatus());
    await waitFor(() => expect(result.current.apiEntries.length).toBe(2));
    expect(result.current.rateChanged).toBe(false);
  });

  it('marks rateChanged=true when two BOE_API entries have different rates', async () => {
    setTRPCMock({
      'adminBoeRate.list': () => [
        makeEntry({ id: 'a', source: 'BOE_API', ratePercent: '5.50' }),
        makeEntry({ id: 'b', source: 'BOE_API', ratePercent: '5.25' }),
      ],
    });
    const { result } = renderHookWithProviders(() => useBoeRatePollerStatus());
    await waitFor(() => expect(result.current.apiEntries.length).toBe(2));
    expect(result.current.rateChanged).toBe(true);
  });
});

describe('useBoeRateInsert', () => {
  it('invalidates the list and emits a success toast on insert success', async () => {
    const onSuccess = vi.fn();
    setTRPCMock({
      'adminBoeRate.list': () => [],
      'adminBoeRate.insert': () => ({ id: 'new' }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useBoeRateInsert(onSuccess));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({
        effectiveFrom: new Date('2024-10-01'),
        ratePercent: 5,
      });
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('emits an error toast when insert rejects', async () => {
    const onSuccess = vi.fn();
    setTRPCMock({
      'adminBoeRate.insert': () => {
        throw new Error('insert failed');
      },
    });
    const { result } = renderHookWithProviders(() => useBoeRateInsert(onSuccess));

    await act(async () => {
      result.current.mutate({ effectiveFrom: new Date('2024-10-01'), ratePercent: 5 });
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('useBoeRateUpdate', () => {
  it('invalidates and toasts on update success', async () => {
    const onSuccess = vi.fn();
    setTRPCMock({
      'adminBoeRate.list': () => [],
      'adminBoeRate.update': () => ({ ok: true }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useBoeRateUpdate(onSuccess));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({ id: 'rate-1', ratePercent: 6 });
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('emits an error toast when update rejects', async () => {
    const onSuccess = vi.fn();
    setTRPCMock({
      'adminBoeRate.update': () => {
        throw new Error('update failed');
      },
    });
    const { result } = renderHookWithProviders(() => useBoeRateUpdate(onSuccess));

    await act(async () => {
      result.current.mutate({ id: 'rate-1', ratePercent: 6 });
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('useBoeRateDelete', () => {
  it('invalidates and toasts on delete success', async () => {
    const onSuccess = vi.fn();
    setTRPCMock({
      'adminBoeRate.list': () => [],
      'adminBoeRate.delete': () => ({ ok: true }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useBoeRateDelete(onSuccess));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({ id: 'rate-1' });
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('emits an error toast when delete rejects', async () => {
    const onSuccess = vi.fn();
    setTRPCMock({
      'adminBoeRate.delete': () => {
        throw new Error('delete failed');
      },
    });
    const { result } = renderHookWithProviders(() => useBoeRateDelete(onSuccess));

    await act(async () => {
      result.current.mutate({ id: 'rate-1' });
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('useBoeRateValidation', () => {
  it('returns the parsed rate when within the valid range', () => {
    const { result } = renderHookWithProviders(() => useBoeRateValidation());
    expect(result.current.validateRate('5.25')).toBe(5.25);
  });

  it('returns null and toasts when the rate is out of range', () => {
    const { result } = renderHookWithProviders(() => useBoeRateValidation());
    expect(result.current.validateRate('100')).toBeNull();
    expect(toastError).toHaveBeenCalled();
  });

  it('returns null and toasts when the rate is not a number', () => {
    const { result } = renderHookWithProviders(() => useBoeRateValidation());
    expect(result.current.validateRate('not-a-number')).toBeNull();
    expect(toastError).toHaveBeenCalled();
  });

  it('returns null and toasts when the rate is negative', () => {
    const { result } = renderHookWithProviders(() => useBoeRateValidation());
    expect(result.current.validateRate('-1')).toBeNull();
    expect(toastError).toHaveBeenCalled();
  });

  it('returns true for a non-empty effective date', () => {
    const { result } = renderHookWithProviders(() => useBoeRateValidation());
    expect(result.current.validateDate('2024-10-01')).toBe(true);
  });

  it('returns false and toasts when the effective date is empty', () => {
    const { result } = renderHookWithProviders(() => useBoeRateValidation());
    expect(result.current.validateDate('')).toBe(false);
    expect(toastError).toHaveBeenCalled();
  });
});
