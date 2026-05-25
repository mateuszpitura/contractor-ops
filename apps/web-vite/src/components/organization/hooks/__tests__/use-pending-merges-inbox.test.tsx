/**
 * Hook spec for `usePendingMergesInbox` — the inbox of pending project
 * merges from integrations. The hook fans out into:
 *   - items + candidates derived from `project.pendingMerges`
 *   - active-merge selection state + chosen merge target
 *   - `resolveMerge` mutation (keep-separate vs merge-into-existing)
 */

import { describe, expect, it, vi } from 'vitest';

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
import type { PendingMergeRow } from '../use-pending-merges-inbox.js';
import { usePendingMergesInbox } from '../use-pending-merges-inbox.js';

const trpcProxy = createTRPCProxy();

const sampleRow: PendingMergeRow = {
  id: 'pm1',
  source: 'JIRA',
  externalId: 'JIRA-100',
  incomingName: 'Atlas',
  candidateProjectIds: ['p1', 'p2'],
};

describe('usePendingMergesInbox', () => {
  it('starts empty while the query is pending (loading)', () => {
    setTRPCMock({
      'organizationDefinitions.project.pendingMerges': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => usePendingMergesInbox());
    expect(result.current.items).toEqual([]);
    expect(result.current.candidates).toEqual({});
    expect(result.current.activeMerge).toBeNull();
    expect(result.current.chosenTarget).toBe('');
  });

  it('exposes empty items + candidates on a resolved-empty payload', async () => {
    setTRPCMock({
      'organizationDefinitions.project.pendingMerges': () => ({
        items: [],
        candidates: [],
      }),
    });
    const { result } = renderHookWithProviders(() => usePendingMergesInbox());
    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(result.current.candidates).toEqual({});
  });

  it('maps items + indexes candidates by id on success', async () => {
    setTRPCMock({
      'organizationDefinitions.project.pendingMerges': () => ({
        items: [sampleRow],
        candidates: [
          { id: 'p1', name: 'Atlas (existing)', status: 'ACTIVE', source: 'MANUAL' },
          { id: 'p2', name: 'Atlas 2', status: 'ACTIVE', source: 'JIRA' },
        ],
      }),
    });
    const { result } = renderHookWithProviders(() => usePendingMergesInbox());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.candidates.p1?.name).toBe('Atlas (existing)');
    expect(result.current.candidates.p2?.source).toBe('JIRA');
  });

  it('openMerge seeds activeMerge + chosenTarget from first candidate', async () => {
    setTRPCMock({
      'organizationDefinitions.project.pendingMerges': () => ({
        items: [sampleRow],
        candidates: [],
      }),
    });
    const { result } = renderHookWithProviders(() => usePendingMergesInbox());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.openMerge(sampleRow));
    expect(result.current.activeMerge?.id).toBe('pm1');
    expect(result.current.chosenTarget).toBe('p1');
  });

  it('keepSeparate fires the resolveMerge mutation with action="keep"', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'organizationDefinitions.project.pendingMerges': () => ({
        items: [sampleRow],
        candidates: [],
      }),
      'organizationDefinitions.project.resolveMerge': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => usePendingMergesInbox());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.openMerge(sampleRow));
    act(() => result.current.keepSeparate());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Merge resolved'));
    expect(result.current.activeMerge).toBeNull();
    expect(result.current.chosenTarget).toBe('');
  });

  it('mergeIntoExisting fires resolveMerge with action="merge" + chosen target', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'organizationDefinitions.project.pendingMerges': () => ({
        items: [sampleRow],
        candidates: [],
      }),
      'organizationDefinitions.project.resolveMerge': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => usePendingMergesInbox());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.openMerge(sampleRow));
    act(() => result.current.setChosenTarget('p2'));
    act(() => result.current.mergeIntoExisting());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Merge resolved'));
  });

  it('keepSeparate without an active merge is a no-op', async () => {
    setTRPCMock({
      'organizationDefinitions.project.pendingMerges': () => ({
        items: [],
        candidates: [],
      }),
      'organizationDefinitions.project.resolveMerge': () => {
        throw new Error('should not fire');
      },
    });
    const { result } = renderHookWithProviders(() => usePendingMergesInbox());
    await waitFor(() => expect(result.current.items).toEqual([]));
    act(() => result.current.keepSeparate());
    expect(toastError).not.toHaveBeenCalledWith('should not fire');
  });

  it('error path: resolveMerge failure surfaces error toast', async () => {
    toastError.mockClear();
    setTRPCMock({
      'organizationDefinitions.project.pendingMerges': () => ({
        items: [sampleRow],
        candidates: [],
      }),
      'organizationDefinitions.project.resolveMerge': () => {
        throw new Error('locked');
      },
    });
    const { result } = renderHookWithProviders(() => usePendingMergesInbox());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.openMerge(sampleRow));
    act(() => result.current.keepSeparate());
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('locked'));
  });

  it('closeMerge clears activeMerge but preserves chosenTarget snapshot', async () => {
    setTRPCMock({
      'organizationDefinitions.project.pendingMerges': () => ({
        items: [sampleRow],
        candidates: [],
      }),
    });
    const { result } = renderHookWithProviders(() => usePendingMergesInbox());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.openMerge(sampleRow));
    expect(result.current.activeMerge).not.toBeNull();
    act(() => result.current.closeMerge());
    expect(result.current.activeMerge).toBeNull();
  });
});
