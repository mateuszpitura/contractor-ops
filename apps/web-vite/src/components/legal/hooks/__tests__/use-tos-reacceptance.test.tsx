/**
 * Spec for `useTosReacceptance` — drives the ToS re-acceptance modal:
 *   - initial `open` true / `isPending` false
 *   - `onAccept` submits the current TOS version via `consent.recordToS`
 *   - success closes the modal, invalidates the consent router, fires a toast
 *   - failure keeps the modal open and surfaces an error toast
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { TOS_CURRENT_VERSION } from '../../../../lib/tos.js';
import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useTosReacceptance } from '../use-tos-reacceptance.js';

const trpcProxy = createTRPCProxy();

describe('useTosReacceptance', () => {
  it('starts open and not pending', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() => useTosReacceptance());
    expect(result.current.open).toBe(true);
    expect(result.current.isPending).toBe(false);
  });

  it('onAccept submits current TOS version, closes modal, invalidates and toasts', async () => {
    toastSuccess.mockClear();
    const handler = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'consent.recordToS': handler,
    });
    const { result, queryClient } = renderHookWithProviders(() => useTosReacceptance());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => result.current.onAccept());

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(handler).toHaveBeenCalledWith({ version: TOS_CURRENT_VERSION });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['consent'] });
    await waitFor(() => expect(result.current.open).toBe(false));
  });

  it('keeps modal open and emits error toast on mutation failure', async () => {
    toastError.mockClear();
    setTRPCMock({
      'consent.recordToS': () => {
        throw new Error('Something went wrong. Please try again.');
      },
    });
    const { result } = renderHookWithProviders(() => useTosReacceptance());

    act(() => result.current.onAccept());

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Something went wrong. Please try again.'),
    );
    expect(result.current.open).toBe(true);
  });
});
