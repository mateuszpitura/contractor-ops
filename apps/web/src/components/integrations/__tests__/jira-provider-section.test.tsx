import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const useQueryMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => useQueryMock(...args),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (values) return `${key}:${JSON.stringify(values)}`;
    return key;
  },
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    jira: {
      connectionStatus: {
        queryOptions: () => ({ queryKey: ['jira.connectionStatus'] }),
      },
    },
    billing: {
      getSubscription: {
        queryOptions: () => ({ queryKey: ['billing.getSubscription'] }),
      },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/components/settings/provider-connection-card', () => ({
  ProviderConnectionCard: () => <div data-testid="provider-card">ProviderConnectionCard</div>,
}));

vi.mock('../jira-logo', () => ({
  JiraLogo: () => <span>JiraLogo</span>,
}));

vi.mock('../jira-status-mapping-dialog', () => ({
  JiraStatusMappingDialog: () => null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockUseQuery(_queryKey: unknown[], data: unknown, isLoading = false) {
  return { data, isLoading, error: null, isError: false, isPending: isLoading };
}

function setupStarterTier() {
  useQueryMock.mockImplementation((opts: { queryKey: unknown[] }) => {
    const key = Array.isArray(opts.queryKey) ? opts.queryKey[0] : '';
    if (key === 'billing.getSubscription') {
      return mockUseQuery(opts.queryKey, { tier: 'STARTER' });
    }
    // jira connection — disconnected
    return mockUseQuery(opts.queryKey, null);
  });
}

function setupProTier() {
  useQueryMock.mockImplementation((opts: { queryKey: unknown[] }) => {
    const key = Array.isArray(opts.queryKey) ? opts.queryKey[0] : '';
    if (key === 'billing.getSubscription') {
      return mockUseQuery(opts.queryKey, { tier: 'PRO' });
    }
    return mockUseQuery(opts.queryKey, {
      id: 'conn-1',
      status: 'CONNECTED',
      scopeExpansionNeeded: false,
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { JiraProviderSection } from '../jira-provider-section';

describe('JiraProviderSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps content with FeatureGate requiring Pro tier — STARTER sees upgrade banner', () => {
    setupStarterTier();
    render(<JiraProviderSection />);

    // UpgradeInlineBanner should render with feature name
    const banner = screen.getByRole('status');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('Jira integration');

    // Provider card should NOT be visible
    expect(screen.queryByTestId('provider-card')).not.toBeInTheDocument();
  });

  it('PRO tier users see provider section normally', () => {
    setupProTier();
    render(<JiraProviderSection />);

    // Provider card should be visible
    expect(screen.getByTestId('provider-card')).toBeInTheDocument();

    // No upgrade banner
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows status mapping button when connected without scope expansion needed', () => {
    setupProTier();
    render(<JiraProviderSection />);

    expect(screen.getByRole('button', { name: /configure status mapping/i })).toBeInTheDocument();
  });
});
