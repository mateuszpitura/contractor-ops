/**
 * Tests target `SyncStatusSectionView` with shaped props. Covers the loading
 * skeleton, the "not connected" null branch, and the connected card with
 * sync-now + import buttons.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen, setup } from '@/test/test-utils';
import type { SyncStatusSectionViewProps } from '../sync-status-section';
import { SyncStatusSectionView } from '../sync-status-section';

interface BuildOpts {
  isLoading?: boolean;
  connected?: boolean;
  lastSyncAt?: string | null;
  isTriggerPending?: boolean;
  onImportClick?: () => void;
  handleTriggerSync?: () => void;
}

function buildProps(overrides: BuildOpts = {}): SyncStatusSectionViewProps {
  const {
    isLoading = false,
    connected = true,
    lastSyncAt = null,
    isTriggerPending = false,
    onImportClick = vi.fn(),
    handleTriggerSync = vi.fn(),
  } = overrides;

  const t = ((key: string, values?: Record<string, string>): string => {
    const messages: Record<string, string> = {
      lastSynced: `Last synced ${values?.time ?? ''}`,
      nextSync: 'Next sync runs automatically every 24 hours.',
      syncNow: 'Sync now',
      syncing: 'Syncing...',
      importUsers: 'Import users',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  return {
    onImportClick,
    syncStatusQuery: { isLoading, data: { connected, lastSyncAt } } as never,
    syncStatus: { connected, lastSyncAt } as SyncStatusSectionViewProps['syncStatus'],
    triggerSyncMutation: { isPending: isTriggerPending } as never,
    handleTriggerSync,
    t,
  };
}

describe('SyncStatusSectionView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders skeleton placeholders while loading', () => {
    const { container } = render(<SyncStatusSectionView {...buildProps({ isLoading: true })} />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders nothing when not connected', () => {
    const { container } = render(<SyncStatusSectionView {...buildProps({ connected: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the sync-now and import buttons when connected', () => {
    render(<SyncStatusSectionView {...buildProps()} />);
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import users' })).toBeInTheDocument();
  });

  it('renders the last-synced line when a timestamp is present', () => {
    render(
      <SyncStatusSectionView
        {...buildProps({ lastSyncAt: new Date(Date.now() - 60_000).toISOString() })}
      />,
    );
    expect(screen.getByText(/Last synced/)).toBeInTheDocument();
  });

  it('swaps the sync button label and disables it while triggering', () => {
    render(<SyncStatusSectionView {...buildProps({ isTriggerPending: true })} />);
    expect(screen.getByRole('button', { name: 'Syncing...' })).toBeDisabled();
  });

  it('calls handleTriggerSync when sync-now clicked', async () => {
    const handleTriggerSync = vi.fn();
    const { user } = setup(<SyncStatusSectionView {...buildProps({ handleTriggerSync })} />);
    await user.click(screen.getByRole('button', { name: 'Sync now' }));
    expect(handleTriggerSync).toHaveBeenCalledTimes(1);
  });

  it('calls onImportClick when import clicked', async () => {
    const onImportClick = vi.fn();
    const { user } = setup(<SyncStatusSectionView {...buildProps({ onImportClick })} />);
    await user.click(screen.getByRole('button', { name: 'Import users' }));
    expect(onImportClick).toHaveBeenCalledTimes(1);
  });
});
