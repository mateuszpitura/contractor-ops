import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { ExternalSyncButton } from '../external-sync-button';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('ExternalSyncButton', () => {
  it('renders disabled button when not connected', () => {
    render(
      <ExternalSyncButton
        provider="CLOCKIFY"
        connected={false}
        onSync={vi.fn()}
        isSyncing={false}
      />,
    );
    expect(screen.getByText(/Sync from Clockify/)).toBeInTheDocument();
  });

  it('renders Jira provider label', () => {
    render(
      <ExternalSyncButton provider="JIRA" connected={false} onSync={vi.fn()} isSyncing={false} />,
    );
    expect(screen.getByText(/Sync from Jira/)).toBeInTheDocument();
  });

  it('renders importing state', () => {
    render(
      <ExternalSyncButton provider="CLOCKIFY" connected={true} onSync={vi.fn()} isSyncing={true} />,
    );
    expect(screen.getByText(/Importing/)).toBeInTheDocument();
  });

  it('renders sync button when connected and not syncing', () => {
    render(
      <ExternalSyncButton
        provider="CLOCKIFY"
        connected={true}
        onSync={vi.fn()}
        isSyncing={false}
      />,
    );
    expect(screen.getByText(/Sync from Clockify/)).toBeInTheDocument();
  });

  it('opens popover on click when connected', async () => {
    const { user } = setup(
      <ExternalSyncButton
        provider="CLOCKIFY"
        connected={true}
        onSync={vi.fn()}
        isSyncing={false}
      />,
    );
    const syncButton = screen.getByText(/Sync from Clockify/);
    await user.click(syncButton);
    expect(screen.getByText('Import from Clockify')).toBeInTheDocument();
    expect(screen.getByText('Import Entries')).toBeInTheDocument();
  });
});
