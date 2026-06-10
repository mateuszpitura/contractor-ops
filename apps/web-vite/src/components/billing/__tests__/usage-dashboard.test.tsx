/**
 * UsageDashboard (wired) owns loading/error/null branches via useUsageDashboard.
 * UsageDashboardView is presentational — parsed + currentTier only.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';

const mockRefetch = vi.fn();

vi.mock('../hooks/use-billing.js', () => ({
  useUsageDashboard: vi.fn(),
  parseUsageDashboard: (data: unknown) => data,
  deriveUsageDashboardTier: () => 'PRO',
}));

vi.mock('../usage-kpi-card', () => ({
  UsageKpiCard: ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div data-testid="kpi-card">
      <span>{label}</span>
      <div>{value}</div>
    </div>
  ),
}));

vi.mock('../seat-count-card', () => ({
  SeatCountCard: () => <div data-testid="seat-count-card" />,
}));

vi.mock('../billing-date-card', () => ({
  BillingDateCard: () => <div data-testid="billing-date-card" />,
}));

vi.mock('../credit-progress-bar', () => ({
  CreditCard: ({ onBuyMore }: { onBuyMore: () => void }) => (
    <button type="button" data-testid="credit-card" onClick={onBuyMore}>
      Buy more
    </button>
  ),
}));

vi.mock('../plan-comparison-grid', () => ({
  PlanComparisonGrid: () => <div data-testid="plan-comparison-grid" />,
}));

vi.mock('../top-up-dialog', () => ({
  TopUpDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="top-up-dialog" /> : null,
}));

import { useUsageDashboard } from '../hooks/use-billing.js';
import type { TierId } from '../plan-comparison-grid';
import { UsageDashboard, UsageDashboardView } from '../usage-dashboard';

type Parsed = NonNullable<React.ComponentProps<typeof UsageDashboardView>['parsed']>;

function makeParsed(override: Partial<Parsed> = {}): Parsed {
  return {
    subscription: {
      tier: 'PRO',
      status: 'ACTIVE',
      trialEnd: null,
      currentPeriodEnd: '2026-06-01',
    },
    credits: { balance: 80, allowance: 100, used: 20, tier: 'PRO' },
    activeContractors: 5,
    includedSeats: 10,
    planConfig: { tiers: [{ id: 'PRO', seatPriceMinor: 1500 }] },
    ...override,
  } as Parsed;
}

function mockDashboard(state: {
  isLoading?: boolean;
  isError?: boolean;
  data?: Parsed | null;
  refetch?: () => void;
}) {
  vi.mocked(useUsageDashboard).mockReturnValue({
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
    data: state.data ?? null,
    refetch: state.refetch ?? mockRefetch,
  } as ReturnType<typeof useUsageDashboard>);
}

describe('UsageDashboard (wired)', () => {
  it('renders loading skeleton when isLoading is true', () => {
    mockDashboard({ isLoading: true, data: null });
    const { container } = render(<UsageDashboard />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('shows error state with retry button', async () => {
    const refetch = vi.fn();
    mockDashboard({ isError: true, data: null, refetch });
    const { user } = setup(<UsageDashboard />);
    expect(screen.getByText('Failed to load billing data')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('renders nothing when not loading, not error, and parsed is null', () => {
    mockDashboard({ data: null });
    const { container } = render(<UsageDashboard />);
    expect(container.innerHTML).toBe('');
  });
});

describe('UsageDashboardView (presentational)', () => {
  it('shows no subscription state when subscription is null', () => {
    const parsed = makeParsed({
      subscription: null as unknown as Parsed['subscription'],
    });
    render(<UsageDashboardView parsed={parsed} currentTier={null} />);
    expect(screen.getByText('No active subscription')).toBeInTheDocument();
    expect(screen.getByText('Choose a plan')).toBeInTheDocument();
  });

  it('renders all KPI cards when subscription is present', () => {
    render(<UsageDashboardView parsed={makeParsed()} currentTier={'PRO' as TierId} />);
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
    expect(screen.getByTestId('seat-count-card')).toBeInTheDocument();
    expect(screen.getByTestId('billing-date-card')).toBeInTheDocument();
    expect(screen.getByTestId('plan-comparison-grid')).toBeInTheDocument();
  });

  it('renders OCR Credits card', () => {
    render(<UsageDashboardView parsed={makeParsed()} currentTier={'PRO' as TierId} />);
    expect(screen.getByTestId('credit-card')).toBeInTheDocument();
  });

  it('opens top-up dialog when buy-more is clicked', async () => {
    const { user } = setup(
      <UsageDashboardView
        parsed={makeParsed({
          credits: { balance: 5, allowance: 100, used: 95, tier: 'PRO' },
        })}
        currentTier={'PRO' as TierId}
      />,
    );
    expect(screen.queryByTestId('top-up-dialog')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('credit-card'));
    expect(screen.getByTestId('top-up-dialog')).toBeInTheDocument();
  });

  it('renders the trial badge for TRIALING status', () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    render(
      <UsageDashboardView
        parsed={makeParsed({
          subscription: {
            tier: 'PRO',
            status: 'TRIALING',
            trialEnd: futureDate,
            currentPeriodEnd: null,
            cancelAt: null,
          },
        })}
        currentTier={'PRO' as TierId}
      />,
    );
    expect(screen.getByText('Trial')).toBeInTheDocument();
  });

  it('renders Past due badge for PAST_DUE status', () => {
    render(
      <UsageDashboardView
        parsed={makeParsed({
          subscription: {
            tier: 'PRO',
            status: 'PAST_DUE',
            trialEnd: null,
            currentPeriodEnd: '2026-06-01',
            cancelAt: null,
          },
        })}
        currentTier={'PRO' as TierId}
      />,
    );
    expect(screen.getByText('Past due')).toBeInTheDocument();
  });
});
