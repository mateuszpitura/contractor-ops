/**
 * The sheet renders inside a Portal. Tests inject shaped hook output and
 * assert on header, action buttons, and the sync/webhook empty + filled
 * branches.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';
import type { useProviderDetailSheet } from '../hooks/use-provider-detail-sheet';
import { ProviderDetailSheetView } from '../provider-detail-sheet';

type HookReturn = ReturnType<typeof useProviderDetailSheet>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    t: tStub,
    health: undefined,
    connectionStatus: 'DISCONNECTED',
    syncItems: [],
    syncLogQuery: { isFetching: false, data: undefined } as HookReturn['syncLogQuery'],
    handleLoadMoreSync: vi.fn(),
    webhookItems: [],
    webhookLogQuery: { isFetching: false, data: undefined } as HookReturn['webhookLogQuery'],
    handleLoadMoreWebhook: vi.fn(),
    handleReauthorize: vi.fn(),
    handleDisconnect: vi.fn(),
    isDisconnectPending: false,
    ...overrides,
  } as HookReturn;
}

function baseProps(overrides: Partial<Parameters<typeof ProviderDetailSheetView>[0]> = {}) {
  return {
    provider: 'slack',
    displayName: 'Slack',
    icon: <span data-testid="provider-icon" />,
    open: true,
    onOpenChange: vi.fn(),
    disconnectDialogOpen: false,
    setDisconnectDialogOpen: vi.fn(),
    ...buildHook(),
    ...overrides,
  } as Parameters<typeof ProviderDetailSheetView>[0];
}

describe('ProviderDetailSheetView', () => {
  it('renders the display name header and status badge', () => {
    render(<ProviderDetailSheetView {...baseProps()} />);
    expect(screen.getByText('Slack')).toBeInTheDocument();
    // Status badge renders both in header and in dl row.
    expect(screen.getAllByText('provider.statusDisconnected').length).toBeGreaterThan(0);
  });

  it('shows the reauth and disconnect buttons when status is REAUTH_REQUIRED', () => {
    render(
      <ProviderDetailSheetView {...baseProps(buildHook({ connectionStatus: 'REAUTH_REQUIRED' }))} />,
    );
    expect(screen.getByRole('button', { name: 'provider.reconnectCta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'provider.disconnectCta' })).toBeInTheDocument();
  });

  it('hides the disconnect button when status is DISCONNECTED', () => {
    render(<ProviderDetailSheetView {...baseProps()} />);
    expect(
      screen.queryByRole('button', { name: 'provider.disconnectCta' }),
    ).not.toBeInTheDocument();
  });

  it('renders the sync log empty state when no items exist', () => {
    render(<ProviderDetailSheetView {...baseProps()} />);
    expect(screen.getByText('provider.syncLogEmpty')).toBeInTheDocument();
    expect(screen.getByText('provider.webhookLogEmpty')).toBeInTheDocument();
  });

  it('renders sync log rows when items are present', () => {
    render(
      <ProviderDetailSheetView
        {...baseProps(
          buildHook({
            syncItems: [
              {
                id: 'sl-1',
                syncType: 'invoice.pull',
                status: 'SUCCESS',
                direction: 'IN',
                errorMessage: null,
                startedAt: new Date('2026-05-20T10:00:00Z'),
                completedAt: new Date('2026-05-20T10:00:01Z'),
              },
            ],
          }),
        )}
      />,
    );

    expect(screen.getByText('invoice.pull')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('renders the disconnect confirm dialog body when disconnectDialogOpen is true', () => {
    render(
      <ProviderDetailSheetView
        {...baseProps({
          disconnectDialogOpen: true,
          ...buildHook({ connectionStatus: 'CONNECTED' }),
        })}
      />,
    );

    expect(screen.getByText('disconnectConfirmGeneric.body')).toBeInTheDocument();
  });
});
