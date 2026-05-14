import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('useResourceMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows success toast and calls onClose on successful mutation', async () => {
    const onClose = vi.fn();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useResourceMutation(
          {
            mutationFn: async (vars: { id: string }) => ({ ok: true, id: vars.id }),
          },
          {
            successMessage: 'Created',
            onClose,
          },
        ),
      { wrapper: Wrapper },
    );

    result.current.mutate({ id: '42' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Created');
    expect(onClose).toHaveBeenCalledOnce();
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
            successMessage: 'Done',
          },
        ),
      { wrapper: Wrapper },
    );

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['contractor', 'list'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['contractor', 'stats'] });
  });

  it('shows errorMessage toast when mutation rejects', async () => {
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
            successMessage: 'Should not show',
            errorMessage: 'Failed to create',
          },
        ),
      { wrapper: Wrapper },
    );

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Failed to create');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('falls back to error.message when no errorMessage given', async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useResourceMutation(
          {
            mutationFn: async () => {
              throw new Error('Server boom');
            },
          },
          { successMessage: 'Done' },
        ),
      { wrapper: Wrapper },
    );

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Server boom');
  });

  it('preserves caller-supplied onSuccess and runs it before invalidate/toast', async () => {
    const callerOnSuccess = vi.fn();
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useResourceMutation(
          {
            mutationFn: async () => ({ value: 1 }),
            onSuccess: callerOnSuccess,
          },
          {
            invalidate: [['x']],
            successMessage: 'Saved',
          },
        ),
      { wrapper: Wrapper },
    );

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSuccess).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['x'] });
    expect(toast.success).toHaveBeenCalledWith('Saved');
  });

  it('does not call onClose when mutation errors', async () => {
    const onClose = vi.fn();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useResourceMutation(
          {
            mutationFn: async () => {
              throw new Error('nope');
            },
          },
          {
            successMessage: 'never',
            errorMessage: 'oops',
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
