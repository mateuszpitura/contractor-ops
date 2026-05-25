/**
 * Step 10 port of apps/web/src/components/notifications/__tests__/notification-popover.test.tsx.
 *
 * `NotificationPopover` is presentational — it takes a single `popover`
 * prop that bundles state + handlers from `useNotificationPopover`. We
 * build a fake popover bundle per test (no hook execution, no tRPC,
 * no React Query), so we can drive each branch of the bell + dropdown
 * UI deterministically.
 *
 * Wrapped in `<MemoryRouter>` because the `<Bell>` button is rendered
 * through `react-router-dom`-aware children deeper in the tree (and
 * keeps parity with the apps/web setup).
 */

import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NotificationData } from '../notification-item.js';
import { NotificationPopover } from '../notification-popover.js';
import { findByText, mount } from './_render.js';

function withRouter(node: ReactElement): ReactElement {
  return <MemoryRouter initialEntries={['/en/dashboard']}>{node}</MemoryRouter>;
}

type PopoverProps = Parameters<typeof NotificationPopover>[0]['popover'];

function makeNotification(overrides: Partial<NotificationData> = {}): NotificationData {
  return {
    id: 'notif-1',
    type: 'APPROVAL_REQUEST',
    title: 'Approval needed',
    body: 'Invoice #1234',
    entityType: 'INVOICE',
    entityId: 'inv-1',
    status: 'UNREAD',
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function basePopover(overrides: Partial<PopoverProps> = {}): PopoverProps {
  return {
    unreadCount: 0,
    notifications: [] as NotificationData[],
    isLoading: false,
    isMarkingRead: false,
    isMarkingAllRead: false,
    handleItemClick: vi.fn(),
    handleOpenChange: vi.fn(),
    handleViewAll: vi.fn(),
    handleMarkAllRead: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('NotificationPopover (web-vite)', () => {
  it('renders the bell trigger button with no badge when unreadCount is 0', async () => {
    const { container } = await mount(
      withRouter(<NotificationPopover popover={basePopover({ unreadCount: 0 })} />),
    );
    const trigger = container.querySelector('button');
    expect(trigger).not.toBeNull();
    // Badge span is conditional — should NOT be present at 0.
    expect(container.querySelector('span.bg-destructive')).toBeNull();
  });

  it('renders an unread badge with the count when unreadCount > 0', async () => {
    const { container } = await mount(
      withRouter(<NotificationPopover popover={basePopover({ unreadCount: 7 })} />),
    );
    const badge = container.querySelector('span.bg-destructive');
    expect(badge).not.toBeNull();
    expect((badge?.textContent ?? '').trim()).toBe('7');
  });

  it('caps the badge text at "99+" when unreadCount exceeds 99', async () => {
    const { container } = await mount(
      withRouter(<NotificationPopover popover={basePopover({ unreadCount: 150 })} />),
    );
    const badge = container.querySelector('span.bg-destructive');
    expect((badge?.textContent ?? '').trim()).toBe('99+');
  });

  it('marks the trigger with a polite aria-live region for the badge', async () => {
    const { container } = await mount(
      withRouter(<NotificationPopover popover={basePopover({ unreadCount: 3 })} />),
    );
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live?.getAttribute('aria-atomic')).toBe('true');
  });

  it('does not show the empty/loading content while the popover is collapsed', async () => {
    const { container } = await mount(
      withRouter(
        <NotificationPopover
          popover={basePopover({
            notifications: [makeNotification()],
            unreadCount: 1,
          })}
        />,
      ),
    );
    // PopoverContent only renders into the DOM when opened — the
    // notification-row text must not leak into the closed trigger tree.
    expect(findByText(container, 'Approval needed')).toBeNull();
  });
});
