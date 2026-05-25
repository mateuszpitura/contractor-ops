/**
 * Hook spec for `useNotificationCenter` — drives the /notifications page.
 * Covers loading/empty/success branches plus filter, unread-only toggle,
 * pagination handlers, mark-read on click, and mark-all-read mutation
 * success/error toasts. tRPC, nuqs, sonner, router mocked → no network.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const routerMock = { push: vi.fn(), replace: vi.fn() };
vi.mock('../../../../i18n/navigation.js', () => ({
  useRouter: () => routerMock,
}));

vi.mock('../../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string) => key,
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
import type { NotificationData } from '../../notification-item.js';
import { useNotificationCenter } from '../use-notification-center.js';

const trpcProxy = createTRPCProxy();

function notif(overrides: Partial<NotificationData> = {}): NotificationData {
  return {
    id: 'notif-1',
    type: 'APPROVAL_REQUEST',
    title: 'New approval request',
    body: 'Invoice #1234 needs your approval',
    entityType: 'INVOICE',
    entityId: 'inv-1',
    status: 'UNREAD',
    readAt: null,
    createdAt: '2026-04-04T11:59:30Z',
    ...overrides,
  };
}

describe('useNotificationCenter', () => {
  it('loading state: isLoading=true while list query is pending', () => {
    setTRPCMock({
      'notification.list': () => new Promise<never>(() => undefined),
      'notification.unreadCount': () => new Promise<never>(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useNotificationCenter());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.notifications).toEqual([]);
  });

  it('empty state: list resolves to zero items → isEmpty=true', async () => {
    setTRPCMock({
      'notification.list': () => ({ items: [], total: 0, page: 1, totalPages: 1 }),
      'notification.unreadCount': () => ({ count: 0 }),
    });
    const { result } = renderHookWithProviders(() => useNotificationCenter());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.notifications).toEqual([]);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.unreadCount).toBe(0);
  });

  it('success state: surfaces items, totalPages, unreadCount', async () => {
    const items = [notif(), notif({ id: 'notif-2', title: 'Task overdue', type: 'TASK_OVERDUE' })];
    setTRPCMock({
      'notification.list': () => ({ items, total: 25, page: 1, totalPages: 3 }),
      'notification.unreadCount': () => ({ count: 7 }),
    });
    const { result } = renderHookWithProviders(() => useNotificationCenter());
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    expect(result.current.totalPages).toBe(3);
    expect(result.current.unreadCount).toBe(7);
    expect(result.current.isEmpty).toBe(false);
  });

  it('handleFilterChange resets page to 1 and updates typeFilter', async () => {
    setTRPCMock({
      'notification.list': () => ({ items: [], total: 0, page: 1, totalPages: 1 }),
      'notification.unreadCount': () => ({ count: 0 }),
    });
    const { result } = renderHookWithProviders(() => useNotificationCenter());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleFilterChange('approvals');
    });
    await waitFor(() => expect(result.current.typeFilter).toBe('approvals'));
    expect(result.current.page).toBe(1);
  });

  it('handleUnreadToggle: true sets "true", false clears the param', async () => {
    setTRPCMock({
      'notification.list': () => ({ items: [], total: 0, page: 1, totalPages: 1 }),
      'notification.unreadCount': () => ({ count: 0 }),
    });
    const { result } = renderHookWithProviders(() => useNotificationCenter());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleUnreadToggle(true);
    });
    await waitFor(() => expect(result.current.unreadOnly).toBe('true'));

    act(() => {
      result.current.handleUnreadToggle(false);
    });
    await waitFor(() => expect(result.current.unreadOnly).toBe(''));
  });

  it('handleNextPage / handlePreviousPage move the page state', async () => {
    setTRPCMock({
      'notification.list': () => ({ items: [], total: 30, page: 1, totalPages: 3 }),
      'notification.unreadCount': () => ({ count: 0 }),
    });
    const { result } = renderHookWithProviders(() => useNotificationCenter());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.handleNextPage());
    await waitFor(() => expect(result.current.page).toBe(2));

    act(() => result.current.handlePreviousPage());
    await waitFor(() => expect(result.current.page).toBe(1));
  });

  it('handleItemClick on unread fires markRead mutation and pushes the entity URL', async () => {
    const markReadSpy = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'notification.list': () => ({ items: [notif()], total: 1, page: 1, totalPages: 1 }),
      'notification.unreadCount': () => ({ count: 1 }),
      'notification.markRead': markReadSpy,
    });
    routerMock.push.mockReset();
    const { result } = renderHookWithProviders(() => useNotificationCenter());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    act(() => {
      result.current.handleItemClick(result.current.notifications[0]!);
    });
    await waitFor(() => expect(markReadSpy).toHaveBeenCalledWith({ notificationId: 'notif-1' }));
    expect(routerMock.push).toHaveBeenCalledWith('/invoices/inv-1');
  });

  it('handleItemClick on read notif navigates without firing markRead', async () => {
    const markReadSpy = vi.fn();
    setTRPCMock({
      'notification.list': () => ({
        items: [notif({ readAt: '2026-04-04T10:00:00Z' })],
        total: 1,
        page: 1,
        totalPages: 1,
      }),
      'notification.unreadCount': () => ({ count: 0 }),
      'notification.markRead': markReadSpy,
    });
    routerMock.push.mockReset();
    const { result } = renderHookWithProviders(() => useNotificationCenter());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    act(() => {
      result.current.handleItemClick(result.current.notifications[0]!);
    });
    expect(markReadSpy).not.toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith('/invoices/inv-1');
  });

  it('handleMarkAllRead: success path emits success toast', async () => {
    toastSuccess.mockReset();
    setTRPCMock({
      'notification.list': () => ({ items: [], total: 0, page: 1, totalPages: 1 }),
      'notification.unreadCount': () => ({ count: 2 }),
      'notification.markAllRead': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => useNotificationCenter());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.handleMarkAllRead());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastSuccess.mock.calls[0]?.[0]).toBe('markedAllRead');
  });

  it('handleMarkAllRead: failure path emits error toast with i18n key', async () => {
    toastError.mockReset();
    setTRPCMock({
      'notification.list': () => ({ items: [], total: 0, page: 1, totalPages: 1 }),
      'notification.unreadCount': () => ({ count: 2 }),
      'notification.markAllRead': () => {
        throw new Error('forbidden');
      },
    });
    const { result } = renderHookWithProviders(() => useNotificationCenter());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.handleMarkAllRead());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toBe('errors.failedToMarkRead');
  });
});
