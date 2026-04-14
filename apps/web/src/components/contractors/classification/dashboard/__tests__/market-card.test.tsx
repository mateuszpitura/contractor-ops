// ---------------------------------------------------------------------------
// Phase 60 · Plan 04 · CLASS-10 — MarketCard tests (VALIDATION 60-04-07).
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/trpc/init', () => ({
  trpc: {
    useUtils: () => ({
      classificationDashboard: { invalidate: vi.fn() },
    }),
    classificationDashboard: {
      coverageByMarket: {
        useQuery: (_input: unknown) => ({ data: { completed: 3, total: 5 }, isLoading: false }),
      },
      riskDistributionByMarket: {
        useQuery: (_input: unknown) => ({
          data: { counts: { safe: 2, warning: 1, critical: 0 }, totalCompleted: 3 },
          isLoading: false,
        }),
      },
      overdueByMarket: {
        useQuery: (_input: unknown) => ({ data: { count: 0, items: [] }, isLoading: false }),
      },
      activeAlertsByMarket: {
        useQuery: (input: { market: 'GB' | 'DE' }) =>
          input.market === 'GB'
            ? { data: { openReassessmentTriggers: 1 }, isLoading: false }
            : {
                data: {
                  economicBands: { warning: 1, critical: 0 },
                  drvExpiringWithin90d: 0,
                },
                isLoading: false,
              },
      },
      exportMarketCsv: {
        useMutation: (opts?: Record<string, unknown>) => ({
          mutate: vi.fn(),
          status: 'idle' as const,
          ...opts,
        }),
      },
    },
  },
}));

import { render, screen } from '@/test/test-utils';
import { MarketCard } from '../market-card';

describe('MarketCard', () => {
  it('renders GB title from i18n', () => {
    render(<MarketCard market="GB" />);
    expect(screen.getByTestId('market-card-gb')).toBeInTheDocument();
    expect(screen.getByText(/UK — IR35/i)).toBeInTheDocument();
  });

  it('renders DE title from i18n', () => {
    render(<MarketCard market="DE" />);
    expect(screen.getByTestId('market-card-de')).toBeInTheDocument();
    expect(screen.getByText(/Germany — Scheinselbständigkeit/i)).toBeInTheDocument();
  });

  it('renders 4 tiles for the given market', () => {
    render(<MarketCard market="GB" />);
    expect(screen.getByTestId('coverage-tile')).toBeInTheDocument();
    expect(screen.getByTestId('risk-distribution-tile')).toBeInTheDocument();
    expect(screen.getByTestId('overdue-reassessments-tile')).toBeInTheDocument();
    expect(screen.getByTestId('active-alerts-tile-gb')).toBeInTheDocument();
  });

  it('renders download CSV CTA scoped to the given market', () => {
    render(<MarketCard market="DE" />);
    expect(screen.getByTestId('download-csv-de')).toBeInTheDocument();
  });
});
