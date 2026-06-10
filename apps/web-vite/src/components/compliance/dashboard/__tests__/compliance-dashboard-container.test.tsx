// Admin compliance dashboard page-content tests (COMPL-01).

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { applyLocale, initI18n } from '../../../../i18n/index.js';
import { ComplianceDashboardPageContent } from '../../../../pages/dashboard/compliance-dashboard.js';
import { mount } from './_render.js';

const useComplianceDashboardMock = vi.fn();
const canMock = vi.fn();

vi.mock('../hooks/use-compliance-dashboard.js', () => ({
  useComplianceDashboard: () => useComplianceDashboardMock(),
}));
vi.mock('../../../../hooks/use-permissions.js', () => ({
  usePermissions: () => ({ can: canMock }),
}));
vi.mock('../../../../i18n/navigation.js', () => ({
  useLocale: () => 'en',
  usePathname: () => '/en/compliance',
  Link: ({ children }: { children?: unknown }) => children,
}));
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  useSearchParams: () => [new URLSearchParams()],
}));
vi.mock('../at-risk-table/data-table.js', () => ({
  AtRiskTable: () => <div data-testid="at-risk-table" />,
}));
vi.mock('../upcoming-renewals-table/data-table.js', () => ({
  UpcomingRenewalsTable: () => <div data-testid="upcoming-renewals-table" />,
}));
vi.mock('../blocked-payments-table/data-table.js', () => ({
  BlockedPaymentsTable: () => <div data-testid="blocked-payments-table" />,
}));

const populated = {
  isPending: false,
  error: null,
  isEmpty: false,
  kpis: {
    atRisk: { value: 3 },
    upcomingRenewals: { value: 5 },
    blockedPayments: { value: 2 },
  },
  atRiskProps: { rows: [], totalRows: 3 },
  upcomingProps: { rows: [], totalRows: 5 },
  blockedProps: { rows: [], totalRows: 2, isRefetching: false },
};

beforeAll(async () => {
  initI18n();
  await applyLocale('en');
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('ComplianceDashboardPageContent render', () => {
  it('exports a ComplianceDashboardPageContent component', () => {
    expect(typeof ComplianceDashboardPageContent).toBe('function');
  });

  it('renders 3 KPI cards + the default tab table', async () => {
    canMock.mockReturnValue(true);
    useComplianceDashboardMock.mockReturnValue(populated);
    const { container } = await mount(<ComplianceDashboardPageContent />);
    const cards = container.querySelectorAll('button[aria-pressed]');
    expect(cards.length).toBe(3);
    expect(container.querySelector('[data-testid="at-risk-table"]')).not.toBeNull();
  });
});

describe('ComplianceDashboardPageContent default-tab-at-risk', () => {
  it('lands on "At risk" tab by default (first card aria-pressed)', async () => {
    canMock.mockReturnValue(true);
    useComplianceDashboardMock.mockReturnValue(populated);
    const { container } = await mount(<ComplianceDashboardPageContent />);
    const cards = container.querySelectorAll('button[aria-pressed]');
    expect(cards[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(cards[1]?.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('ComplianceDashboardPageContent card-click-switches-tab', () => {
  it('clicking the "Upcoming renewals" KPI card switches the active tab table', async () => {
    canMock.mockReturnValue(true);
    useComplianceDashboardMock.mockReturnValue(populated);
    const { container } = await mount(<ComplianceDashboardPageContent />);
    const cards = container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]');
    const { act } = await import('react');
    await act(async () => {
      cards[1]?.click();
    });
    expect(container.querySelector('[data-testid="upcoming-renewals-table"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="at-risk-table"]')).toBeNull();
  });
});

describe('ComplianceDashboardPageContent ui-states', () => {
  it('renders the skeleton while loading', async () => {
    canMock.mockReturnValue(true);
    useComplianceDashboardMock.mockReturnValue({ ...populated, isPending: true, kpis: undefined });
    const { container } = await mount(<ComplianceDashboardPageContent />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector('button[aria-pressed]')).toBeNull();
  });

  it('renders a role=alert error block on error', async () => {
    canMock.mockReturnValue(true);
    useComplianceDashboardMock.mockReturnValue({
      ...populated,
      error: new Error('boom'),
    });
    const { container } = await mount(<ComplianceDashboardPageContent />);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('renders the empty state when isEmpty', async () => {
    canMock.mockReturnValue(true);
    useComplianceDashboardMock.mockReturnValue({ ...populated, isEmpty: true });
    const { container } = await mount(<ComplianceDashboardPageContent />);
    expect(container.querySelector('button[aria-pressed]')).toBeNull();
    expect(container.querySelector('[data-testid="at-risk-table"]')).toBeNull();
  });
});

describe('ComplianceDashboardPageContent permission-gate', () => {
  it('redirects to /unauthorized when the caller lacks compliance:read', async () => {
    canMock.mockReturnValue(false);
    useComplianceDashboardMock.mockReturnValue(populated);
    const { container } = await mount(<ComplianceDashboardPageContent />);
    const nav = container.querySelector('[data-testid="navigate"]');
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute('data-to')).toContain('/unauthorized');
  });
});
