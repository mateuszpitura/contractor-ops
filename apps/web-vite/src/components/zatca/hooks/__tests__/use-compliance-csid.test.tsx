/**
 * `useComplianceCsid` — step 3 of the ZATCA onboarding wizard. Covers idle
 * phase, success path (submitting → storing → done) plus the derived flags,
 * and error path (phase resets to idle + toast.error).
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
import { useComplianceCsid } from '../use-compliance-csid.js';

const trpcProxy = createTRPCProxy();

describe('useComplianceCsid', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    setTRPCMock({});
  });

  it('starts in the idle phase with all status flags off', () => {
    const { result } = renderHookWithProviders(() => useComplianceCsid());
    expect(result.current.phase).toBe('idle');
    expect(result.current.csrSubmitted).toBe(false);
    expect(result.current.csidReceived).toBe(false);
    expect(result.current.certStored).toBe(false);
  });

  it('progresses through submitting → storing → done with the right derived flags', async () => {
    setTRPCMock({
      'zatca.requestComplianceCsid': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => useComplianceCsid());

    act(() => result.current.setOtp('1234'));
    await act(async () => {
      result.current.requestComplianceCsid();
    });

    // After the 500ms storing → done timer fires, phase settles on `done`.
    await waitFor(() => expect(result.current.phase).toBe('done'), { timeout: 900 });
    expect(result.current.csrSubmitted).toBe(true);
    expect(result.current.csidReceived).toBe(true);
    expect(result.current.certStored).toBe(true);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('resets to idle and emits an error toast when the mutation rejects', async () => {
    setTRPCMock({
      'zatca.requestComplianceCsid': () => {
        throw new Error('CSID upstream rejected');
      },
    });
    const { result } = renderHookWithProviders(() => useComplianceCsid());

    act(() => result.current.setOtp('1234'));
    await act(async () => {
      result.current.requestComplianceCsid();
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(result.current.phase).toBe('idle');
    expect(result.current.csrSubmitted).toBe(false);
  });
});
