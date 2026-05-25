/**
 * Ported from apps/web/src/components/portal/__tests__/portal-settings-page.test.tsx.
 *
 * Web-vite split: PortalSettingsPage is the loaded-state-only view; the
 * container (PortalSettingsContainer) owns the isPending branch and renders
 * PortalSettingsSkeleton vs PortalSettingsPage. ProfileSection + the
 * notification prefs container are mocked so the test stays focused on
 * routing.
 */

vi.mock('../profile-section', () => ({
  ProfileSection: ({ title }: { title: string }) => (
    <div data-testid="profile-section">{title}</div>
  ),
}));

vi.mock('../notification-preferences-section-container', () => ({
  NotificationPreferencesSectionContainer: () => <div data-testid="notif-prefs-container" />,
}));

import { render, screen } from '@/test/test-utils';
import type { usePortalSettingsPage } from '../hooks/use-portal-settings-page.js';
import {
  PortalSettingsHeader,
  PortalSettingsPage,
  PortalSettingsSkeleton,
} from '../portal-settings-page';

type Settings = ReturnType<typeof usePortalSettingsPage>;

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    isPending: false,
    personalFields: [],
    financialFields: [],
    pendingChangeRequest: null,
    onContactSave: vi.fn(),
    onFinancialSave: vi.fn(),
    ...overrides,
  } as unknown as Settings;
}

describe('PortalSettingsPage', () => {
  it('renders the settings title and subtitle via the header', () => {
    render(<PortalSettingsHeader />);
    // Resolved against the live EN bundle
    expect(screen.getByText(/Settings|settings\.title/i)).toBeInTheDocument();
  });

  it('renders skeleton placeholders from PortalSettingsSkeleton', () => {
    const { container } = render(<PortalSettingsSkeleton />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders both ProfileSection panels and the notification prefs container when loaded', () => {
    render(<PortalSettingsPage settings={makeSettings()} />);
    expect(screen.getAllByTestId('profile-section')).toHaveLength(2);
    expect(screen.getByTestId('notif-prefs-container')).toBeInTheDocument();
  });
});
