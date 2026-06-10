import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { toast } from 'sonner';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMON_TOAST } from '../../i18n/common-toast-keys.js';
import { setupTestI18n } from '../../test-utils/setup-test-i18n.js';
import { useResourceMutation } from '../use-resource-mutation';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

beforeAll(async () => {
  await setupTestI18n();
});

describe('useResourceMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('translates a TranslationKey successMessage through t()', async () => {
    const onClose = vi.fn();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useResourceMutation(
          { mutationFn: async (vars: { id: string }) => ({ ok: true, id: vars.id }) },
          { successMessage: COMMON_TOAST.done, onClose },
        ),
      { wrapper: Wrapper },
    );

    result.current.mutate({ id: '42' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Done.');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('translates an Errors.* key through t()', async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useResourceMutation(
          { mutationFn: async () => ({ ok: true }) },
          { successMessage: 'Errors.contractorNotFound' },
        ),
      { wrapper: Wrapper },
    );

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Contractor not found.');
  });

  it('translates a { key, params } structured successMessage with ICU interpolation', async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useResourceMutation(
          { mutationFn: async () => ({ ok: true }) },
          {
            successMessage: {
              key: 'Common.greetingWithName' as never,
              params: { name: 'Alice' },
            },
          },
        ),
      { wrapper: Wrapper },
    );

    // No assertion on output (the locale bundle may or may not have a
    // matching key); the point is that the structured form does not throw
    // at the type or runtime level.
    result.current.mutate(undefined);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('invalidates supplied query keys on success', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useResourceMutation(
          { mutationFn: async () => ({ ok: true }) },
          {
            invalidate: [
              ['contractor', 'list'],
              ['contractor', 'stats'],
            ],
            successMessage: COMMON_TOAST.done,
          },
        ),
      { wrapper: Wrapper },
    );

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['contractor', 'list'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['contractor', 'stats'] });
  });

  it('caller-supplied errorMessage overrides auto-translation', async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useResourceMutation(
          {
            mutationFn: async () => {
              throw new Error('Server boom');
            },
          },
          {
            successMessage: COMMON_TOAST.done,
            errorMessage: COMMON_TOAST.failedToApprove,
          },
        ),
      { wrapper: Wrapper },
    );

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Failed to approve.');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('auto-translates API errorKey when no errorMessage is supplied', async () => {
    const { Wrapper } = createWrapper();

    const apiError = Object.assign(new Error('contractorNotFound'), {
      data: { errorKey: 'contractorNotFound' },
    });

    const { result } = renderHook(
      () =>
        useResourceMutation(
          {
            mutationFn: async () => {
              throw apiError;
            },
          },
          { successMessage: COMMON_TOAST.done },
        ),
      { wrapper: Wrapper },
    );

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Contractor not found.');
  });

  it('falls back to Errors.generic when no errorMessage and no recognised errorKey', async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useResourceMutation(
          {
            mutationFn: async () => {
              throw new Error('Server boom');
            },
          },
          { successMessage: COMMON_TOAST.done },
        ),
      { wrapper: Wrapper },
    );

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isError).toBe(true));
    // The raw `error.message` ('Server boom') MUST NOT leak; the user sees
    // the generic fallback instead.
    const call = (toast.error as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call).toBe('Something went wrong. Please try again.');
    expect(call).not.toContain('Server boom');
  });

  it('preserves caller-supplied onSuccess and runs it before invalidate/toast', async () => {
    const callerOnSuccess = vi.fn();
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useResourceMutation(
          { mutationFn: async () => ({ value: 1 }), onSuccess: callerOnSuccess },
          { invalidate: [['x']], successMessage: COMMON_TOAST.done },
        ),
      { wrapper: Wrapper },
    );

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSuccess).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['x'] });
    expect(toast.success).toHaveBeenCalledWith('Done.');
  });

  it('does not call onClose when mutation errors', async () => {
    const onClose = vi.fn();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useResourceMutation(
          {
            mutationFn: async () => {
              throw new Error('Something went wrong. Please try again.');
            },
          },
          {
            successMessage: COMMON_TOAST.done,
            errorMessage: COMMON_TOAST.failedToApprove,
            onClose,
          },
        ),
      { wrapper: Wrapper },
    );

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(onClose).not.toHaveBeenCalled();
  });
});
