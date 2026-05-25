/**
 * Hook specs for the Peppol domain — `usePeppolStatus`,
 * `usePeppolStatusCard`, `usePeppolDisconnect`, `usePeppolConnect`,
 * `usePeppolRetryTransmission`, `usePeppolTransmissionStatus`,
 * `usePeppolWizard`. Covers loading / empty / error / success plus
 * mutation invalidation + toast emission and wizard step orchestration.
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

vi.mock('../../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string) => key,
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import {
  usePeppolConnect,
  usePeppolDisconnect,
  usePeppolRetryTransmission,
  usePeppolStatus,
  usePeppolStatusCard,
  usePeppolTransmissionStatus,
  usePeppolWizard,
} from '../use-peppol.js';

const trpcProxy = createTRPCProxy();

const sampleStatus = {
  participant: {
    participantId: '0192:123456789012345',
    aspProvider: 'storecove',
    status: 'ACTIVE',
  },
  connection: { lastSyncAt: '2026-05-25T12:00:00Z' },
};

const sampleParticipant = {
  _count: { sentTransmissions: 4, receivedTransmissions: 2, failedTransmissions: 1 },
};

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePeppolStatus', () => {
  it('starts in loading then resolves with status + participant data', async () => {
    setTRPCMock({
      'peppol.getStatus': () => sampleStatus,
      'peppol.getParticipant': () => sampleParticipant,
    });
    const { result } = renderHookWithProviders(() => usePeppolStatus());
    expect(result.current.statusQuery.isLoading).toBe(true);
    await waitFor(() => expect(result.current.statusQuery.data).toEqual(sampleStatus));
    expect(result.current.participantQuery.data).toEqual(sampleParticipant);
  });

  it('surfaces null data when the server returns null (not connected)', async () => {
    setTRPCMock({
      'peppol.getStatus': () => null,
      'peppol.getParticipant': () => null,
    });
    const { result } = renderHookWithProviders(() => usePeppolStatus());
    await waitFor(() => expect(result.current.statusQuery.isLoading).toBe(false));
    expect(result.current.statusQuery.data).toBeNull();
  });

  it('exposes the query error when the request fails', async () => {
    setTRPCMock({
      'peppol.getStatus': () => {
        throw new Error('boom');
      },
      'peppol.getParticipant': () => null,
    });
    const { result } = renderHookWithProviders(() => usePeppolStatus());
    await waitFor(() => expect(result.current.statusQuery.isError).toBe(true));
    expect((result.current.statusQuery.error as unknown as Error).message).toBe('boom');
  });
});

describe('usePeppolStatusCard', () => {
  it('returns isLoading=true while the status query is in flight', () => {
    setTRPCMock({
      'peppol.getStatus': () => sampleStatus,
      'peppol.getParticipant': () => sampleParticipant,
    });
    const { result } = renderHookWithProviders(() => usePeppolStatusCard());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.participant).toBeNull();
  });

  it('flips to isConnected with a props bag once data resolves', async () => {
    setTRPCMock({
      'peppol.getStatus': () => sampleStatus,
      'peppol.getParticipant': () => sampleParticipant,
    });
    const { result } = renderHookWithProviders(() => usePeppolStatusCard());
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.participant?.participantId).toBe('0192:123456789012345');
    expect(result.current.connection?.lastSyncAt).toBe('2026-05-25T12:00:00Z');
    expect(result.current.counts?.sentTransmissions).toBe(4);
  });

  it('returns empty props bag when the org is not connected', async () => {
    setTRPCMock({
      'peppol.getStatus': () => null,
      'peppol.getParticipant': () => null,
    });
    const { result } = renderHookWithProviders(() => usePeppolStatusCard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.participant).toBeNull();
    expect(result.current.connection).toBeNull();
    expect(result.current.counts).toBeNull();
  });

  it('onDisconnect fires the disconnect mutation and shows a success toast', async () => {
    const disconnectSpy = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'peppol.getStatus': () => sampleStatus,
      'peppol.getParticipant': () => sampleParticipant,
      'peppol.disconnect': disconnectSpy,
    });
    const { result } = renderHookWithProviders(() => usePeppolStatusCard());
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    act(() => result.current.onDisconnect());
    await waitFor(() => expect(disconnectSpy).toHaveBeenCalled());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('toast.disconnected'));
    expect(result.current.isDisconnecting).toBe(false);
  });
});

describe('usePeppolDisconnect', () => {
  it('invalidates status + participant queries on success', async () => {
    setTRPCMock({
      'peppol.disconnect': () => ({ ok: true }),
    });
    const { result, queryClient } = renderHookWithProviders(() => usePeppolDisconnect());
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => result.current.mutate(undefined as never));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('toast.disconnected'));
    const keys = invalidate.mock.calls.map(c => (c[0] as { queryKey: unknown[] }).queryKey?.[0]);
    expect(keys).toContain('peppol.getStatus');
    expect(keys).toContain('peppol.getParticipant');
  });

  it('emits an error toast when disconnect fails', async () => {
    setTRPCMock({
      'peppol.disconnect': () => {
        throw new Error('nope');
      },
    });
    const { result } = renderHookWithProviders(() => usePeppolDisconnect());
    act(() => result.current.mutate(undefined as never));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('nope'));
  });
});

describe('usePeppolConnect', () => {
  it('invokes onSuccess + success toast + status invalidation on success', async () => {
    const onSuccess = vi.fn();
    setTRPCMock({
      'peppol.connect': () => ({ ok: true }),
    });
    const { result, queryClient } = renderHookWithProviders(() => usePeppolConnect({ onSuccess }));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    act(() =>
      result.current.mutate({
        trn: '123456789012345',
        aspProvider: 'storecove',
        apiKey: 'key',
        environment: 'sandbox',
      }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Done.'));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    const keys = invalidate.mock.calls.map(c => (c[0] as { queryKey: unknown[] }).queryKey?.[0]);
    expect(keys).toContain('peppol.getStatus');
  });

  it('invokes onError callback with the failure message', async () => {
    const onError = vi.fn();
    setTRPCMock({
      'peppol.connect': () => {
        throw new Error('bad-key');
      },
    });
    const { result } = renderHookWithProviders(() => usePeppolConnect({ onError }));
    act(() =>
      result.current.mutate({
        trn: '123456789012345',
        aspProvider: 'storecove',
        apiKey: '',
        environment: 'sandbox',
      }),
    );
    await waitFor(() => expect(onError).toHaveBeenCalledWith('bad-key'));
    expect(toastError).toHaveBeenCalled();
  });
});

describe('usePeppolRetryTransmission', () => {
  it('invalidates the transmissions list + emits a retry-queued toast', async () => {
    setTRPCMock({
      'peppol.retryTransmission': () => ({ ok: true }),
    });
    const { result, queryClient } = renderHookWithProviders(() => usePeppolRetryTransmission());
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => result.current.mutate({ transmissionId: 'tx-1' }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('toast.retryQueued'));
    const keys = invalidate.mock.calls.map(c => (c[0] as { queryKey: unknown[] }).queryKey?.[0]);
    expect(keys).toContain('peppol.getTransmissions');
  });

  it('emits the retry-failed toast on error', async () => {
    setTRPCMock({
      'peppol.retryTransmission': () => {
        throw new Error('');
      },
    });
    const { result } = renderHookWithProviders(() => usePeppolRetryTransmission());
    act(() => result.current.mutate({ transmissionId: 'tx-1' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('toast.retryFailed'));
  });
});

describe('usePeppolTransmissionStatus', () => {
  it('marks FAILED status as failed and exposes a retry callback', async () => {
    const retrySpy = vi.fn(() => ({ ok: true }));
    setTRPCMock({ 'peppol.retryTransmission': retrySpy });
    const { result } = renderHookWithProviders(() =>
      usePeppolTransmissionStatus({ transmissionId: 'tx-1', status: 'FAILED' }),
    );
    expect(result.current.isFailed).toBe(true);
    act(() => result.current.onRetry());
    await waitFor(() => expect(retrySpy).toHaveBeenCalledWith({ transmissionId: 'tx-1' }));
  });

  it('marks REJECTED status as failed', () => {
    setTRPCMock({ 'peppol.retryTransmission': () => ({ ok: true }) });
    const { result } = renderHookWithProviders(() =>
      usePeppolTransmissionStatus({ transmissionId: 'tx-2', status: 'REJECTED' }),
    );
    expect(result.current.isFailed).toBe(true);
  });

  it('marks DELIVERED as not failed', () => {
    setTRPCMock({ 'peppol.retryTransmission': () => ({ ok: true }) });
    const { result } = renderHookWithProviders(() =>
      usePeppolTransmissionStatus({ transmissionId: 'tx-3', status: 'DELIVERED' }),
    );
    expect(result.current.isFailed).toBe(false);
  });

  it('isRetrying reflects the mutation pending flag (starts false)', () => {
    setTRPCMock({ 'peppol.retryTransmission': () => ({ ok: true }) });
    const { result } = renderHookWithProviders(() =>
      usePeppolTransmissionStatus({ transmissionId: 'tx-4', status: 'FAILED' }),
    );
    expect(result.current.isRetrying).toBe(false);
  });
});

describe('usePeppolWizard', () => {
  function setupConnect(handler: (input: unknown) => unknown = () => ({ ok: true })) {
    setTRPCMock({ 'peppol.connect': handler });
  }

  it('starts on step 1 with empty form and canGoNext=false', () => {
    setupConnect();
    const { result } = renderHookWithProviders(() => usePeppolWizard({ onOpenChange: vi.fn() }));
    expect(result.current.step).toBe(1);
    expect(result.current.trn).toBe('');
    expect(result.current.participantId).toBe('');
    expect(result.current.canGoNext).toBe(false);
  });

  it('builds participantId once a 15-digit TRN is entered and unlocks step 1', () => {
    setupConnect();
    const { result } = renderHookWithProviders(() => usePeppolWizard({ onOpenChange: vi.fn() }));
    act(() => result.current.setTrn('123456789012345'));
    expect(result.current.participantId).toBe('0192:123456789012345');
    expect(result.current.canGoNext).toBe(true);
  });

  it('advances through steps 1 → 2 → 3 → 4 and submits on next() at step 3', async () => {
    const connectSpy = vi.fn(() => ({ ok: true }));
    setupConnect(connectSpy);
    const { result } = renderHookWithProviders(() => usePeppolWizard({ onOpenChange: vi.fn() }));
    act(() => result.current.setTrn('123456789012345'));
    act(() => result.current.next());
    expect(result.current.step).toBe(2);
    act(() => result.current.next());
    expect(result.current.step).toBe(3);
    act(() => result.current.setApiKey('secret'));
    act(() => result.current.next());
    expect(result.current.step).toBe(4);
    await waitFor(() =>
      expect(connectSpy).toHaveBeenCalledWith({
        trn: '123456789012345',
        aspProvider: 'storecove',
        apiKey: 'secret',
        environment: 'sandbox',
      }),
    );
    await waitFor(() => expect(result.current.step).toBe(5));
  });

  it('sets registrationError + stays on step 4 when connect fails', async () => {
    setupConnect(() => {
      throw new Error('TRN already registered');
    });
    const { result } = renderHookWithProviders(() => usePeppolWizard({ onOpenChange: vi.fn() }));
    act(() => result.current.setTrn('123456789012345'));
    act(() => result.current.next());
    act(() => result.current.next());
    act(() => result.current.setApiKey('k'));
    act(() => result.current.next());
    await waitFor(() => expect(result.current.registrationError).toBe('TRN already registered'));
    expect(result.current.step).toBe(4);
  });

  it('retry() re-submits the registration after a failure and advances on success', async () => {
    let calls = 0;
    setupConnect(() => {
      calls += 1;
      if (calls === 1) throw new Error('flaky');
      return { ok: true };
    });
    const { result } = renderHookWithProviders(() => usePeppolWizard({ onOpenChange: vi.fn() }));
    act(() => result.current.setTrn('123456789012345'));
    act(() => result.current.next());
    act(() => result.current.next());
    act(() => result.current.setApiKey('k'));
    act(() => result.current.next());
    await waitFor(() => expect(result.current.registrationError).toBe('flaky'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.step).toBe(5));
    expect(result.current.registrationError).toBeNull();
  });

  it('back() decrements the step but stops at 1', () => {
    setupConnect();
    const { result } = renderHookWithProviders(() => usePeppolWizard({ onOpenChange: vi.fn() }));
    act(() => result.current.setTrn('123456789012345'));
    act(() => result.current.next());
    expect(result.current.step).toBe(2);
    act(() => result.current.back());
    expect(result.current.step).toBe(1);
    act(() => result.current.back());
    expect(result.current.step).toBe(1);
  });

  it('resetAndClose() clears state and notifies onOpenChange(false)', () => {
    setupConnect();
    const onOpenChange = vi.fn();
    const { result } = renderHookWithProviders(() => usePeppolWizard({ onOpenChange }));
    act(() => result.current.setTrn('123456789012345'));
    act(() => result.current.setApiKey('secret'));
    act(() => result.current.setEnvironment('production'));
    act(() => result.current.resetAndClose());
    expect(result.current.trn).toBe('');
    expect(result.current.apiKey).toBe('');
    expect(result.current.environment).toBe('sandbox');
    expect(result.current.step).toBe(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('toggleShowApiKey flips the showApiKey flag', () => {
    setupConnect();
    const { result } = renderHookWithProviders(() => usePeppolWizard({ onOpenChange: vi.fn() }));
    expect(result.current.showApiKey).toBe(false);
    act(() => result.current.toggleShowApiKey());
    expect(result.current.showApiKey).toBe(true);
    act(() => result.current.toggleShowApiKey());
    expect(result.current.showApiKey).toBe(false);
  });
});
