/**
 * Hook spec for `useApprovalQueue` — the approval-queue page driver:
 *   - drives the approval-flow list + admin-only change-requests list
 *   - exposes nuqs-backed tab / filter / search / pagination state
 *   - wires single-row approve / reject mutations with toast + invalidate
 *   - exposes the resolved chain for the side-panel via `useApprovalChain`
 *
 * Covers: loading, empty (no data + no filters → showQueueEmptyState),
 * error (list query throws), success (data + filters + pageCount), and
 * mutation paths (approve/reject success + error toast + invalidation).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const { toastSuccess, toastError, localeMock, canMock, capturedColumnCallbacks } = vi.hoisted(
  () => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    localeMock: vi.fn(() => 'en'),
    canMock: vi.fn<(resource: string, actions: string[]) => boolean>(),
    capturedColumnCallbacks: {
      current: {} as {
        onApprove?: (stepId: string) => void;
        onReject?: (stepId: string, comment: string) => void;
      },
    },
  }),
);

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock('../../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

vi.mock('../../../../i18n/navigation.js', () => ({
  useLocale: () => localeMock(),
}));

vi.mock('../../../../hooks/use-permissions.js', () => ({
  usePermissions: () => ({ can: canMock }),
}));

// Avoid importing the real columns module (depends on Link / i18n nav). The
// hook only consumes the return as opaque ColumnDef[] for the table. We
// capture the callbacks the hook passes so mutation wiring can be exercised
// in a test.
vi.mock('../../approval-queue/columns.js', () => ({
  getColumns: (
    _t: unknown,
    callbacks: {
      onApprove: (stepId: string) => void;
      onReject: (stepId: string, comment: string) => void;
    },
  ) => {
    capturedColumnCallbacks.current = callbacks;
    return [{ id: 'invoice' }, { id: 'actions' }];
  },
}));

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useApprovalQueue } from '../use-approval-queue.js';

const trpcProxy = createTRPCProxy();

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
  canMock.mockReset();
  canMock.mockReturnValue(false);
});

afterEach(() => {
  clearTRPCMock();
});

function setupListMock(data: { items: unknown[]; total: number }) {
  setTRPCMock({
    'approval.listPending': () => data,
    'settings.listChangeRequests': () => [],
    'approval.getChain': () => undefined,
  });
}

describe('useApprovalQueue — loading / empty / error', () => {
  it('loading: isLoading=true while the list query is pending', () => {
    setTRPCMock({
      'approval.listPending': () => new Promise(() => undefined),
      'settings.listChangeRequests': () => [],
    });
    const { result } = renderHookWithProviders(() => useApprovalQueue());
    expect(result.current.queueSectionProps.isLoading).toBe(true);
    expect(result.current.queueSectionProps.data).toEqual([]);
    expect(result.current.showQueueEmptyState).toBe(false);
  });

  it('empty: showQueueEmptyState=true when result is empty and no filters/search', async () => {
    setupListMock({ items: [], total: 0 });
    const { result } = renderHookWithProviders(() => useApprovalQueue());
    await waitFor(() => expect(result.current.queueSectionProps.isLoading).toBe(false));
    expect(result.current.showQueueEmptyState).toBe(true);
    expect(result.current.queueSectionProps.data).toEqual([]);
    expect(result.current.queueSectionProps.totalRows).toBe(0);
  });

  it('error: list query throws → isLoading resolves to false, data stays empty', async () => {
    setTRPCMock({
      'approval.listPending': () => {
        throw new Error('boom');
      },
      'settings.listChangeRequests': () => [],
    });
    const { result } = renderHookWithProviders(() => useApprovalQueue());
    await waitFor(() => expect(result.current.queueSectionProps.isLoading).toBe(false));
    expect(result.current.queueSectionProps.data).toEqual([]);
    expect(result.current.queueSectionProps.totalRows).toBe(0);
  });

  it('success: forwards items + totalRows + pageCount on the queueSectionProps bag', async () => {
    const items = [
      {
        id: 's1',
        stepOrder: 1,
        name: 'L1',
        status: 'PENDING',
        approverUserId: null,
        approverRole: null,
        slaDeadline: null,
        createdAt: '2026-01-01T00:00:00Z',
        approvalFlow: {
          id: 'f1',
          resourceId: 'r1',
          resourceType: 'INVOICE',
          status: 'IN_PROGRESS',
          startedAt: '2026-01-01T00:00:00Z',
          chainConfigId: null,
        },
        approver: null,
        invoice: null,
        slaStatus: null,
      },
    ];
    setupListMock({ items, total: 23 });
    const { result } = renderHookWithProviders(() => useApprovalQueue());
    await waitFor(() => expect(result.current.queueSectionProps.isLoading).toBe(false));
    expect(result.current.queueSectionProps.data).toHaveLength(1);
    expect(result.current.queueSectionProps.totalRows).toBe(23);
    // default pageSize=10 → ceil(23/10)=3
    expect(result.current.queueSectionProps.pageCount).toBe(3);
    expect(result.current.showQueueEmptyState).toBe(false);
  });
});

describe('useApprovalQueue — admin / change requests', () => {
  it('non-admin: changeRequests query is disabled, isAdmin=false, pendingCount=0', async () => {
    canMock.mockReturnValue(false);
    setupListMock({ items: [], total: 0 });
    const handler = vi.fn();
    setTRPCMock({
      'approval.listPending': () => ({ items: [], total: 0 }),
      'settings.listChangeRequests': handler,
      'approval.getChain': () => undefined,
    });
    const { result } = renderHookWithProviders(() => useApprovalQueue());
    await waitFor(() => expect(result.current.queueSectionProps.isLoading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.pendingCount).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it('admin: surfaces changeRequests + pendingCount + loading flag', async () => {
    canMock.mockReturnValue(true);
    setTRPCMock({
      'approval.listPending': () => ({ items: [], total: 0 }),
      'settings.listChangeRequests': () => [
        {
          id: 'cr1',
          contractorName: 'X',
          contractorEmail: 'x@y.com',
          requestedChanges: {},
          previousValues: {},
          createdAt: '2026-01-01T00:00:00Z',
          status: 'PENDING',
        },
      ],
      'approval.getChain': () => undefined,
    });
    const { result } = renderHookWithProviders(() => useApprovalQueue());
    await waitFor(() => expect(result.current.changeRequestsLoading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.pendingCount).toBe(1);
    expect(result.current.changeRequests).toHaveLength(1);
  });
});

describe('useApprovalQueue — handlers', () => {
  it('onSearchChange resets pagination back to page 1', async () => {
    setupListMock({ items: [], total: 0 });
    const { result } = renderHookWithProviders(() => useApprovalQueue());
    await waitFor(() => expect(result.current.queueSectionProps.isLoading).toBe(false));

    act(() => {
      void result.current.queueSectionProps.onPageChange(3);
    });
    await waitFor(() => expect(result.current.queueSectionProps.page).toBe(3));

    act(() => {
      void result.current.queueSectionProps.onSearchChange('acme');
    });
    await waitFor(() => expect(result.current.queueSectionProps.search).toBe('acme'));
    expect(result.current.queueSectionProps.page).toBe(1);
  });

  it('onStatusChange replaces filters and resets to page 1', async () => {
    setupListMock({ items: [], total: 0 });
    const { result } = renderHookWithProviders(() => useApprovalQueue());
    await waitFor(() => expect(result.current.queueSectionProps.isLoading).toBe(false));

    act(() => {
      void result.current.queueSectionProps.onStatusChange(['PENDING', 'OVERDUE']);
    });
    await waitFor(() =>
      expect(result.current.queueSectionProps.statuses).toEqual(['PENDING', 'OVERDUE']),
    );
    expect(result.current.queueSectionProps.page).toBe(1);
  });

  it('onClearFilters wipes statuses + search', async () => {
    setupListMock({ items: [], total: 0 });
    const { result } = renderHookWithProviders(() => useApprovalQueue());
    await waitFor(() => expect(result.current.queueSectionProps.isLoading).toBe(false));

    act(() => {
      void result.current.queueSectionProps.onStatusChange(['PENDING']);
      void result.current.queueSectionProps.onSearchChange('q');
    });
    await waitFor(() => expect(result.current.queueSectionProps.search).toBe('q'));

    act(() => {
      result.current.queueSectionProps.onClearFilters();
    });
    await waitFor(() => expect(result.current.queueSectionProps.statuses).toEqual([]));
    expect(result.current.queueSectionProps.search).toBe('');
  });

  it('onRowClick opens the side panel with the selected row', async () => {
    const row = {
      id: 's1',
      stepOrder: 1,
      name: 'L1',
      status: 'PENDING',
      approverUserId: null,
      approverRole: null,
      slaDeadline: null,
      createdAt: '2026-01-01T00:00:00Z',
      approvalFlow: {
        id: 'f1',
        resourceId: 'r1',
        resourceType: 'INVOICE',
        status: 'IN_PROGRESS',
        startedAt: '2026-01-01T00:00:00Z',
        chainConfigId: null,
      },
      approver: null,
      invoice: null,
      slaStatus: null,
    };
    setupListMock({ items: [row], total: 1 });
    const { result } = renderHookWithProviders(() => useApprovalQueue());
    await waitFor(() => expect(result.current.queueSectionProps.isLoading).toBe(false));

    act(() => {
      result.current.queueSectionProps.onRowClick(
        // biome-ignore lint/suspicious/noExplicitAny: test row shape mirrors generated columns
        row as any,
      );
    });
    expect(result.current.sidePanelProps.open).toBe(true);
    expect(result.current.sidePanelProps.step?.id).toBe('s1');
  });
});

describe('useApprovalQueue — mutations', () => {
  it('approve column callback: invokes mutation, toast.success + list invalidate', async () => {
    const approveSpy = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'approval.listPending': () => ({ items: [], total: 0 }),
      'settings.listChangeRequests': () => [],
      'approval.approve': approveSpy,
      'approval.reject': vi.fn(),
      'approval.bulkApprove': vi.fn(),
      'approval.bulkReject': vi.fn(),
      'approval.getChain': () => undefined,
    });
    const { result, queryClient } = renderHookWithProviders(() => useApprovalQueue());
    await waitFor(() => expect(result.current.queueSectionProps.isLoading).toBe(false));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      capturedColumnCallbacks.current.onApprove?.('step-1');
    });

    await waitFor(() => expect(approveSpy).toHaveBeenCalledWith({ stepId: 'step-1' }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastSuccess.mock.calls[0]?.[0]).toContain('toast.approved');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [['approval', 'listPending']] });
  });

  it('approve error path: toast.error fires, no invalidation', async () => {
    setTRPCMock({
      'approval.listPending': () => ({ items: [], total: 0 }),
      'settings.listChangeRequests': () => [],
      'approval.approve': () => {
        throw new Error('boom');
      },
      'approval.reject': vi.fn(),
      'approval.bulkApprove': vi.fn(),
      'approval.bulkReject': vi.fn(),
      'approval.getChain': () => undefined,
    });
    const { result } = renderHookWithProviders(() => useApprovalQueue());
    await waitFor(() => expect(result.current.queueSectionProps.isLoading).toBe(false));

    act(() => {
      capturedColumnCallbacks.current.onApprove?.('step-1');
    });

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError.mock.calls[0]?.[0]).toContain('errors.failedToApprove');
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('reject column callback: forwards comment, toast.success + invalidate', async () => {
    const rejectSpy = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'approval.listPending': () => ({ items: [], total: 0 }),
      'settings.listChangeRequests': () => [],
      'approval.approve': vi.fn(),
      'approval.reject': rejectSpy,
      'approval.bulkApprove': vi.fn(),
      'approval.bulkReject': vi.fn(),
      'approval.getChain': () => undefined,
    });
    const { result, queryClient } = renderHookWithProviders(() => useApprovalQueue());
    await waitFor(() => expect(result.current.queueSectionProps.isLoading).toBe(false));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      capturedColumnCallbacks.current.onReject?.('step-1', 'needs more info');
    });

    await waitFor(() =>
      expect(rejectSpy).toHaveBeenCalledWith({ stepId: 'step-1', comment: 'needs more info' }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastSuccess.mock.calls[0]?.[0]).toContain('toast.rejected');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [['approval', 'listPending']] });
  });
});
