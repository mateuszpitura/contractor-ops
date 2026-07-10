/**
 * OktaProviderSectionView render + toggle-gate tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen, setup } from '@/test/test-utils';
import type { OktaProviderSectionViewProps } from '../okta-provider-section';
import { OktaProviderSectionView } from '../okta-provider-section';

const t = ((key: string): string => {
  const messages: Record<string, string> = {
    title: 'Okta Deprovisioning',
    description: 'Deactivate users and revoke all sessions in Okta.',
    flagApproved: 'Sign-off approved',
    flagPending: 'Pending sign-off',
    enableLabel: 'Enable Okta deprovisioning for this organization',
    enableDisabledTooltip: 'Enable is available once compliance sign-off is approved.',
    toggleAria: 'Enable Okta deprovisioning',
  };
  return messages[key] ?? key;
}) as TranslateFn;

function buildProps(overrides: Partial<OktaProviderSectionViewProps> = {}) {
  return {
    flagApproved: false,
    enabled: false,
    isToggling: false,
    onToggle: vi.fn(),
    t,
    ...overrides,
  } satisfies OktaProviderSectionViewProps;
}

describe('OktaProviderSectionView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the Okta title', () => {
    render(<OktaProviderSectionView {...buildProps()} />);
    expect(screen.getByText('Okta Deprovisioning')).toBeInTheDocument();
  });

  it('disables the switch when the flag is not approved', () => {
    render(<OktaProviderSectionView {...buildProps({ flagApproved: false })} />);
    expect(screen.getByRole('switch').getAttribute('aria-disabled')).toBe('true');
  });

  it('enables and toggles when approved', async () => {
    const onToggle = vi.fn();
    const { user } = setup(
      <OktaProviderSectionView {...buildProps({ flagApproved: true, onToggle })} />,
    );
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-label', 'Enable Okta deprovisioning');
    expect(sw.getAttribute('aria-disabled')).not.toBe('true');
    await user.click(sw);
    expect(onToggle).toHaveBeenCalledWith(true, expect.anything());
  });
});
