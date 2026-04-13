import { render, screen } from '@/test/test-utils';
import { IntegrationsTab } from '../integrations-tab';

vi.mock('next-intl', async importOriginal => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: () => (key: string) => key,
  };
});

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({ isLoading: false, data: { status: 'DISCONNECTED' } }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    integration: {
      getHealth: {
        queryOptions: vi.fn(() => ({ queryKey: ['integration', 'getHealth'] })),
        queryKey: vi.fn(() => ['integration', 'getHealth']),
      },
      getAllHealth: { queryKey: vi.fn(() => ['integration', 'getAllHealth']) },
      getSlackStatus: {
        queryOptions: vi.fn(() => ({ queryKey: ['integration', 'getSlackStatus'] })),
      },
      getOAuthUrlGeneric: {
        queryOptions: vi.fn(() => ({
          queryKey: ['integration', 'getOAuthUrlGeneric'],
          enabled: false,
        })),
      },
      disconnectGeneric: { mutationOptions: vi.fn((o: object) => o) },
    },
    ksef: {
      connectionStatus: {
        queryOptions: vi.fn(() => ({ queryKey: ['ksef', 'connectionStatus'] })),
        queryKey: vi.fn(() => ['ksef', 'connectionStatus']),
      },
      triggerSync: { mutationOptions: vi.fn(() => ({})) },
      syncHistory: { queryKey: vi.fn(() => ['ksef', 'syncHistory']) },
    },
    settings: {
      get: {
        queryOptions: vi.fn(() => ({ queryKey: ['settings', 'get'] })),
      },
    },
    jira: {
      connectionStatus: {
        queryOptions: vi.fn(() => ({ queryKey: ['jira', 'connectionStatus'] })),
      },
    },
    linear: {
      connectionStatus: {
        queryOptions: vi.fn(() => ({ queryKey: ['linear', 'connectionStatus'] })),
      },
    },
    googleWorkspace: {
      syncStatus: {
        queryOptions: vi.fn(() => ({ queryKey: ['gw', 'syncStatus'] })),
        queryKey: vi.fn(() => ['gw', 'syncStatus']),
      },
      listDirectory: {
        queryOptions: vi.fn(() => ({ queryKey: ['gw', 'listDirectory'] })),
        queryKey: vi.fn(() => ['gw', 'listDirectory']),
      },
    },
    calendar: {
      listConnections: {
        queryOptions: vi.fn(() => ({ queryKey: ['calendar', 'listConnections'] })),
        queryKey: vi.fn(() => ['calendar', 'listConnections']),
      },
      disconnect: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/settings/provider-connection-card', () => ({
  ProviderConnectionCard: ({ displayName }: { displayName: string }) => (
    <div data-testid={`provider-${displayName}`}>{displayName}</div>
  ),
}));
vi.mock('@/components/settings/slack-user-mapping', () => ({
  SlackUserMapping: () => null,
}));
vi.mock('@/components/settings/ksef-setup-dialog', () => ({
  KsefSetupDialog: () => null,
}));
vi.mock('@/components/settings/ksef-sync-history', () => ({
  KsefSyncHistory: () => null,
}));
vi.mock('@/components/integrations/jira-provider-section', () => ({
  JiraProviderSection: () => <div data-testid="jira-section" />,
}));
vi.mock('@/components/integrations/linear-provider-section', () => ({
  LinearProviderSection: () => <div data-testid="linear-section" />,
}));
vi.mock('@/components/integrations/google-workspace-provider-section', () => ({
  GoogleWorkspaceProviderSection: () => <div data-testid="gw-section" />,
}));
vi.mock('@/components/integrations/teams-provider-section', () => ({
  TeamsProviderSection: () => <div data-testid="teams-section" />,
}));
vi.mock('@/components/settings/dpd-provider-section', () => ({
  DpdProviderSection: () => <div data-testid="dpd-section" />,
}));
vi.mock('@/components/settings/ups-provider-section', () => ({
  UpsProviderSection: () => <div data-testid="ups-section" />,
}));
vi.mock('@/components/settings/org-calendar-section', () => ({
  OrgCalendarSection: () => <div data-testid="org-calendar" />,
}));

vi.mock('@/components/peppol/peppol-status-card', () => ({
  PeppolStatusCard: () => <div data-testid="peppol-status" />,
}));

describe('IntegrationsTab', () => {
  it('renders provider cards', () => {
    render(<IntegrationsTab />);
    expect(screen.getByTestId('provider-Slack')).toBeInTheDocument();
    expect(screen.getByTestId('jira-section')).toBeInTheDocument();
    expect(screen.getByTestId('linear-section')).toBeInTheDocument();
    expect(screen.getByTestId('gw-section')).toBeInTheDocument();
    expect(screen.getByTestId('teams-section')).toBeInTheDocument();
  });

  it('renders reimport button', () => {
    render(<IntegrationsTab />);
    expect(screen.getByText('settingsReimport')).toBeInTheDocument();
  });

  it('renders DPD and UPS carrier provider sections', () => {
    render(<IntegrationsTab />);
    expect(screen.getByTestId('dpd-section')).toBeInTheDocument();
    expect(screen.getByTestId('ups-section')).toBeInTheDocument();
  });

  it('renders Notion and Confluence cards', () => {
    render(<IntegrationsTab />);
    expect(screen.getByTestId('provider-Notion')).toBeInTheDocument();
    expect(screen.getByTestId('provider-Confluence')).toBeInTheDocument();
  });
});
