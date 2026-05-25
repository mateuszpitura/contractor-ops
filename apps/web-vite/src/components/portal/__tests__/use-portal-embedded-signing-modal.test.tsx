import { describe, expect, it, vi } from 'vitest';

import {
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

const { usePortalEmbeddedSigningModal } = await import(
  '../hooks/use-portal-embedded-signing-modal.js'
);

describe('usePortalEmbeddedSigningModal', () => {
  it('loading: signing query is pending when modal opens', () => {
    setTRPCMock({
      'esign.getSigningUrl': () => new Promise(() => undefined),
      'esign.getPortalSigningUrl': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() =>
      usePortalEmbeddedSigningModal(
        'env-1',
        'jan@example.com',
        true,
        () => undefined,
        () => undefined,
      ),
    );
    expect(result.current.isPending).toBe(true);
    expect(result.current.signingData).toBeUndefined();
    clearTRPCMock();
  });

  it('empty/disabled: closed modal keeps signingData undefined', () => {
    setTRPCMock({
      'esign.getSigningUrl': () => ({ embedded: true, url: 'https://ds.example/sign' }),
      'esign.getPortalSigningUrl': () => ({ embedded: true, url: 'https://ds.example/sign' }),
    });
    const { result } = renderHookWithProviders(() =>
      usePortalEmbeddedSigningModal(
        'env-1',
        'jan@example.com',
        false,
        () => undefined,
        () => undefined,
      ),
    );
    expect(result.current.signingData).toBeUndefined();
    clearTRPCMock();
  });

  it('error: query error keeps signingData undefined', async () => {
    setTRPCMock({
      'esign.getSigningUrl': () => {
        throw new Error('boom');
      },
      'esign.getPortalSigningUrl': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() =>
      usePortalEmbeddedSigningModal(
        'env-1',
        'jan@example.com',
        true,
        () => undefined,
        () => undefined,
        true,
      ),
    );
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.signingData).toBeUndefined();
    clearTRPCMock();
  });

  it('success: returns embedded signing url payload', async () => {
    const payload = { embedded: true, url: 'https://ds.example/sign', expiresAt: '2026-12-31' };
    setTRPCMock({
      'esign.getSigningUrl': () => payload,
      'esign.getPortalSigningUrl': () => payload,
    });
    const { result } = renderHookWithProviders(() =>
      usePortalEmbeddedSigningModal(
        'env-1',
        'jan@example.com',
        true,
        () => undefined,
        () => undefined,
        true,
      ),
    );
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.signingData).toEqual(payload);
    clearTRPCMock();
  });
});
