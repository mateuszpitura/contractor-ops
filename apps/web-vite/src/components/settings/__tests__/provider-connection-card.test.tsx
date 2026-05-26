/**
 * Web-vite port of apps/web/src/components/settings/__tests__/provider-connection-card.test.tsx.
 *
 * Container/component split. The detail sheet container is mocked to a
 * noop to keep the test scoped to the card surface.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../provider-detail-sheet-container', () => ({
  ProviderDetailSheetContainer: () => null,
}));

import { render, screen, setup } from '@/test/test-utils';
import type { useProviderConnectionCard } from '../hooks/use-provider-connection-card';
import { ProviderConnectionCard } from '../provider-connection-card';

type HookReturn = ReturnType<typeof useProviderConnectionCard>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    t: tStub,
    isLoading: false,
    health: undefined,
    handleConnect: vi.fn(),
    handleDisconnectConfirm: vi.fn(),
    isDisconnectPending: false,
    jiraDisconnect: { isPending: false } as HookReturn['jiraDisconnect'],
    ksefDisconnect: { isPending: false } as HookReturn['ksefDisconnect'],
    genericDisconnect: { isPending: false } as HookReturn['genericDisconnect'],
    ...overrides,
  } as HookReturn;
}

function baseProps(extra: Partial<Parameters<typeof ProviderConnectionCard>[0]> = {}) {
  return {
    provider: 'slack',
    displayName: 'Slack',
    icon: <span data-testid="provider-icon" />,
    description: 'Slack description text',
    disconnectDialogOpen: false,
    setDisconnectDialogOpen: vi.fn(),
    detailSheetOpen: false,
    setDetailSheetOpen: vi.fn(),
    ...buildHook(),
    ...extra,
  } as Parameters<typeof ProviderConnectionCard>[0];
}

describe('ProviderConnectionCard', () => {
  it('renders the loading skeleton while isLoading', () => {
    const { container } = render(
      <ProviderConnectionCard {...baseProps(buildHook({ isLoading: true }))} />,
    );
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders the disconnected state with description + connect CTA by default', async () => {
    const handleConnect = vi.fn();
    const { user } = setup(
      <ProviderConnectionCard {...baseProps({ ...buildHook({ handleConnect }) })} />,
    );

    expect(screen.getByText('Slack description text')).toBeInTheDocument();
    expect(screen.getByText('provider.statusDisconnected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'provider.connectCta' }));
    expect(handleConnect).toHaveBeenCalledTimes(1);
  });

  it('renders the connected state and manage / disconnect CTAs when CONNECTED', () => {
    render(
      <ProviderConnectionCard
        {...baseProps(
          buildHook({
            health: {
              status: 'CONNECTED',
              displayName: 'workspace.slack.com',
              connectedAt: new Date('2026-05-01T00:00:00Z'),
            } as never,
          }),
        )}
      />,
    );

    expect(screen.getByText('provider.statusConnected')).toBeInTheDocument();
    expect(screen.getByText('workspace.slack.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'provider.manageCta' })).toBeInTheDocument();
  });

  it('renders the reauth body when status is REAUTH_REQUIRED', () => {
    render(
      <ProviderConnectionCard
        {...baseProps(buildHook({ health: { status: 'REAUTH_REQUIRED' } as never }))}
      />,
    );

    expect(screen.getByText('provider.statusReauth')).toBeInTheDocument();
    expect(screen.getByText('provider.errorTokenExpired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'provider.reconnectCta' })).toBeInTheDocument();
  });

  it('renders the error body when status is ERROR', () => {
    render(
      <ProviderConnectionCard
        {...baseProps(buildHook({ health: { status: 'ERROR' } as never }))}
      />,
    );

    expect(screen.getByText('provider.statusError')).toBeInTheDocument();
    expect(screen.getByText('provider.errorConnectionFailed')).toBeInTheDocument();
  });

  it('opens the disconnect dialog body when disconnectDialogOpen is true', () => {
    render(
      <ProviderConnectionCard
        {...baseProps({
          disconnectDialogOpen: true,
          ...buildHook({ health: { status: 'CONNECTED' } as never }),
        })}
      />,
    );

    expect(screen.getByText('disconnectConfirmGeneric.title')).toBeInTheDocument();
    expect(screen.getByText('disconnectConfirmGeneric.body')).toBeInTheDocument();
  });
});
