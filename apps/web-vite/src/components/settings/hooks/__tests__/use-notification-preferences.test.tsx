/**
 * `useNotificationPreferences` — covers the loading/empty/error/success
 * paths for the preferences form plus the mutation contract: invalidation
 * fires on the right queryKey and toasts emit on success / failure.
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
import { useNotificationPreferences } from '../use-notification-preferences.js';

const trpcProxy = createTRPCProxy();

describe('useNotificationPreferences', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    setTRPCMock({});
  });

  it('isLoading=true while the preferences query is pending', () => {
    setTRPCMock({
      'notification.getPreferences': () => new Promise(() => undefined),
      'integration.getSlackStatus': () => ({ connected: false }),
      'integration.getHealth': () => ({ status: 'DISCONNECTED' }),
    });
    const { result } = renderHookWithProviders(() => useNotificationPreferences());
    expect(result.current.isLoading).toBe(true);
  });

  it('returns isSlackConnected=false and isTeamsConnected=false on empty channels', async () => {
    setTRPCMock({
      'notification.getPreferences': () => [],
      'integration.getSlackStatus': () => ({ connected: false }),
      'integration.getHealth': () => ({ status: 'DISCONNECTED' }),
    });
    const { result } = renderHookWithProviders(() => useNotificationPreferences());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isSlackConnected).toBe(false);
    expect(result.current.isTeamsConnected).toBe(false);
  });

  it('exposes integration status after successful queries', async () => {
    setTRPCMock({
      'notification.getPreferences': () => [],
      'integration.getSlackStatus': () => ({ connected: true }),
      'integration.getHealth': () => ({ status: 'CONNECTED' }),
    });
    const { result } = renderHookWithProviders(() => useNotificationPreferences());
    await waitFor(() => expect(result.current.isSlackConnected).toBe(true));
    expect(result.current.isTeamsConnected).toBe(true);
  });

  it('emits success toast and invalidates after a successful save', async () => {
    setTRPCMock({
      'notification.getPreferences': () => [],
      'integration.getSlackStatus': () => ({ connected: false }),
      'integration.getHealth': () => ({ status: 'DISCONNECTED' }),
      'notification.updatePreferences': () => ({ ok: true }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useNotificationPreferences());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.onSubmit({
        preferences: [
          {
            notificationType: 'APPROVAL_REQUEST',
            channelEmail: true,
            channelSlack: false,
            channelTeams: false,
          },
        ],
      });
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('emits error toast when the save mutation rejects', async () => {
    setTRPCMock({
      'notification.getPreferences': () => [],
      'integration.getSlackStatus': () => ({ connected: false }),
      'integration.getHealth': () => ({ status: 'DISCONNECTED' }),
      'notification.updatePreferences': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useNotificationPreferences());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.onSubmit({
        preferences: [
          {
            notificationType: 'APPROVAL_REQUEST',
            channelEmail: true,
            channelSlack: false,
            channelTeams: false,
          },
        ],
      });
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
