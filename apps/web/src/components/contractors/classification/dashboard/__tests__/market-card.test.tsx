// ---------------------------------------------------------------------------
// Phase 60 · Plan 04 · CLASS-10 — MarketCard tests (VALIDATION 60-04-07).
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (opts: { queryKey?: unknown[] }) => {
      const key = (opts?.queryKey?.[0] ?? []) as unknown[];
      const proc = String(key[1] ?? '');
      switch (proc) {
        case 'coverageByMarket':
          return { data: { completed: 3, total: 5 }, isLoading: false };
        case 'riskDistributionByMarket':
          return {
            data: { counts: { safe: 2, warning: 1, critical: 0 }, totalCompleted: 3 },
            isLoading: false,
          };
        case 'overdueByMarket':
          return { data: { count: 0, items: [] }, isLoading: false };
        case 'activeAlertsByMarket': {
          const input = key[2] as { market?: 'GB' | 'DE' } | undefined;
          return input?.market === 'GB'
            ? { data: { openReassessmentTriggers: 1 }, isLoading: false }
            : {
                data: {
                  economicBands: { warning: 1, critical: 0 },
                  drvExpiringWithin90d: 0,
                },
                isLoading: false,
              };
        }
        default:
          return { data: undefined, isLoading: false };
      }
    },
    useMutation: () => ({
      mutate: vi.fn(),
      status: 'idle' as const,
      isPending: false,
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    classificationDashboard: {
      coverageByMarket: {
        queryOptions: (input: { market: 'GB' | 'DE' }) => ({
          queryKey: [['classificationDashboard', 'coverageByMarket'], input],
        }),
      },
      riskDistributionByMarket: {
        queryOptions: (input: { market: 'GB' | 'DE' }) => ({
          queryKey: [['classificationDashboard', 'riskDistributionByMarket'], input],
        }),
      },
      overdueByMarket: {
        queryOptions: (input: { market: 'GB' | 'DE' }) => ({
          queryKey: [['classificationDashboard', 'overdueByMarket'], input],
        }),
      },
      activeAlertsByMarket: {
        queryOptions: (input: { market: 'GB' | 'DE' }) => ({
          queryKey: [['classificationDashboard', 'activeAlertsByMarket'], input],
        }),
      },
      exportMarketCsv: {
        mutationOptions: () => ({}),
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
