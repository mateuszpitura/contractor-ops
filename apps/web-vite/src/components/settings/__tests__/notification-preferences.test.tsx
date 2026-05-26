/**
 * Web-vite port of apps/web/src/components/settings/__tests__/notification-preferences.test.tsx.
 *
 * Component is presentational and receives `t`, `form`, `isLoading`,
 * `isSlackConnected`, `isTeamsConnected`, `onSubmit`, `isSavePending`
 * from `useNotificationPreferences`. Tests build a real `useForm`
 * instance inside a harness so Controller wiring is exercised end-to-end.
 */

import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { PreferenceFormValues } from '../hooks/use-notification-preferences';
import { NOTIFICATION_TYPES } from '../hooks/use-notification-preferences';
import {
  NotificationPreferences,
  NotificationPreferencesSkeleton,
} from '../notification-preferences';

const tStub = ((key: string) => key) as never;

interface HarnessProps {
  isSavePending?: boolean;
  isSlackConnected?: boolean;
  isTeamsConnected?: boolean;
  onSubmit?: (values: PreferenceFormValues) => void;
}

function Harness({
  isSavePending = false,
  isSlackConnected = false,
  isTeamsConnected = false,
  onSubmit = vi.fn(),
}: HarnessProps) {
  const form = useForm<PreferenceFormValues>({
    defaultValues: {
      preferences: NOTIFICATION_TYPES.map(type => ({
        notificationType: type,
        channelEmail: true,
        channelSlack: true,
        channelTeams: false,
      })),
    },
  });

  return (
    <NotificationPreferences
      t={tStub}
      form={form}
      isLoading={false}
      isSlackConnected={isSlackConnected}
      isTeamsConnected={isTeamsConnected}
      onSubmit={onSubmit}
      isSavePending={isSavePending}
    />
  );
}

describe('NotificationPreferences', () => {
  it('renders the loading skeletons via the Skeleton sibling export', () => {
    const { container } = render(<NotificationPreferencesSkeleton />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText('notifications.heading')).not.toBeInTheDocument();
  });

  it('renders the heading and one row per notification type once loaded', () => {
    render(<Harness />);

    expect(screen.getByText('notifications.heading')).toBeInTheDocument();
    expect(screen.getByText('notifications.columnEvent')).toBeInTheDocument();
    // Event labels come through `tDynLoose(t, 'notifications', config.labelKey)` →
    // `t('notifications.<key>')`; our stub returns the dotted key.
    expect(screen.getByText('notifications.eventApprovalRequest')).toBeInTheDocument();
    expect(screen.getByText('notifications.eventInvoiceReceived')).toBeInTheDocument();
  });

  it('marks Slack switches aria-disabled when Slack is not connected', () => {
    render(<Harness isSlackConnected={false} />);
    const slackSwitches = screen.getAllByRole('switch', { name: 'Slack' });
    for (const sw of slackSwitches) {
      expect(sw.getAttribute('aria-disabled')).toBe('true');
    }
  });

  it('makes Slack switches interactive when Slack is connected', () => {
    render(<Harness isSlackConnected />);
    const slackSwitches = screen.getAllByRole('switch', { name: 'Slack' });
    for (const sw of slackSwitches) {
      expect(sw.getAttribute('aria-disabled')).not.toBe('true');
    }
  });

  it('disables save button until the form is dirty', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /notifications\.savePreferences/i })).toBeDisabled();
  });

  it('renders the saving label / spinner while isSavePending', () => {
    render(<Harness isSavePending />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
    expect(screen.getByRole('button', { name: /notifications\.savePreferences/i })).toBeDisabled();
  });

  it('submits the current form values via onSubmit when save is clicked', async () => {
    const onSubmit = vi.fn();
    const { user } = setup(<Harness onSubmit={onSubmit} isSlackConnected />);

    // Flip the first email switch to mark the form dirty.
    const firstEmail = screen.getAllByRole('switch', { name: 'Email' })[0];
    expect(firstEmail).toBeDefined();
    await user.click(firstEmail as HTMLElement);

    const save = screen.getByRole('button', { name: /notifications\.savePreferences/i });
    expect(save).toBeEnabled();
    await user.click(save);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        preferences: expect.any(Array),
      }),
    );
  });
});
