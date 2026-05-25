/**
 * Tests target `LinearProviderSectionView` with shaped props. Sibling
 * containers are stubbed; we verify rendering, the open-mapping button
 * branch, and the warning banners for pending mapping / re-auth states.
 */

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen, setup } from '@/test/test-utils';
import type { LinearProviderSectionViewProps } from '../linear-provider-section';
import { LinearProviderSectionView } from '../linear-provider-section';

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

vi.mock('../linear-status-mapping-dialog-container', () => ({
  LinearStatusMappingDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="mapping-dialog" /> : null,
}));

interface BuildOpts {
  isConnected?: boolean;
  isPendingMapping?: boolean;
  needsReauth?: boolean;
  mappingOpen?: boolean;
  openMappingDialog?: () => void;
  setMappingOpen?: Dispatch<SetStateAction<boolean>>;
  isLoading?: boolean;
}

function buildProps(overrides: BuildOpts = {}): LinearProviderSectionViewProps {
  const {
    isConnected = false,
    isPendingMapping = false,
    needsReauth = false,
    mappingOpen = false,
    openMappingDialog = vi.fn(),
    setMappingOpen = vi.fn(),
    isLoading = false,
  } = overrides;

  const t = ((key: string): string => {
    const messages: Record<string, string> = {
      descriptionDisconnected:
        'Connect your Linear workspace to sync workflow tasks to Linear issues.',
      pendingMappingWarning:
        'Linear workspace connected — finish status mapping to start syncing issues.',
      scopeExpansionWarning: 'Re-authentication required to grant new Linear scopes.',
      configureMapping: 'Configure Status Mapping',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  return {
    isConnected,
    isPendingMapping,
    needsReauth,
    mappingOpen,
    setMappingOpen,
    openMappingDialog,
    t,
    isLoading,
  };
}

describe('LinearProviderSectionView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Linear provider connection card with description', () => {
    render(<LinearProviderSectionView {...buildProps()} />);
    expect(screen.getByTestId('provider-card')).toBeInTheDocument();
    expect(screen.getByText('Linear')).toBeInTheDocument();
    expect(
      screen.getByText('Connect your Linear workspace to sync workflow tasks to Linear issues.'),
    ).toBeInTheDocument();
  });

  it('hides the configure button when disconnected and not pending', () => {
    render(<LinearProviderSectionView {...buildProps()} />);
    expect(
      screen.queryByRole('button', { name: 'Configure Status Mapping' }),
    ).not.toBeInTheDocument();
  });

  it('shows the configure button when connected', () => {
    render(<LinearProviderSectionView {...buildProps({ isConnected: true })} />);
    expect(screen.getByRole('button', { name: 'Configure Status Mapping' })).toBeInTheDocument();
  });

  it('shows the pending mapping warning when isPendingMapping is true', () => {
    render(<LinearProviderSectionView {...buildProps({ isPendingMapping: true })} />);
    expect(
      screen.getByText(
        'Linear workspace connected — finish status mapping to start syncing issues.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the scope expansion warning when needsReauth is true', () => {
    render(<LinearProviderSectionView {...buildProps({ needsReauth: true })} />);
    expect(
      screen.getByText('Re-authentication required to grant new Linear scopes.'),
    ).toBeInTheDocument();
  });

  it('calls openMappingDialog when configure clicked', async () => {
    const openMappingDialog = vi.fn();
    const { user } = setup(
      <LinearProviderSectionView {...buildProps({ isConnected: true, openMappingDialog })} />,
    );
    await user.click(screen.getByRole('button', { name: 'Configure Status Mapping' }));
    expect(openMappingDialog).toHaveBeenCalledTimes(1);
  });

  it('renders the mapping dialog when mappingOpen is true', () => {
    render(<LinearProviderSectionView {...buildProps({ mappingOpen: true })} />);
    expect(screen.getByTestId('mapping-dialog')).toBeInTheDocument();
  });
});
