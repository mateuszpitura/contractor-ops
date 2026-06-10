/**
 * Tests target `TeamsProviderSectionView` with shaped props. Sibling
 * containers are stubbed; we verify rendering and the open-fallback button
 * branch.
 */

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen, setup } from '@/test/test-utils';
import type { TeamsProviderSectionViewProps } from '../teams-provider-section';
import { TeamsProviderSectionView } from '../teams-provider-section';

vi.mock('../../layout/feature-gate.js', () => ({
  FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../../settings/provider-connection-card.js', () => ({
  ProviderConnectionCard: ({
    displayName,
    description,
  }: {
    displayName: string;
    description: string;
  }) => (
    <div data-testid="provider-card">
      <span>{displayName}</span>
      <span>{description}</span>
    </div>
  ),
}));

vi.mock('../teams-channel-mapping-card.js', () => ({
  TeamsChannelMappingCard: () => <div data-testid="channel-mapping-card" />,
}));

vi.mock('../teams-fallback-approver-dialog.js', () => ({
  TeamsFallbackApproverDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="fallback-dialog" /> : null,
}));

interface BuildOpts {
  isConnected?: boolean;
  defaultTeamId?: string;
  defaultFallbackApproverId?: string | null;
  fallbackOpen?: boolean;
  setFallbackOpen?: Dispatch<SetStateAction<boolean>>;
  handleOpenFallback?: () => void;
}

function buildProps(overrides: BuildOpts = {}): TeamsProviderSectionViewProps {
  const {
    isConnected = false,
    defaultTeamId,
    defaultFallbackApproverId = null,
    fallbackOpen = false,
    setFallbackOpen = vi.fn(),
    handleOpenFallback = vi.fn(),
  } = overrides;

  const t = ((key: string): string => {
    const messages: Record<string, string> = {
      descriptionConnected:
        'Microsoft Teams connected — approvals and notifications will be delivered to your channels.',
      descriptionDisconnected: 'Connect Microsoft Teams to receive approval requests in channels.',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  const tFb = ((key: string): string => {
    const messages: Record<string, string> = {
      cardTitle: 'Fallback approver',
      cardBody: 'Choose who to notify in Teams when an approver is on vacation or not configured.',
      configureCta: 'Configure fallback approver',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  return {
    isConnected,
    needsReauth: false,
    defaultTeamId,
    defaultFallbackApproverId,
    fallbackOpen,
    setFallbackOpen,
    handleOpenFallback,
    t,
    tFb,
  };
}

describe('TeamsProviderSectionView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the provider card with the disconnected description', () => {
    render(<TeamsProviderSectionView {...buildProps({ isConnected: false })} />);
    expect(screen.getByTestId('provider-card')).toBeInTheDocument();
    expect(screen.getByText('Microsoft Teams')).toBeInTheDocument();
    expect(
      screen.getByText('Connect Microsoft Teams to receive approval requests in channels.'),
    ).toBeInTheDocument();
  });

  it('renders the connected description when connected', () => {
    render(<TeamsProviderSectionView {...buildProps({ isConnected: true })} />);
    expect(
      screen.getByText(
        'Microsoft Teams connected — approvals and notifications will be delivered to your channels.',
      ),
    ).toBeInTheDocument();
  });

  it('renders the channel mapping card only when connected', () => {
    const { rerender } = render(<TeamsProviderSectionView {...buildProps()} />);
    expect(screen.queryByTestId('channel-mapping-card')).not.toBeInTheDocument();

    rerender(<TeamsProviderSectionView {...buildProps({ isConnected: true })} />);
    expect(screen.getByTestId('channel-mapping-card')).toBeInTheDocument();
  });

  it('renders fallback approver card only when connected with a defaultTeamId', () => {
    render(<TeamsProviderSectionView {...buildProps({ isConnected: true })} />);
    expect(screen.queryByText('Fallback approver')).not.toBeInTheDocument();

    render(
      <TeamsProviderSectionView {...buildProps({ isConnected: true, defaultTeamId: 'team-1' })} />,
    );
    expect(screen.getByText('Fallback approver')).toBeInTheDocument();
  });

  it('calls handleOpenFallback when the configure button is clicked', async () => {
    const handleOpenFallback = vi.fn();
    const { user } = setup(
      <TeamsProviderSectionView
        {...buildProps({ isConnected: true, defaultTeamId: 'team-1', handleOpenFallback })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Configure fallback approver/ }));
    expect(handleOpenFallback).toHaveBeenCalledTimes(1);
  });

  it('renders the fallback dialog when open and a defaultTeamId is present', () => {
    render(
      <TeamsProviderSectionView {...buildProps({ defaultTeamId: 'team-1', fallbackOpen: true })} />,
    );
    expect(screen.getByTestId('fallback-dialog')).toBeInTheDocument();
  });
});
