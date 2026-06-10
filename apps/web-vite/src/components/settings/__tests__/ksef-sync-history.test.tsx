/**
 * The collapsible receives `t`, open state, logs and loading state from
 * `useKsefSyncHistory`. The trigger always renders; the body is only
 * forced into the DOM when `isOpen` is true.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { SyncLogEntry, useKsefSyncHistory } from '../hooks/use-ksef-sync-history';
import { KsefSyncHistoryView } from '../ksef-sync-history';

type HookReturn = ReturnType<typeof useKsefSyncHistory>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    t: tStub,
    isOpen: false,
    setIsOpen: vi.fn(),
    syncHistoryQuery: {} as HookReturn['syncHistoryQuery'],
    logs: [] as SyncLogEntry[],
    isLoading: false,
    ...overrides,
  } as HookReturn;
}

const successLog: SyncLogEntry = {
  id: 'log-1',
  syncType: 'INVOICE_PULL',
  status: 'SUCCESS',
  direction: 'IN',
  errorMessage: null,
  responsePayloadJson: { invoicesCreated: 3 },
  startedAt: new Date('2026-05-20T10:00:00Z'),
  completedAt: new Date('2026-05-20T10:01:00Z'),
};

describe('KsefSyncHistoryView', () => {
  it('renders the collapsible trigger with the syncHistoryTitle copy', () => {
    render(<KsefSyncHistoryView {...buildHook()} />);
    expect(screen.getByText('syncHistoryTitle')).toBeInTheDocument();
  });

  it('toggles the open state when the trigger is clicked', async () => {
    const setIsOpen = vi.fn();
    const { user } = setup(<KsefSyncHistoryView {...buildHook({ setIsOpen })} />);

    await user.click(screen.getByRole('button', { name: /syncHistoryTitle/i }));
    expect(setIsOpen).toHaveBeenCalledTimes(1);
  });

  it('renders skeleton rows while loading and the section is open', () => {
    const { container } = render(
      <KsefSyncHistoryView {...buildHook({ isOpen: true, isLoading: true })} />,
    );

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders the empty-state copy when logs is empty and section is open', () => {
    render(<KsefSyncHistoryView {...buildHook({ isOpen: true })} />);

    expect(screen.getByText('syncHistoryEmpty')).toBeInTheDocument();
  });

  it('renders supplied logs with status and invoice-count badges', () => {
    render(<KsefSyncHistoryView {...buildHook({ isOpen: true, logs: [successLog] })} />);

    expect(screen.getByText('syncStatusSuccess')).toBeInTheDocument();
    expect(screen.getByText('syncInvoiceCount')).toBeInTheDocument();
  });

  it('marks zero-invoice success entries with the "no new" pill', () => {
    render(
      <KsefSyncHistoryView
        {...buildHook({
          isOpen: true,
          logs: [
            {
              ...successLog,
              responsePayloadJson: { invoicesCreated: 0 },
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('syncStatusNoNew')).toBeInTheDocument();
    expect(screen.queryByText('syncStatusSuccess')).not.toBeInTheDocument();
  });
});
