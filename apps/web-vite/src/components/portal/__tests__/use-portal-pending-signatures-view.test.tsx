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

const { usePortalPendingSignaturesView } = await import(
  '../hooks/use-portal-pending-signatures-view.js'
);

const ITEM = {
  envelopeId: 'env-1',
  contractId: 'contract-abcdef',
  recipientName: 'Jan',
  recipientEmail: 'jan@example.com',
  recipientStatus: 'PENDING',
  envelopeStatus: 'SENT',
  message: null,
  expiresAt: null,
  sentAt: '2026-05-01T00:00:00Z',
};

describe('usePortalPendingSignaturesView', () => {
  it('loading: signing target null while query pending', () => {
    setTRPCMock({
      'esign.listPendingForContractor': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => usePortalPendingSignaturesView());
    expect(result.current.signingTarget).toBeNull();
    clearTRPCMock();
  });

  it('empty: items resolves to empty array', async () => {
    setTRPCMock({ 'esign.listPendingForContractor': () => [] });
    const { result } = renderHookWithProviders(() => usePortalPendingSignaturesView());
    await waitFor(() => expect(result.current.pendingQuery.isPending).toBe(false));
    expect(result.current.items).toEqual([]);
    clearTRPCMock();
  });

  it('error: pendingQuery surfaces error state', async () => {
    setTRPCMock({
      'esign.listPendingForContractor': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => usePortalPendingSignaturesView());
    await waitFor(() => expect(result.current.pendingQuery.isError).toBe(true));
    clearTRPCMock();
  });

  it('handleSign: stores signing target for the chosen envelope', async () => {
    setTRPCMock({ 'esign.listPendingForContractor': () => [ITEM] });
    const { result } = renderHookWithProviders(() => usePortalPendingSignaturesView());
    await waitFor(() => expect(result.current.items.length).toBe(1));
    act(() => {
      result.current.handleSign(result.current.items[0]!);
    });
    expect(result.current.signingTarget?.envelopeId).toBe('env-1');
    expect(result.current.signingTarget?.recipientEmail).toBe('jan@example.com');
    clearTRPCMock();
  });

  it('clearSigningTarget: nulls out signing target', async () => {
    setTRPCMock({ 'esign.listPendingForContractor': () => [ITEM] });
    const { result } = renderHookWithProviders(() => usePortalPendingSignaturesView());
    await waitFor(() => expect(result.current.items.length).toBe(1));
    act(() => {
      result.current.handleSign(result.current.items[0]!);
    });
    expect(result.current.signingTarget).not.toBeNull();
    act(() => {
      result.current.clearSigningTarget();
    });
    expect(result.current.signingTarget).toBeNull();
    clearTRPCMock();
  });
});
