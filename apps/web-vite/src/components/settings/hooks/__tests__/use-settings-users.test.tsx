/**
 * Sanity spec for the `renderHookWithProviders` harness against the
 * simplest settings hook (`useSettingsUsers`). Exercises loading → success
 * via the queryFn override path; the harness mocks tRPC at the module
 * boundary and lets React Query drive the lifecycle.
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
import { useSettingsUsers } from '../use-settings-users.js';

const trpcProxy = createTRPCProxy();

describe('useSettingsUsers', () => {
  beforeEach(() => {
    setTRPCMock({});
  });

  it('returns isLoading=true while the users query is pending', () => {
    setTRPCMock({
      'user.list': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useSettingsUsers());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.users).toEqual([]);
  });

  it('returns empty users on a resolved-empty response', async () => {
    setTRPCMock({
      'user.list': () => [],
    });
    const { result } = renderHookWithProviders(() => useSettingsUsers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.users).toEqual([]);
  });

  it('surfaces the success payload on the users field', async () => {
    const sample = [
      { id: 'u1', name: 'Alice', email: 'a@x.test' },
      { id: 'u2', name: 'Bob', email: 'b@x.test' },
    ];
    setTRPCMock({
      'user.list': () => sample,
    });
    const { result } = renderHookWithProviders(() => useSettingsUsers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.users).toEqual(sample);
  });

  it('keeps users as empty array when the query errors', async () => {
    setTRPCMock({
      'user.list': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useSettingsUsers());
    await waitFor(() => expect(result.current.usersQuery.isError).toBe(true));
    expect(result.current.users).toEqual([]);
  });
});
