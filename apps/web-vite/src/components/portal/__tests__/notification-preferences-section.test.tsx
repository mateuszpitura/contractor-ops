/**
 * Container/component split: the section accepts the
 * `useNotificationPreferencesSection` hook return as a `prefs` prop, so
 * the test injects a shaped stub instead of mocking tRPC mutations.
 */

import { render, screen, setup } from '@/test/test-utils';
import type { useNotificationPreferencesSection } from '../hooks/use-notification-preferences-section.js';
import {
  NotificationPreferencesSection,
  NotificationPreferencesSkeleton,
} from '../notification-preferences-section';

type Prefs = ReturnType<typeof useNotificationPreferencesSection>;

function makePrefs(overrides: Partial<Prefs> = {}): Prefs {
  return {
    isPending: false,
    getChecked: () => true,
    handleToggle: vi.fn(),
    ...overrides,
  } as unknown as Prefs;
}

describe('NotificationPreferencesSection', () => {
  it('renders the section heading button', () => {
    render(<NotificationPreferencesSection prefs={makePrefs()} />);
    // Section heading is also localized text; the button surface is the toggle
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders skeleton rows from NotificationPreferencesSkeleton', () => {
    const { container } = render(<NotificationPreferencesSkeleton />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders all category labels when loaded', () => {
    render(<NotificationPreferencesSection prefs={makePrefs()} />);
    expect(screen.getAllByText(/Invoice/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Payment/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Contract/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Document/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Security/i).length).toBeGreaterThan(0);
  });

  it('invokes handleToggle with the category key and new value when a switch is toggled', async () => {
    const handleToggle = vi.fn();
    const { user, container } = setup(
      <NotificationPreferencesSection prefs={makePrefs({ handleToggle })} />,
    );
    // First non-locked switch corresponds to INVOICE_UPDATES
    const switches = container.querySelectorAll('[role="switch"]');
    expect(switches.length).toBeGreaterThan(0);
    const firstSwitch = switches[0] as HTMLElement;
    await user.click(firstSwitch);
    expect(handleToggle).toHaveBeenCalledWith('INVOICE_UPDATES', expect.any(Boolean));
  });

  it('renders the security-locked switch as disabled', () => {
    const { container } = render(<NotificationPreferencesSection prefs={makePrefs()} />);
    const switches = Array.from(container.querySelectorAll('[role="switch"]'));
    // The locked security switch is the last one
    const securitySwitch = switches[switches.length - 1] as HTMLElement;
    expect(
      securitySwitch.getAttribute('aria-disabled') === 'true' ||
        (securitySwitch as HTMLButtonElement).disabled,
    ).toBeTruthy();
  });
});
