/**
 * Hook spec for `useNotificationPopover` — top-bar bell dropdown. Covers
 * unread badge wiring, item-click mark-read mutation + router navigation,
 * "view all" navigation, mark-all-read success/error toasts, and open
 * handler invalidation. tRPC + nuqs + sonner + router are mocked so the
 * spec runs hermetic and <1s.
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
import { useNotificationPopover } from '../use-notification-popover.js';

const trpcProxy = createTRPCProxy();

function notif(overrides: Partial<NotificationData> = {}): NotificationData {
  return {
    id: 'notif-1',
    type: 'APPROVAL_REQUEST',
    title: 'Approval needed',
    body: 'Invoice #1234',
    entityType: 'INVOICE',
    entityId: 'inv-1',
    status: 'UNREAD',
    readAt: null,
    createdAt: '2026-04-04T11:59:30Z',
    ...overrides,
  };
}

describe('useNotificationPopover', () => {
  it('loading state: isLoading=true and unreadCount falls back to 0 before queries resolve', () => {
    setTRPCMock({
      'notification.unreadCount': () => new Promise<never>(() => undefined),
      'notification.list': () => new Promise<never>(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useNotificationPopover());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications).toEqual([]);
  });

  it('empty state: list resolves to no items', async () => {
    setTRPCMock({
      'notification.unreadCount': () => ({ count: 0 }),
      'notification.list': () => ({ items: [], total: 0, page: 1, totalPages: 1 }),
    });
    const { result } = renderHookWithProviders(() => useNotificationPopover());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('success state: surfaces unreadCount and list items from queries', async () => {
    const items = [notif(), notif({ id: 'notif-2', title: 'Another' })];
    setTRPCMock({
      'notification.unreadCount': () => ({ count: 5 }),
      'notification.list': () => ({ items, total: 2, page: 1, totalPages: 1 }),
    });
    const { result } = renderHookWithProviders(() => useNotificationPopover());
    await waitFor(() => expect(result.current.unreadCount).toBe(5));
    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.notifications[0]?.id).toBe('notif-1');
  });

  it('handleItemClick on an unread notif fires markRead mutation and navigates to the entity URL', async () => {
    const markReadSpy = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'notification.unreadCount': () => ({ count: 1 }),
      'notification.list': () => ({ items: [notif()], total: 1, page: 1, totalPages: 1 }),
      'notification.markRead': markReadSpy,
    });
    routerMock.push.mockReset();
    const { result } = renderHookWithProviders(() => useNotificationPopover());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    act(() => {
      result.current.handleItemClick(result.current.notifications[0]!);
    });

    await waitFor(() => expect(markReadSpy).toHaveBeenCalledWith({ notificationId: 'notif-1' }));
    expect(routerMock.push).toHaveBeenCalledWith('/invoices/inv-1');
  });

  it('handleItemClick on a read notif navigates without firing markRead', async () => {
    const markReadSpy = vi.fn();
    setTRPCMock({
      'notification.unreadCount': () => ({ count: 0 }),
      'notification.list': () => ({
        items: [notif({ readAt: '2026-04-04T10:00:00Z' })],
        total: 1,
        page: 1,
        totalPages: 1,
      }),
      'notification.markRead': markReadSpy,
    });
    routerMock.push.mockReset();
    const { result } = renderHookWithProviders(() => useNotificationPopover());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    act(() => {
      result.current.handleItemClick(result.current.notifications[0]!);
    });

    expect(markReadSpy).not.toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith('/invoices/inv-1');
  });

  it('handleViewAll routes to /notifications', async () => {
    setTRPCMock({
      'notification.unreadCount': () => ({ count: 0 }),
      'notification.list': () => ({ items: [], total: 0, page: 1, totalPages: 1 }),
    });
    routerMock.push.mockReset();
    const { result } = renderHookWithProviders(() => useNotificationPopover());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleViewAll();
    });
    expect(routerMock.push).toHaveBeenCalledWith('/notifications');
  });

  it('handleMarkAllRead: success path fires toast.success', async () => {
    toastSuccess.mockReset();
    setTRPCMock({
      'notification.unreadCount': () => ({ count: 3 }),
      'notification.list': () => ({ items: [], total: 0, page: 1, totalPages: 1 }),
      'notification.markAllRead': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => useNotificationPopover());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleMarkAllRead();
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('handleMarkAllRead: failure path fires toast.error with the i18n key', async () => {
    toastError.mockReset();
    setTRPCMock({
      'notification.unreadCount': () => ({ count: 3 }),
      'notification.list': () => ({ items: [], total: 0, page: 1, totalPages: 1 }),
      'notification.markAllRead': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useNotificationPopover());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleMarkAllRead();
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toBe('errors.failedToMarkRead');
  });

  it('handleOpenChange(true) triggers a list invalidation; (false) is a no-op', async () => {
    setTRPCMock({
      'notification.unreadCount': () => ({ count: 0 }),
      'notification.list': () => ({ items: [], total: 0, page: 1, totalPages: 1 }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useNotificationPopover());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => {
      result.current.handleOpenChange(false);
    });
    expect(spy).not.toHaveBeenCalled();

    act(() => {
      result.current.handleOpenChange(true);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: [['notification', 'list']] });
  });
});
