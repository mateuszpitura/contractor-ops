/**
 * NotificationItem is pure presentational — the mark-read/mutation
 * boundary lives in the container — so we exercise visual + click logic
 * directly with the local `_render.tsx` helpers and need no i18n mocks
 * (the component renders raw `notification.title`/`body` from props).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationData } from '../notification-item.js';
import { getEntityUrl, NotificationItem } from '../notification-item.js';
import { click, findButton, findByText, mount } from './_render.js';

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

describe('NotificationItem (web-vite)', () => {
  beforeEach(() => {
    // Pin "now" so relativeTime() output is stable across machines/CI.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-04T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders title and body', async () => {
    await mount(<NotificationItem notification={makeNotification()} onClick={vi.fn()} />);
    expect(findByText(document.body, 'New approval request')).not.toBeNull();
    expect(findByText(document.body, 'Invoice #1234 needs your approval')).not.toBeNull();
  });

  it('shows unread dot when readAt is null', async () => {
    const { container } = await mount(
      <NotificationItem notification={makeNotification({ readAt: null })} onClick={vi.fn()} />,
    );
    expect(container.querySelector('.rounded-full.bg-primary')).not.toBeNull();
  });

  it('does not show unread dot when readAt is set', async () => {
    const { container } = await mount(
      <NotificationItem
        notification={makeNotification({ readAt: '2026-04-04T10:00:00Z' })}
        onClick={vi.fn()}
      />,
    );
    expect(container.querySelector('.rounded-full.bg-primary')).toBeNull();
  });

  it('applies bg-muted class for unread notifications', async () => {
    const { container } = await mount(
      <NotificationItem notification={makeNotification()} onClick={vi.fn()} />,
    );
    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-muted');
  });

  it('applies bg-transparent for read notifications (not bg-muted)', async () => {
    const { container } = await mount(
      <NotificationItem
        notification={makeNotification({ readAt: '2026-04-04T10:00:00Z' })}
        onClick={vi.fn()}
      />,
    );
    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-transparent');
    expect(button?.className).not.toContain('bg-muted');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const { container } = await mount(
      <NotificationItem notification={makeNotification()} onClick={onClick} />,
    );
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows "now" for <60 seconds ago', async () => {
    await mount(
      <NotificationItem
        notification={makeNotification({ createdAt: '2026-04-04T11:59:30Z' })}
        onClick={vi.fn()}
      />,
    );
    expect(findByText(document.body, 'now')).not.toBeNull();
  });

  it('shows "5m ago" for 5 minutes ago', async () => {
    await mount(
      <NotificationItem
        notification={makeNotification({ createdAt: '2026-04-04T11:55:00Z' })}
        onClick={vi.fn()}
      />,
    );
    expect(findByText(document.body, '5m ago')).not.toBeNull();
  });

  it('shows "3h ago" for 3 hours ago', async () => {
    await mount(
      <NotificationItem
        notification={makeNotification({ createdAt: '2026-04-04T09:00:00Z' })}
        onClick={vi.fn()}
      />,
    );
    expect(findByText(document.body, '3h ago')).not.toBeNull();
  });

  it('shows "2d ago" for 2 days ago', async () => {
    await mount(
      <NotificationItem
        notification={makeNotification({ createdAt: '2026-04-02T12:00:00Z' })}
        onClick={vi.fn()}
      />,
    );
    expect(findByText(document.body, '2d ago')).not.toBeNull();
  });

  it('applies smaller padding in compact mode', async () => {
    await mount(<NotificationItem notification={makeNotification()} onClick={vi.fn()} compact />);
    const btn = findButton(document.body);
    expect(btn?.className).toContain('px-3');
    expect(btn?.className).toContain('py-2');
  });
});

describe('getEntityUrl (web-vite)', () => {
  it('returns /invoices/{id} for INVOICE', () => {
    expect(getEntityUrl('INVOICE', 'inv-1')).toBe('/invoices/inv-1');
  });

  it('returns /contracts/{id} for CONTRACT', () => {
    expect(getEntityUrl('CONTRACT', 'c-1')).toBe('/contracts/c-1');
  });

  it('returns /contractors/{id} for CONTRACTOR', () => {
    expect(getEntityUrl('CONTRACTOR', 'ctr-1')).toBe('/contractors/ctr-1');
  });

  it('returns /workflows/{id} for WORKFLOW_RUN', () => {
    expect(getEntityUrl('WORKFLOW_RUN', 'wr-1')).toBe('/workflows/wr-1');
  });

  it('returns /workflows for WORKFLOW_TASK_RUN', () => {
    expect(getEntityUrl('WORKFLOW_TASK_RUN', 'wtr-1')).toBe('/workflows');
  });

  it('returns /settings for ORGANIZATION', () => {
    expect(getEntityUrl('ORGANIZATION', 'org-1')).toBe('/settings');
  });

  it('returns /notifications for null entityType', () => {
    expect(getEntityUrl(null, null)).toBe('/notifications');
  });

  it('returns /notifications for unknown entityType', () => {
    expect(getEntityUrl('UNKNOWN', 'x')).toBe('/notifications');
  });
});
