/**
 * Tests target `JiraProviderSectionView` with shaped props. FeatureGateContainer
 * and ProviderConnectionCardContainer are stubbed — they have their own tests
 * elsewhere; here we verify the section's branching on `isConnected` and
 * `scopeExpansionNeeded`, and that the configure button opens the mapping dialog.
 */

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen, setup } from '@/test/test-utils';
import type { JiraProviderSectionViewProps } from '../jira-provider-section';
import { JiraProviderSectionView } from '../jira-provider-section';

vi.mock('../../billing/feature-gate-container', () => ({
  FeatureGateContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../../settings/provider-connection-card-container', () => ({
  ProviderConnectionCardContainer: ({
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

vi.mock('../jira-status-mapping-dialog-container', () => ({
  JiraStatusMappingDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="status-mapping-dialog" /> : null,
}));

interface BuildOpts {
  connection?: { id: string; status: string; scopeExpansionNeeded?: boolean } | null | undefined;
  isConnected?: boolean;
  mappingDialogOpen?: boolean;
  openMappingDialog?: () => void;
  setMappingDialogOpen?: Dispatch<SetStateAction<boolean>>;
  isLoading?: boolean;
}

function buildProps(overrides: BuildOpts = {}): JiraProviderSectionViewProps {
  const {
    connection = null,
    isConnected = false,
    mappingDialogOpen = false,
    openMappingDialog = vi.fn(),
    setMappingDialogOpen = vi.fn(),
    isLoading = false,
  } = overrides;

  const t = ((key: string): string => {
    const messages: Record<string, string> = {
      'jiraProvider.description': 'Connect Jira Cloud to sync workflow tasks with Jira issues.',
      'jiraProvider.scopeWarning':
        'Re-auth required — new scopes needed for issue creation and webhooks.',
      'jiraProvider.configureStatusMapping': 'Configure Status Mapping',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  return {
    connection,
    isConnected,
    mappingDialogOpen,
    setMappingDialogOpen,
    openMappingDialog,
    t,
    isLoading,
  };
}

describe('JiraProviderSectionView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Jira provider connection card with description', () => {
    render(<JiraProviderSectionView {...buildProps()} />);
    expect(screen.getByTestId('provider-card')).toBeInTheDocument();
    expect(screen.getByText('Jira')).toBeInTheDocument();
    expect(
      screen.getByText('Connect Jira Cloud to sync workflow tasks with Jira issues.'),
    ).toBeInTheDocument();
  });

  it('does not render configure button when disconnected', () => {
    render(<JiraProviderSectionView {...buildProps({ isConnected: false })} />);
    expect(
      screen.queryByRole('button', { name: 'Configure Status Mapping' }),
    ).not.toBeInTheDocument();
  });

  it('renders configure button when connected without scopeExpansionNeeded', () => {
    render(
      <JiraProviderSectionView
        {...buildProps({
          isConnected: true,
          connection: { id: 'c-1', status: 'CONNECTED', scopeExpansionNeeded: false },
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Configure Status Mapping' })).toBeInTheDocument();
  });

  it('renders scope warning when scopeExpansionNeeded is true', () => {
    render(
      <JiraProviderSectionView
        {...buildProps({
          isConnected: true,
          connection: { id: 'c-1', status: 'CONNECTED', scopeExpansionNeeded: true },
        })}
      />,
    );
    expect(
      screen.getByText('Re-auth required — new scopes needed for issue creation and webhooks.'),
    ).toBeInTheDocument();
    // Configure button is hidden while scope expansion is pending
    expect(
      screen.queryByRole('button', { name: 'Configure Status Mapping' }),
    ).not.toBeInTheDocument();
  });

  it('opens the mapping dialog when configure clicked', async () => {
    const openMappingDialog = vi.fn();
    const { user } = setup(
      <JiraProviderSectionView
        {...buildProps({
          isConnected: true,
          connection: { id: 'c-1', status: 'CONNECTED', scopeExpansionNeeded: false },
          openMappingDialog,
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Configure Status Mapping' }));
    expect(openMappingDialog).toHaveBeenCalledTimes(1);
  });

  it('renders the mapping dialog only when open and connection exists', () => {
    render(
      <JiraProviderSectionView
        {...buildProps({
          isConnected: true,
          connection: { id: 'c-1', status: 'CONNECTED' },
          mappingDialogOpen: true,
        })}
      />,
    );
    expect(screen.getByTestId('status-mapping-dialog')).toBeInTheDocument();
  });

  it('does not render the mapping dialog when connection is missing', () => {
    render(
      <JiraProviderSectionView {...buildProps({ mappingDialogOpen: true, connection: null })} />,
    );
    expect(screen.queryByTestId('status-mapping-dialog')).not.toBeInTheDocument();
  });
});
