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
import { DashboardHomeContainer } from '../dashboard-home-container.js';
import { findAllByText, findByText, mount } from './_render.js';

const useDashboardHomeMock = vi.fn();
const useSessionMock = vi.fn();

vi.mock('../hooks/use-dashboard-home.js', () => ({
  useDashboardHome: () => useDashboardHomeMock(),
}));

vi.mock('../../../providers/auth-provider.js', () => ({
  useAuth: () => ({ useSession: useSessionMock }),
  useSession: () => useSessionMock(),
}));

beforeAll(async () => {
  initI18n();
  await applyLocale('en');
});

type HookReturn = ReturnType<
  ComponentProps<typeof DashboardHomeContainer> extends never
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
  useSessionMock.mockReturnValue({ data: null, isPending: false });
});

describe('DashboardHomeContainer (web-vite)', () => {
  it('renders skeleton placeholders while loading', async () => {
    useDashboardHomeMock.mockReturnValue({ isPending: true, error: null, kpis: undefined });
    const { container } = await mount(<DashboardHomeContainer />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    // 1 greeting skeleton + 5 KPI placeholders.
    expect(skeletons.length).toBeGreaterThanOrEqual(5);
    // Real KPI labels must not appear while loading.
    expect(findByText(container, 'Active contractors')).toBeNull();
    expect(findByText(container, 'Pending approvals')).toBeNull();
  });

  it('renders the error banner with role=alert when the hook errors', async () => {
    useDashboardHomeMock.mockReturnValue({
      isPending: false,
      error: new Error('boom'),
      kpis: undefined,
    });
    const { container } = await mount(<DashboardHomeContainer />);
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent ?? '').toContain('boom');
  });

  it('renders all 5 KPI labels when data resolves', async () => {
    useDashboardHomeMock.mockReturnValue({ isPending: false, error: null, kpis: baseKpis });
    const { container } = await mount(<DashboardHomeContainer />);
    expect(findByText(container, 'Active contractors')).not.toBeNull();
    expect(findByText(container, 'Pending approvals')).not.toBeNull();
    expect(findByText(container, 'Ready to pay')).not.toBeNull();
    expect(findByText(container, 'Expiring contracts')).not.toBeNull();
    expect(findByText(container, 'Open tasks')).not.toBeNull();
  });

  it('renders the raw KPI counts unmodified', async () => {
    useDashboardHomeMock.mockReturnValue({ isPending: false, error: null, kpis: baseKpis });
    const { container } = await mount(<DashboardHomeContainer />);
    expect(findAllByText(container, '42').length).toBeGreaterThan(0);
    expect(findAllByText(container, '7').length).toBeGreaterThan(0);
    expect(findAllByText(container, '3').length).toBeGreaterThan(0);
    expect(findAllByText(container, '12').length).toBeGreaterThan(0);
  });

  it('formats readyToPayTotal from minor units as a currency string', async () => {
    useDashboardHomeMock.mockReturnValue({ isPending: false, error: null, kpis: baseKpis });
    const { container } = await mount(<DashboardHomeContainer />);
    // 1_234_500 minor -> 12_345 major. Locale-dependent grouping/symbol — assert
    // the digits and a non-digit grouping separator without nailing the locale.
    const text = (container.textContent ?? '').replace(/\s/g, ' ');
    expect(text).toMatch(/12[\s,.  ]?345/);
  });

  it('hands the readyToPayTotal valueMinor through the divide-by-100 path', async () => {
    useDashboardHomeMock.mockReturnValue({
      isPending: false,
      error: null,
      kpis: { ...baseKpis, readyToPayTotal: { valueMinor: 99 } },
    });
    const { container } = await mount(<DashboardHomeContainer />);
    // 99 minor -> 0.99 major. Locale formats as "0.99" or "0,99".
    expect((container.textContent ?? '').replace(/\s/g, ' ')).toMatch(/0[.,]99/);
  });

  it('exposes the main landmark with the expected aria-labelledby anchor', async () => {
    useDashboardHomeMock.mockReturnValue({ isPending: false, error: null, kpis: baseKpis });
    const { container } = await mount(<DashboardHomeContainer />);
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main?.getAttribute('aria-labelledby')).toBe('dashboard-heading');
  });

  it('renders a 5-card KPI grid (no extras, no missing)', async () => {
    useDashboardHomeMock.mockReturnValue({ isPending: false, error: null, kpis: baseKpis });
    const { container } = await mount(<DashboardHomeContainer />);
    const main = container.querySelector('main');
    // The KPI grid is the only descendant grid container.
    const grid = main?.querySelector('div.grid');
    expect(grid).not.toBeNull();
    // Each UsageKpiCard renders a single shadcn Card. There are 5 KPIs.
    expect(grid?.querySelectorAll('[data-slot="card"]')).toHaveLength(5);
  });
});
