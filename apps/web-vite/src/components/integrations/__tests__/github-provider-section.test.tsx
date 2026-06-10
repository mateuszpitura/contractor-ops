/**
 * GitHubProviderSectionView render + toggle-gate tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen, setup } from '@/test/test-utils';
import type { GitHubProviderSectionViewProps } from '../github-provider-section';
import { GitHubProviderSectionView } from '../github-provider-section';

const t = ((key: string): string => {
  const messages: Record<string, string> = {
    title: 'GitHub Deprovisioning',
    description: 'Remove organization members and revoke per-PAT credential authorizations.',
    flagApproved: 'Sign-off approved',
    flagPending: 'Pending sign-off',
    enableLabel: 'Enable GitHub deprovisioning for this organization',
    enableDisabledTooltip: 'Enable is available once compliance sign-off is approved.',
    toggleAria: 'Enable GitHub deprovisioning',
    outsideCollabTitle: 'Outside-collaborator access survives removal',
    outsideCollabBody: 'Removing a member does not revoke outside-collaborator repo access.',
  };
  return messages[key] ?? key;
}) as TranslateFn;

function buildProps(overrides: Partial<GitHubProviderSectionViewProps> = {}) {
  return {
    flagApproved: false,
    enabled: false,
    isToggling: false,
    onToggle: vi.fn(),
    t,
    ...overrides,
  } satisfies GitHubProviderSectionViewProps;
}

describe('GitHubProviderSectionView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the GitHub title and the outside-collaborator back-door note', () => {
    render(<GitHubProviderSectionView {...buildProps()} />);
    expect(screen.getByText('GitHub Deprovisioning')).toBeInTheDocument();
    expect(screen.getByText('Outside-collaborator access survives removal')).toBeInTheDocument();
  });

  it('disables the switch when the flag is not approved', () => {
    render(<GitHubProviderSectionView {...buildProps({ flagApproved: false })} />);
    expect(screen.getByRole('switch').getAttribute('aria-disabled')).toBe('true');
  });

  it('enables and toggles when approved', async () => {
    const onToggle = vi.fn();
    const { user } = setup(
      <GitHubProviderSectionView {...buildProps({ flagApproved: true, onToggle })} />,
    );
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-label', 'Enable GitHub deprovisioning');
    expect(sw.getAttribute('aria-disabled')).not.toBe('true');
    await user.click(sw);
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
