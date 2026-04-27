// ---------------------------------------------------------------------------
// Phase 60 · CLASS-10 — classification dashboard page smoke tests (60-04-07).
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from 'vitest';

const invalidateSpy = vi.fn(async () => undefined);
const csvMutate = vi.fn();

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (opts: { queryKey?: unknown[] }) => {
      const key = JSON.stringify(opts?.queryKey ?? []);
      if (key.includes('globalHeader')) {
        return {
          data: {
            totalContractors: 7,
            totalActiveEngagements: 5,
            lastScannedAt: new Date('2026-04-10T00:00:00Z'),
          },
          isLoading: false,
        };
      }
      if (key.includes('coverageByMarket')) {
        return { data: { completed: 3, total: 5 }, isLoading: false };
      }
      if (key.includes('riskDistributionByMarket')) {
        return {
          data: { counts: { safe: 2, warning: 1, critical: 0 }, totalCompleted: 3 },
          isLoading: false,
        };
      }
      if (key.includes('overdueByMarket')) {
        return { data: { count: 0, items: [] }, isLoading: false };
      }
      if (key.includes('activeAlertsByMarket')) {
        const isGb = key.includes('"GB"');
        return isGb
          ? { data: { openReassessmentTriggers: 0 }, isLoading: false }
          : {
              data: {
                economicBands: { warning: 0, critical: 0 },
                drvExpiringWithin90d: 0,
              },
              isLoading: false,
            };
      }
      return { data: undefined, isLoading: false };
    },
    useMutation: (opts?: Record<string, unknown>) => ({
      mutate: csvMutate,
      status: 'idle' as const,
      ...opts,
    }),
    useQueryClient: () => ({ invalidateQueries: invalidateSpy }),
  };
});

vi.mock('@/trpc/init', () => {
  const stub = (key: string) => ({
    queryOptions: (input?: unknown) => ({ queryKey: [key, input] }),
    mutationOptions: (opts?: Record<string, unknown>) => ({ mutationFn: vi.fn(), ...opts }),
    queryKey: () => [key],
  });
  return {
    trpc: {
      classificationDashboard: {
        globalHeader: stub('classificationDashboard.globalHeader'),
        coverageByMarket: stub('classificationDashboard.coverageByMarket'),
        riskDistributionByMarket: stub('classificationDashboard.riskDistributionByMarket'),
        overdueByMarket: stub('classificationDashboard.overdueByMarket'),
        activeAlertsByMarket: stub('classificationDashboard.activeAlertsByMarket'),
        exportMarketCsv: stub('classificationDashboard.exportMarketCsv'),
      },
    },
  };
});

import { render, screen, setup } from '@/test/test-utils';
import ClassificationDashboardPage from '../page';

describe('Classification dashboard page — composition (60-04-07)', () => {
  it('renders both market cards with 4 tiles each', () => {
    render(<ClassificationDashboardPage />);
    expect(screen.getByTestId('market-card-gb')).toBeInTheDocument();
    expect(screen.getByTestId('market-card-de')).toBeInTheDocument();
    // 2 coverage tiles + 2 risk distribution + 2 overdue + 1 gb alert + 1 de alert
    expect(screen.getAllByTestId('coverage-tile')).toHaveLength(2);
    expect(screen.getAllByTestId('risk-distribution-tile')).toHaveLength(2);
    expect(screen.getAllByTestId('overdue-reassessments-tile')).toHaveLength(2);
    expect(screen.getByTestId('active-alerts-tile-gb')).toBeInTheDocument();
    expect(screen.getByTestId('active-alerts-tile-de')).toBeInTheDocument();
  });

  it('renders the global header with totals', () => {
    render(<ClassificationDashboardPage />);
    expect(screen.getByTestId('classification-dashboard-global-header')).toBeInTheDocument();
    // 7 contractors, 5 active engagements
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders the page H1 from Classification.polish.dashboard namespace', () => {
    render(<ClassificationDashboardPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /Classification health/i }),
    ).toBeInTheDocument();
  });

  it('refresh button click invalidates classificationDashboard caches', async () => {
    invalidateSpy.mockClear();
    const { user } = setup(<ClassificationDashboardPage />);
    const button = screen.getByTestId('refresh-dashboard-button');
    await user.click(button);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('renders the CSV download CTA once per market', () => {
    render(<ClassificationDashboardPage />);
    expect(screen.getByTestId('download-csv-gb')).toBeInTheDocument();
    expect(screen.getByTestId('download-csv-de')).toBeInTheDocument();
  });
});
