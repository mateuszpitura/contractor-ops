/**
 * Tests target `GoogleWorkspaceProviderSectionView` with shaped props. Sibling
 * containers (directory wizard, sync status section, reconnect banner) are
 * stubbed; we verify the connected/disconnected branches and that the wizard
 * is always mounted.
 */

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen } from '@/test/test-utils';
import type { GoogleWorkspaceProviderSectionViewProps } from '../google-workspace-provider-section';
import { GoogleWorkspaceProviderSectionView } from '../google-workspace-provider-section';

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

vi.mock('../google-workspace/directory-import-wizard.js', () => ({
  DirectoryImportWizard: ({ open }: { open: boolean }) => (
    <div data-testid="directory-wizard" data-open={open ? 'true' : 'false'} />
  ),
}));

vi.mock('../google-workspace/sync-status-section.js', () => ({
  SyncStatusSection: () => <div data-testid="sync-status-section" />,
}));

vi.mock('../google-workspace-reconnect-banner', () => ({
  GoogleWorkspaceReconnectBanner: () => <div data-testid="reconnect-banner" />,
}));

interface BuildOpts {
  isConnected?: boolean;
  wizardOpen?: boolean;
  setWizardOpen?: Dispatch<SetStateAction<boolean>>;
  onImportClick?: () => void;
  scopeCapabilities?: null;
}

function buildProps(overrides: BuildOpts = {}): GoogleWorkspaceProviderSectionViewProps {
  const {
    isConnected = false,
    wizardOpen = false,
    setWizardOpen = vi.fn(),
    onImportClick = vi.fn(),
    scopeCapabilities = null,
  } = overrides;

  const t = ((key: string): string => {
    const messages: Record<string, string> = {
      descriptionConnected:
        'Google Workspace connected — import users from your directory and keep them in sync.',
      descriptionDisconnected:
        'Connect Google Workspace to import users from your directory and keep them in sync.',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  return {
    isConnected,
    needsReauth: false,
    wizardOpen,
    setWizardOpen,
    onImportClick,
    t,
    scopeCapabilities,
  };
}

describe('GoogleWorkspaceProviderSectionView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the provider card with the disconnected description by default', () => {
    render(<GoogleWorkspaceProviderSectionView {...buildProps()} />);
    expect(screen.getByTestId('provider-card')).toBeInTheDocument();
    expect(screen.getByText('Google Workspace')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Connect Google Workspace to import users from your directory and keep them in sync.',
      ),
    ).toBeInTheDocument();
  });

  it('renders the connected description when connected', () => {
    render(<GoogleWorkspaceProviderSectionView {...buildProps({ isConnected: true })} />);
    expect(
      screen.getByText(
        'Google Workspace connected — import users from your directory and keep them in sync.',
      ),
    ).toBeInTheDocument();
  });

  it('renders sync-status section only when connected', () => {
    const { rerender } = render(<GoogleWorkspaceProviderSectionView {...buildProps()} />);
    expect(screen.queryByTestId('sync-status-section')).not.toBeInTheDocument();
    rerender(<GoogleWorkspaceProviderSectionView {...buildProps({ isConnected: true })} />);
    expect(screen.getByTestId('sync-status-section')).toBeInTheDocument();
  });

  it('renders the reconnect banner only when connected', () => {
    const { rerender } = render(<GoogleWorkspaceProviderSectionView {...buildProps()} />);
    expect(screen.queryByTestId('reconnect-banner')).not.toBeInTheDocument();
    rerender(<GoogleWorkspaceProviderSectionView {...buildProps({ isConnected: true })} />);
    expect(screen.getByTestId('reconnect-banner')).toBeInTheDocument();
  });

  it('always mounts the directory wizard, forwarding the open prop', () => {
    const { rerender } = render(<GoogleWorkspaceProviderSectionView {...buildProps()} />);
    expect(screen.getByTestId('directory-wizard')).toHaveAttribute('data-open', 'false');
    rerender(<GoogleWorkspaceProviderSectionView {...buildProps({ wizardOpen: true })} />);
    expect(screen.getByTestId('directory-wizard')).toHaveAttribute('data-open', 'true');
  });
});
