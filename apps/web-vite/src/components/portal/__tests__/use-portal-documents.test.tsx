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

const { usePortalDocuments } = await import('../hooks/use-portal-documents.js');

describe('usePortalDocuments', () => {
  it('loading: query is pending', () => {
    setTRPCMock({ 'portal.listDocuments': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => usePortalDocuments());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.documents).toBeUndefined();
    clearTRPCMock();
  });

  it('empty: resolves to empty array', async () => {
    setTRPCMock({ 'portal.listDocuments': () => [] });
    const { result } = renderHookWithProviders(() => usePortalDocuments());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.documents).toEqual([]);
    clearTRPCMock();
  });

  it('error: stays undefined when query throws', async () => {
    setTRPCMock({
      'portal.listDocuments': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => usePortalDocuments());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.documents).toBeUndefined();
    clearTRPCMock();
  });

  it('success: returns the wire payload verbatim', async () => {
    const docs = [
      {
        id: 'd1',
        name: 'NDA.pdf',
        type: 'NDA',
        sizeBytes: 12_345,
        addedAt: '2026-05-01',
        downloadUrl: 'https://files/d1',
      },
    ];
    setTRPCMock({ 'portal.listDocuments': () => docs });
    const { result } = renderHookWithProviders(() => usePortalDocuments());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.documents).toEqual(docs);
    clearTRPCMock();
  });
});
