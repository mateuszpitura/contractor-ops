import { describe, expect, it, vi } from 'vitest';

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from './render-portal-hook.js';

vi.mock('../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const { usePortalLoginVerify } = await import('../hooks/use-portal-login-verify.js');

describe('usePortalLoginVerify', () => {
  it('loading: mutations start in idle, not pending', () => {
    setTRPCMock({
      'portal.verifyMagicLink': () => ({ ok: true }),
      'portal.selectOrg': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => usePortalLoginVerify());
    expect(result.current.verifyMagicLink.isPending).toBe(false);
    expect(result.current.selectOrg.isPending).toBe(false);
    clearTRPCMock();
  });

  it('success verify: emits success toast on verifyMagicLink success', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'portal.verifyMagicLink': () => ({ needsOrgPicker: false, session: { rawToken: 't' } }),
      'portal.selectOrg': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => usePortalLoginVerify());
    await act(async () => {
      await result.current.verifyMagicLink.mutateAsync({ token: 'abc' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('error verify: emits error toast when verifyMagicLink throws', async () => {
    toastError.mockClear();
    setTRPCMock({
      'portal.verifyMagicLink': () => {
        throw new Error('expired');
      },
      'portal.selectOrg': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => usePortalLoginVerify());
    await act(async () => {
      await result.current.verifyMagicLink.mutateAsync({ token: 'abc' }).catch(() => undefined);
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('success selectOrg: emits success toast on selectOrg success', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'portal.verifyMagicLink': () => ({ needsOrgPicker: false }),
      'portal.selectOrg': () => ({
        rawToken: 't',
        expiresAt: new Date('2026-12-31'),
        signature: 'sig',
      }),
    });
    const { result } = renderHookWithProviders(() => usePortalLoginVerify());
    await act(async () => {
      await result.current.selectOrg.mutateAsync({
        verificationNonce: 'n',
        contractorId: 'c1',
        organizationId: 'o1',
      } as never);
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    clearTRPCMock();
  });
});
