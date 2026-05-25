/**
 * Web-vite port of apps/web/src/components/billing/__tests__/usage-dashboard.test.tsx.
 *
 * UsageDashboard is now a pure presentational component. Container
 * (`usage-dashboard-container.tsx`) owns the tRPC query, parsing, and
 * tier derivation. Child cards / grid / dialog are mocked to keep
 * assertions tight against the dashboard's branching logic.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';

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

vi.mock('../top-up-dialog-container', () => ({
  TopUpDialogContainer: ({ open }: { open: boolean }) =>
    open ? <div data-testid="top-up-dialog" /> : null,
}));

import type { TierId } from '../plan-comparison-grid';
import { UsageDashboard } from '../usage-dashboard';

type Parsed = NonNullable<React.ComponentProps<typeof UsageDashboard>['parsed']>;

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

interface RenderArgs {
  isLoading?: boolean;
  isError?: boolean;
  refetch?: () => void;
  parsed?: Parsed | null;
  currentTier?: TierId | null;
}

function renderDashboard(args: RenderArgs = {}) {
  return render(
    <UsageDashboard
      isLoading={args.isLoading ?? false}
      isError={args.isError ?? false}
      refetch={args.refetch ?? vi.fn()}
      parsed={args.parsed === undefined ? makeParsed() : args.parsed}
      currentTier={args.currentTier ?? 'PRO'}
    />,
  );
}

describe('UsageDashboard (web-vite)', () => {
  it('renders loading skeleton when isLoading is true', () => {
    const { container } = renderDashboard({ isLoading: true, parsed: null });
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('shows error state with retry button', async () => {
    const refetch = vi.fn();
    const { user } = setup(
      <UsageDashboard
        isLoading={false}
        isError
        refetch={refetch}
        parsed={null}
        currentTier={null}
      />,
    );
    expect(screen.getByText('Failed to load billing data')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('renders nothing when not loading, not error, and parsed is null', () => {
    const { container } = renderDashboard({ parsed: null });
    expect(container.innerHTML).toBe('');
  });

  it('shows no subscription state when subscription is null', () => {
    const parsed = makeParsed({
      subscription: null as unknown as Parsed['subscription'],
    });
    renderDashboard({ parsed, currentTier: null });
    expect(screen.getByText('No active subscription')).toBeInTheDocument();
    expect(screen.getByText('Choose a plan')).toBeInTheDocument();
  });

  it('renders all KPI cards when subscription is present', () => {
    renderDashboard();
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
    expect(screen.getByTestId('seat-count-card')).toBeInTheDocument();
    expect(screen.getByTestId('billing-date-card')).toBeInTheDocument();
    expect(screen.getByTestId('plan-comparison-grid')).toBeInTheDocument();
  });

  it('renders OCR Credits card', () => {
    renderDashboard();
    expect(screen.getByTestId('credit-card')).toBeInTheDocument();
  });

  it('opens top-up dialog when buy-more is clicked', async () => {
    const { user } = setup(
      <UsageDashboard
        isLoading={false}
        isError={false}
        refetch={vi.fn()}
        parsed={makeParsed({
          credits: { balance: 5, allowance: 100, used: 95, tier: 'PRO' },
        })}
        currentTier="PRO"
      />,
    );
    expect(screen.queryByTestId('top-up-dialog')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('credit-card'));
    expect(screen.getByTestId('top-up-dialog')).toBeInTheDocument();
  });

  it('renders the trial badge for TRIALING status', () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    renderDashboard({
      parsed: makeParsed({
        subscription: {
          tier: 'PRO',
          status: 'TRIALING',
          trialEnd: futureDate,
          currentPeriodEnd: null,
          cancelAt: null,
        },
      }),
    });
    expect(screen.getByText('Trial')).toBeInTheDocument();
  });

  it('renders Past due badge for PAST_DUE status', () => {
    renderDashboard({
      parsed: makeParsed({
        subscription: {
          tier: 'PRO',
          status: 'PAST_DUE',
          trialEnd: null,
          currentPeriodEnd: '2026-06-01',
          cancelAt: null,
        },
      }),
    });
    expect(screen.getByText('Past due')).toBeInTheDocument();
  });
});
