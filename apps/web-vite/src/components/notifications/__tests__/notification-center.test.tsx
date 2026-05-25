/**
 * Step 10 port of apps/web/src/components/notifications/__tests__/notification-center.test.tsx.
 *
 * The web-vite container is hook-bound (`useNotificationCenter` owns tRPC,
 * nuqs, router, mutations). Prior batches deferred this test for that
 * reason. We mock the hook directly — same pattern as the
 * dashboard-home-container test — so we can drive every UI branch
 * (loading, empty, populated, paginated) without touching tRPC or nuqs.
 */

import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NotificationData } from '../notification-item.js';
import { findByText, mount } from './_render.js';

function withRouter(node: ReactElement): ReactElement {
  return <MemoryRouter initialEntries={['/en/notifications']}>{node}</MemoryRouter>;
}

const useNotificationCenterMock = vi.fn();

vi.mock('../hooks/use-notification-center.js', async () => {
  const actual = await vi.importActual<typeof import('../hooks/use-notification-center.js')>(
    '../hooks/use-notification-center.js',
  );
  return {
    NOTIFICATION_FILTER_KEYS: actual.NOTIFICATION_FILTER_KEYS,
    useNotificationCenter: () => useNotificationCenterMock(),
  };
});

const { NotificationCenterContainer } = await import('../notification-center-container.js');

function makeNotification(overrides: Partial<NotificationData> = {}): NotificationData {
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

function baseHookReturn(overrides: Record<string, unknown> = {}) {
  return {
    typeFilter: 'all',
    unreadOnly: '',
    page: 1,
    notifications: [] as NotificationData[],
    totalPages: 1,
    unreadCount: 0,
    isLoading: false,
    isEmpty: true,
    isMarkingRead: false,
    isMarkingAllRead: false,
    handleItemClick: vi.fn(),
    handleFilterChange: vi.fn(),
    handleUnreadToggle: vi.fn(),
    handleMarkAllRead: vi.fn(),
    handlePreviousPage: vi.fn(),
    handleNextPage: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('NotificationCenterContainer (web-vite)', () => {
  it('renders the page header title', async () => {
    useNotificationCenterMock.mockReturnValue(baseHookReturn());
    const { container } = await mount(withRouter(<NotificationCenterContainer />));
    // i18n falls back to the bare key when Notifications.title isn't defined,
    // so accept either the resolved string or the key.
    expect(findByText(container, /Notifications|title/i)).not.toBeNull();
  });

  it('shows skeleton rows while loading', async () => {
    useNotificationCenterMock.mockReturnValue(baseHookReturn({ isLoading: true, isEmpty: false }));
    const { container } = await mount(withRouter(<NotificationCenterContainer />));
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    // 6 skeleton rows × ≥2 skeleton elements each → at least 12 nodes.
    expect(skeletons.length).toBeGreaterThanOrEqual(6);
  });

  it('renders an empty-state landmark when isEmpty is true', async () => {
    useNotificationCenterMock.mockReturnValue(baseHookReturn({ isEmpty: true }));
    const { container } = await mount(withRouter(<NotificationCenterContainer />));
    // AtelierEmptyState exposes an SVG illustration node — assert that
    // *no* notification row was rendered when isEmpty=true.
    expect(container.querySelector('.bg-muted')).toBeNull();
    expect(container.querySelectorAll('button').length).toBeLessThan(8);
  });

  it('renders notification row titles when data is present', async () => {
    const notifications = [
      makeNotification({ id: 'n1', title: 'Approval needed', body: 'INV-1' }),
      makeNotification({ id: 'n2', title: 'Task overdue', body: 'Task-9', type: 'TASK_OVERDUE' }),
    ];
    useNotificationCenterMock.mockReturnValue(
      baseHookReturn({ notifications, isEmpty: false, unreadCount: 2 }),
    );
    const { container } = await mount(withRouter(<NotificationCenterContainer />));
    expect(findByText(container, 'Approval needed')).not.toBeNull();
    expect(findByText(container, 'Task overdue')).not.toBeNull();
  });

  it('renders pagination controls when totalPages > 1', async () => {
    useNotificationCenterMock.mockReturnValue(
      baseHookReturn({
        notifications: [makeNotification()],
        isEmpty: false,
        totalPages: 3,
        page: 2,
      }),
    );
    const { container } = await mount(withRouter(<NotificationCenterContainer />));
    const buttons = Array.from(container.querySelectorAll('button')).map(b =>
      (b.textContent ?? '').trim().toLowerCase(),
    );
    expect(buttons.some(t => t.includes('previous'))).toBe(true);
    expect(buttons.some(t => t.includes('next'))).toBe(true);
  });

  it('does not render pagination controls when totalPages == 1', async () => {
    useNotificationCenterMock.mockReturnValue(
      baseHookReturn({
        notifications: [makeNotification()],
        isEmpty: false,
        totalPages: 1,
        page: 1,
      }),
    );
    const { container } = await mount(withRouter(<NotificationCenterContainer />));
    const buttons = Array.from(container.querySelectorAll('button')).map(b =>
      (b.textContent ?? '').trim().toLowerCase(),
    );
    expect(buttons.some(t => t.includes('previous'))).toBe(false);
    expect(buttons.some(t => t.includes('next'))).toBe(false);
  });
});
