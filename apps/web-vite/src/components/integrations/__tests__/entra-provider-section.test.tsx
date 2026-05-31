/**
 * Phase 78 IDP-05 — EntraProviderSectionView render + toggle-gate tests. Props
 * are shaped directly; the hook (tRPC boundary) is not exercised here.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen, setup } from '@/test/test-utils';
import type { EntraProviderSectionViewProps } from '../entra-provider-section';
import { EntraProviderSectionView } from '../entra-provider-section';

const t = ((key: string): string => {
  const messages: Record<string, string> = {
    title: 'Microsoft Entra ID Deprovisioning',
    description: 'Disable accounts and revoke sign-in sessions.',
    flagApproved: 'Sign-off approved',
    flagPending: 'Pending sign-off',
    enableLabel: 'Enable Entra ID deprovisioning for this organization',
    enableDisabledTooltip: 'Enable is available once compliance sign-off is approved.',
    toggleAria: 'Enable Microsoft Entra ID deprovisioning',
    conditionalAccessTitle: 'Conditional Access policies',
    conditionalAccessBody: 'CA policies are surfaced as a non-blocking warning.',
    hybridAdTitle: 'On-prem AD authoritative — revoke at source',
    hybridAdBody: 'Hybrid-synced accounts are blocked.',
  };
  return messages[key] ?? key;
}) as TranslateFn;

function buildProps(overrides: Partial<EntraProviderSectionViewProps> = {}) {
  return {
    flagApproved: false,
    enabled: false,
    isToggling: false,
    onToggle: vi.fn(),
    t,
    ...overrides,
  } satisfies EntraProviderSectionViewProps;
}

describe('EntraProviderSectionView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the Entra title, hybrid-AD block, and CA warning', () => {
    render(<EntraProviderSectionView {...buildProps()} />);
    expect(screen.getByText('Microsoft Entra ID Deprovisioning')).toBeInTheDocument();
    expect(screen.getByText('On-prem AD authoritative — revoke at source')).toBeInTheDocument();
    expect(screen.getByText('Conditional Access policies')).toBeInTheDocument();
  });

  it('disables the enable switch and shows pending badge when flag not approved', () => {
    render(<EntraProviderSectionView {...buildProps({ flagApproved: false })} />);
    expect(screen.getByText('Pending sign-off')).toBeInTheDocument();
    // base-ui Switch reflects disabled via aria-disabled.
    expect(screen.getByRole('switch').getAttribute('aria-disabled')).toBe('true');
  });

  it('enables the switch when the flag is approved', () => {
    render(<EntraProviderSectionView {...buildProps({ flagApproved: true })} />);
    expect(screen.getByText('Sign-off approved')).toBeInTheDocument();
    expect(screen.getByRole('switch').getAttribute('aria-disabled')).not.toBe('true');
  });

  it('has an accessible label on the switch', () => {
    render(<EntraProviderSectionView {...buildProps({ flagApproved: true })} />);
    expect(screen.getByRole('switch')).toHaveAttribute(
      'aria-label',
      'Enable Microsoft Entra ID deprovisioning',
    );
  });

  it('calls onToggle when the approved switch is toggled', async () => {
    const onToggle = vi.fn();
    const { user } = setup(
      <EntraProviderSectionView {...buildProps({ flagApproved: true, onToggle })} />,
    );
    await user.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
