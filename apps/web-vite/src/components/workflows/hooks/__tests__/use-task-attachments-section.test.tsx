/**
 * `useTaskAttachmentsSection` — task-run attachments list + retry.
 * Covers: loading, empty, success, error (handleRetry refetches).
 */

import { describe, expect, it, vi } from 'vitest';

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useTaskAttachmentsSection } = await import('../use-task-attachments-section.js');

const sampleDoc = {
  id: 'd1',
  originalFileName: 'contract.pdf',
  mimeType: 'application/pdf',
  fileSizeBytes: 4096,
  virusScanStatus: 'CLEAN',
  createdAt: '2026-05-01',
  uploadedByUserId: 'u1',
  status: 'READY',
};

describe('useTaskAttachmentsSection', () => {
  it('reports loading while the documents query is pending', () => {
    setTRPCMock({
      'document.list': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useTaskAttachmentsSection('task-1'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.documents).toEqual([]);
    clearTRPCMock();
  });

  it('returns an empty list when the API has no documents', async () => {
    setTRPCMock({
      'document.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useTaskAttachmentsSection('task-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.documents).toEqual([]);
    clearTRPCMock();
  });

  it('surfaces documents on success', async () => {
    setTRPCMock({
      'document.list': () => ({ items: [sampleDoc], total: 1 }),
    });
    const { result } = renderHookWithProviders(() => useTaskAttachmentsSection('task-1'));
    await waitFor(() => expect(result.current.documents.length).toBe(1));
    expect(result.current.documents[0]?.originalFileName).toBe('contract.pdf');
    clearTRPCMock();
  });

  it('reports isError and lets handleRetry trigger a refetch', async () => {
    let calls = 0;
    setTRPCMock({
      'document.list': () => {
        calls += 1;
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useTaskAttachmentsSection('task-1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    const before = calls;
    await act(async () => {
      result.current.handleRetry();
    });
    await waitFor(() => expect(calls).toBeGreaterThan(before));
    clearTRPCMock();
  });
});
