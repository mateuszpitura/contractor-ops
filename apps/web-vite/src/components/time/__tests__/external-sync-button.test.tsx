/**
 * Step-10 port. ExternalSyncButton renders a tooltip-wrapped disabled
 * button when disconnected, a busy state when syncing, and a popover with
 * date selectors when connected & idle.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../../test/test-utils.js';
import { ExternalSyncButton } from '../external-sync-button.js';

describe('ExternalSyncButton (web-vite)', () => {
  it('renders the disconnected disabled button with the Sync from <provider> label', () => {
    render(
      <ExternalSyncButton
        provider="CLOCKIFY"
        connected={false}
        onSync={vi.fn()}
        isSyncing={false}
      />,
    );
    const btn = screen.getByRole('button', { name: /Sync from Clockify/i });
    expect(btn).toBeDisabled();
  });

  it('renders the importing state when isSyncing is true', () => {
    render(<ExternalSyncButton provider="JIRA" connected onSync={vi.fn()} isSyncing />);
    expect(screen.getByRole('button', { name: /Importing/i })).toBeDisabled();
  });

  it('renders the active trigger button when connected and idle', () => {
    render(<ExternalSyncButton provider="CLOCKIFY" connected onSync={vi.fn()} isSyncing={false} />);
    const trigger = screen.getByRole('button', { name: /Sync from Clockify/i });
    expect(trigger).toBeEnabled();
  });
});
