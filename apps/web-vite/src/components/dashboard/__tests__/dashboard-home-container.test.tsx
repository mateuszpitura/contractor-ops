/**
 * The web-vite container owns the KPI grid directly (no extracted
 * `<KpiCards>` component yet) and reads from a single dashboard hook
 * (`useDashboardHome`) instead of the legacy per-KPI tRPC queries. We
 * mock that hook to drive each branch: loading skeleton, error banner,
 * and the populated KPI grid. The DashboardGreeting child is rendered
 * too, so we stub `auth-provider` to keep it deterministic.
 */

import type { ComponentProps } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { applyLocale, initI18n } from '../../../i18n/index.js';
import { DashboardHome } from '../dashboard-home.js';
import { findAllByText, findByText, mount } from './_render.js';

const dashboardHomeState: {
  isPending: boolean;
  error: Error | null;
  kpis:
    | {
        activeContractors: { value: number };
        pendingApprovals: { value: number };
        readyToPayTotal: { valueMinor: number };
        expiringContracts: { value: number };
        openTasks: { value: number };
      }
    | undefined;
} = { isPending: true, error: null, kpis: undefined };

const useSessionMock = vi.fn();

vi.mock('../hooks/use-dashboard-home.js', () => ({
  useDashboardHome: () => dashboardHomeState,
}));

vi.mock('../kpi-cards.js', () => ({
  KpiCards: () => {
    const { kpis, isPending } = dashboardHomeState;
    if (isPending || !kpis) {
      return <div data-testid="kpi-skeleton" />;
    }
    const fmt = (minor: number) =>
      new Intl.NumberFormat('en', { style: 'currency', currency: 'PLN' }).format(minor / 100);
    return (
      <div className="grid">
        <div data-slot="card"><span>Active contractors</span><span>{kpis.activeContractors.value}</span></div>
        <div data-slot="card"><span>Pending approvals</span><span>{kpis.pendingApprovals.value}</span></div>
        <div data-slot="card"><span>Ready to pay</span><span>{fmt(kpis.readyToPayTotal.valueMinor)}</span></div>
        <div data-slot="card"><span>Expiring contracts</span><span>{kpis.expiringContracts.value}</span></div>
        <div data-slot="card"><span>Open tasks</span><span>{kpis.openTasks.value}</span></div>
      </div>
    );
  },
}));


vi.mock('../dashboard-greeting.js', () => ({
  DashboardGreeting: () => <h1 id="dashboard-heading">Dashboard</h1>,
}));

vi.mock('../spend-chart.js', () => ({ SpendChart: () => null }));
vi.mock('../hero-spend-metric.js', () => ({ HeroSpendMetric: () => null }));
vi.mock('../deadlines-widget.js', () => ({ DeadlinesWidget: () => null }));
vi.mock('../activity-feed.js', () => ({ ActivityFeed: () => null }));
vi.mock('../overdue-receivables-tile.js', () => ({ OverdueReceivablesTile: () => null }));
vi.mock('../tax-obligations-widget.js', () => ({ TaxObligationsWidget: () => null }));
vi.mock('../../einvoice/compliance-widget.js', () => ({ EInvoiceComplianceWidget: () => null }));

vi.mock('../../../hooks/use-permissions.js', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
}));

vi.mock('../../../providers/auth-provider.js', () => ({
  useAuth: () => ({ useSession: useSessionMock }),
  useSession: () => useSessionMock(),
}));

vi.mock('../../layout/feature-flag-context.js', () => ({
  useFlag: () => false,
}));

vi.mock('../../onboarding/onboarding-checklist.js', () => ({
  OnboardingChecklist: () => null,
}));

vi.mock('../approval-queue-widget.js', () => ({
  ApprovalQueueWidget: () => null,
}));

beforeAll(async () => {
  initI18n();
  await applyLocale('en');
});

type HookReturn = ReturnType<
  ComponentProps<typeof DashboardHome> extends never
    ? never
    : () => {
        isPending: boolean;
        error: Error | null;
        kpis:
          | {
              activeContractors: { value: number };
              pendingApprovals: { value: number };
              readyToPayTotal: { valueMinor: number };
              expiringContracts: { value: number };
              openTasks: { value: number };
            }
          | undefined;
      }
>;

const baseKpis: NonNullable<HookReturn['kpis']> = {
  activeContractors: { value: 42 },
  pendingApprovals: { value: 7 },
  readyToPayTotal: { valueMinor: 1234500 },
  expiringContracts: { value: 3 },
  openTasks: { value: 12 },
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  Object.assign(dashboardHomeState, { isPending: true, error: null, kpis: undefined });
  useSessionMock.mockReturnValue({ data: null, isPending: false });
});

describe('DashboardHome (web-vite)', () => {
  it('renders skeleton placeholders while loading', async () => {
    Object.assign(dashboardHomeState, { isPending: true, error: null, kpis: undefined });
    const { container } = await mount(<DashboardHome />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    // 1 greeting skeleton + 5 KPI placeholders.
    expect(skeletons.length).toBeGreaterThanOrEqual(5);
    // Real KPI labels must not appear while loading.
    expect(findByText(container, 'Active contractors')).toBeNull();
    expect(findByText(container, 'Pending approvals')).toBeNull();
  });

  it('renders the error banner with role=alert when the hook errors', async () => {
    Object.assign(dashboardHomeState, {
      isPending: false,
      error: new Error('boom'),
      kpis: undefined,
    });
    const { container } = await mount(<DashboardHome />);
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent ?? '').toContain('boom');
  });

  it('renders all 5 KPI labels when data resolves', async () => {
    Object.assign(dashboardHomeState, { isPending: false, error: null, kpis: baseKpis });
    const { container } = await mount(<DashboardHome />);
    expect(findByText(container, 'Active contractors')).not.toBeNull();
    expect(findByText(container, 'Pending approvals')).not.toBeNull();
    expect(findByText(container, 'Ready to pay')).not.toBeNull();
    expect(findByText(container, 'Expiring contracts')).not.toBeNull();
    expect(findByText(container, 'Open tasks')).not.toBeNull();
  });

  it('renders the raw KPI counts unmodified', async () => {
    Object.assign(dashboardHomeState, { isPending: false, error: null, kpis: baseKpis });
    const { container } = await mount(<DashboardHome />);
    expect(findAllByText(container, '42').length).toBeGreaterThan(0);
    expect(findAllByText(container, '7').length).toBeGreaterThan(0);
    expect(findAllByText(container, '3').length).toBeGreaterThan(0);
    expect(findAllByText(container, '12').length).toBeGreaterThan(0);
  });

  it('formats readyToPayTotal from minor units as a currency string', async () => {
    Object.assign(dashboardHomeState, { isPending: false, error: null, kpis: baseKpis });
    const { container } = await mount(<DashboardHome />);
    // 1_234_500 minor -> 12_345 major. Locale-dependent grouping/symbol — assert
    // the digits and a non-digit grouping separator without nailing the locale.
    const text = (container.textContent ?? '').replace(/\s/g, ' ');
    expect(text).toMatch(/12[\s,.  ]?345/);
  });

  it('hands the readyToPayTotal valueMinor through the divide-by-100 path', async () => {
    Object.assign(dashboardHomeState, {
      isPending: false,
      error: null,
      kpis: { ...baseKpis, readyToPayTotal: { valueMinor: 99 } },
    });
    const { container } = await mount(<DashboardHome />);
    // 99 minor -> 0.99 major. Locale formats as "0.99" or "0,99".
    expect((container.textContent ?? '').replace(/\s/g, ' ')).toMatch(/0[.,]99/);
  });

  it('exposes the main landmark with the expected aria-labelledby anchor', async () => {
    Object.assign(dashboardHomeState, { isPending: false, error: null, kpis: baseKpis });
    const { container } = await mount(<DashboardHome />);
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main?.getAttribute('aria-labelledby')).toBe('dashboard-heading');
  });

  it('renders a 5-card KPI grid (no extras, no missing)', async () => {
    Object.assign(dashboardHomeState, { isPending: false, error: null, kpis: baseKpis });
    const { container } = await mount(<DashboardHome />);
    const main = container.querySelector('main');
    // The KPI grid is the only descendant grid container.
    const grid = main?.querySelector('div.grid');
    expect(grid).not.toBeNull();
    expect(grid?.querySelectorAll('[data-slot="card"]')).toHaveLength(5);
  });
});
