/**
 * `useOnboardingProgress` — final-step progress tracker.
 *
 * Covers:
 *   - no-data initial render
 *   - isError surfaces when getProgress query rejects
 *   - status maps onto isComplete / isFailed / isRunning + percentDone
 *   - handleRetry invokes retryFailedItem with jobId + email; success
 *     toast on resolve, error toast on reject
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useOnboardingProgress } from '../use-onboarding-progress.js';

const trpcProxy = createTRPCProxy();

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useOnboardingProgress', () => {
  it('starts with hasData=false while progress is pending', () => {
    setTRPCMock({ 'onboardingImport.getProgress': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => useOnboardingProgress({ jobId: 'job-1' }));
    expect(result.current.hasData).toBe(false);
    expect(result.current.progress).toBeUndefined();
    expect(result.current.percentDone).toBe(0);
  });

  it('exposes isError when getProgress fails', async () => {
    setTRPCMock({
      'onboardingImport.getProgress': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useOnboardingProgress({ jobId: 'job-1' }));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('maps a running snapshot to isRunning + percentDone', async () => {
    setTRPCMock({
      'onboardingImport.getProgress': () => ({
        status: 'running',
        completedItems: 3,
        totalItems: 10,
        failedItems: [],
      }),
    });
    const { result } = renderHookWithProviders(() => useOnboardingProgress({ jobId: 'job-1' }));
    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(result.current.isRunning).toBe(true);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.percentDone).toBe(30);
  });

  it('maps a completed snapshot to isComplete', async () => {
    setTRPCMock({
      'onboardingImport.getProgress': () => ({
        status: 'completed',
        completedItems: 10,
        totalItems: 10,
        failedItems: [],
      }),
    });
    const { result } = renderHookWithProviders(() => useOnboardingProgress({ jobId: 'job-1' }));
    await waitFor(() => expect(result.current.isComplete).toBe(true));
    expect(result.current.percentDone).toBe(100);
  });

  it('maps a failed snapshot to isFailed', async () => {
    setTRPCMock({
      'onboardingImport.getProgress': () => ({
        status: 'failed',
        completedItems: 2,
        totalItems: 5,
        failedItems: [{ email: 'a@x.com', error: 'rate-limit' }],
      }),
    });
    const { result } = renderHookWithProviders(() => useOnboardingProgress({ jobId: 'job-1' }));
    await waitFor(() => expect(result.current.isFailed).toBe(true));
    expect(result.current.progress?.failedItems).toHaveLength(1);
  });

  it('handleRetry fires retryFailedItem with jobId + email and toasts on success', async () => {
    setTRPCMock({
      'onboardingImport.getProgress': () => ({
        status: 'failed',
        completedItems: 0,
        totalItems: 1,
        failedItems: [{ email: 'a@x.com', error: 'oops' }],
      }),
      'onboardingImport.retryFailedItem': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => useOnboardingProgress({ jobId: 'job-1' }));
    await waitFor(() => expect(result.current.hasData).toBe(true));
    act(() => result.current.handleRetry('a@x.com'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('handleRetry surfaces error toast when retryFailedItem rejects', async () => {
    setTRPCMock({
      'onboardingImport.getProgress': () => ({
        status: 'failed',
        completedItems: 0,
        totalItems: 1,
        failedItems: [{ email: 'a@x.com', error: 'oops' }],
      }),
      'onboardingImport.retryFailedItem': () => {
        throw new Error('nope');
      },
    });
    const { result } = renderHookWithProviders(() => useOnboardingProgress({ jobId: 'job-1' }));
    await waitFor(() => expect(result.current.hasData).toBe(true));
    act(() => result.current.handleRetry('a@x.com'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
