/**
 * Step 10 port of apps/web/src/components/notifications/__tests__/notification-popover.test.tsx.
 *
 * `NotificationPopoverShell` is presentational — it renders the bell
 * trigger, badge, popover chrome, and slots a variant body via children.
 * Variant selection (skeletons / empty / list) lives in the container; the
 * view test only verifies the always-present shell pieces (badge wiring,
 * aria) by mounting the shell with an arbitrary children placeholder.
 *
 * Wrapped in `<MemoryRouter>` because the `<Bell>` button is rendered
 * through `react-router-dom`-aware children deeper in the tree (and
 * keeps parity with the apps/web setup).
 */

import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NotificationPopoverShellProps } from '../notification-popover.js';
import { NotificationPopoverShell } from '../notification-popover.js';
import { mount } from './_render.js';

function withRouter(node: ReactElement): ReactElement {
  return <MemoryRouter initialEntries={['/en/dashboard']}>{node}</MemoryRouter>;
}

function baseShellProps(
  overrides: Partial<NotificationPopoverShellProps> = {},
): NotificationPopoverShellProps {
  return {
    unreadCount: 0,
    isMarkingAllRead: false,
    onOpenChange: vi.fn(),
    onMarkAllRead: vi.fn(),
    children: <div data-testid="popover-body">body</div>,
    ...overrides,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('NotificationPopoverShell (web-vite)', () => {
  it('renders the bell trigger button with no badge when unreadCount is 0', async () => {
    const { container } = await mount(
      withRouter(<NotificationPopoverShell {...baseShellProps({ unreadCount: 0 })} />),
    );
    const trigger = container.querySelector('button');
    expect(trigger).not.toBeNull();
    // Badge span is conditional — should NOT be present at 0.
    expect(container.querySelector('span.bg-destructive')).toBeNull();
  });

  it('renders an unread badge with the count when unreadCount > 0', async () => {
    const { container } = await mount(
      withRouter(<NotificationPopoverShell {...baseShellProps({ unreadCount: 7 })} />),
    );
    const badge = container.querySelector('span.bg-destructive');
    expect(badge).not.toBeNull();
    expect((badge?.textContent ?? '').trim()).toBe('7');
  });

  it('caps the badge text at "99+" when unreadCount exceeds 99', async () => {
    const { container } = await mount(
      withRouter(<NotificationPopoverShell {...baseShellProps({ unreadCount: 150 })} />),
    );
    const badge = container.querySelector('span.bg-destructive');
    expect((badge?.textContent ?? '').trim()).toBe('99+');
  });

  it('marks the trigger with a polite aria-live region for the badge', async () => {
    const { container } = await mount(
      withRouter(<NotificationPopoverShell {...baseShellProps({ unreadCount: 3 })} />),
    );
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live?.getAttribute('aria-atomic')).toBe('true');
  });

  it('keeps the popover body unmounted while the popover trigger is collapsed', async () => {
    const { container } = await mount(
      withRouter(
        <NotificationPopoverShell {...baseShellProps({ unreadCount: 1 })}>
          <div data-testid="popover-body">body content</div>
        </NotificationPopoverShell>,
      ),
    );
    // PopoverContent only renders into the DOM when opened — the child
    // body must not leak into the closed trigger tree.
    expect(container.querySelector('[data-testid="popover-body"]')).toBeNull();
  });
});
