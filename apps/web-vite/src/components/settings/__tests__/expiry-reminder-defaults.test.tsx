/**
 * Container/component split — the component is pure presentational and
 * receives `t`, `inputValue`, `setInputValue`, `isDirty`, `isPending`,
 * `handleSave` from its hook. Tests inject a shaped stub directly so no
 * tRPC or react-query mocking is required.
 *
 * Stub `t` returns the i18n key (legacy "mock-i18n" style) so the test is
 * independent of translation copy churn.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import { ExpiryReminderDefaultsView } from '../expiry-reminder-defaults';
import type { useExpiryReminderDefaults } from '../hooks/use-expiry-reminder-defaults';

type HookReturn = ReturnType<typeof useExpiryReminderDefaults>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    id: 'rem-defaults',
    t: tStub,
    inputValue: '30, 60, 90',
    setInputValue: vi.fn(),
    isDirty: false,
    isPending: false,
    handleSave: vi.fn(),
    ...overrides,
  } as HookReturn;
}

describe('ExpiryReminderDefaultsView', () => {
  it('renders the heading, label and save button', () => {
    render(<ExpiryReminderDefaultsView {...buildHook()} />);
    expect(screen.getByText('expiryReminders.heading')).toBeInTheDocument();
    expect(screen.getByLabelText('expiryReminders.label')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders the placeholder forwarded from the hook translations', () => {
    render(<ExpiryReminderDefaultsView {...buildHook()} />);
    const input = screen.getByLabelText('expiryReminders.label');
    expect(input.getAttribute('placeholder')).toBe('expiryReminders.placeholder');
  });

  it('reflects the inputValue prop in the controlled input', () => {
    render(<ExpiryReminderDefaultsView {...buildHook({ inputValue: '14, 30' })} />);
    const input = screen.getByLabelText('expiryReminders.label') as HTMLInputElement;
    expect(input.value).toBe('14, 30');
  });

  it('disables the save button when not dirty', () => {
    render(<ExpiryReminderDefaultsView {...buildHook({ isDirty: false })} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('enables the save button when dirty and not pending', () => {
    render(<ExpiryReminderDefaultsView {...buildHook({ isDirty: true })} />);
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('shows a loading spinner and disables save while pending', () => {
    const { container } = render(
      <ExpiryReminderDefaultsView {...buildHook({ isDirty: true, isPending: true })} />,
    );
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls setInputValue when the user types', async () => {
    const setInputValue = vi.fn();
    const { user } = setup(
      <ExpiryReminderDefaultsView {...buildHook({ inputValue: '', setInputValue })} />,
    );
    const input = screen.getByLabelText('expiryReminders.label');
    await user.type(input, '7');
    expect(setInputValue).toHaveBeenCalledWith('7');
  });

  it('calls handleSave when the save button is clicked', async () => {
    const handleSave = vi.fn();
    const { user } = setup(
      <ExpiryReminderDefaultsView {...buildHook({ isDirty: true, handleSave })} />,
    );
    await user.click(screen.getByRole('button'));
    expect(handleSave).toHaveBeenCalledTimes(1);
  });
});
