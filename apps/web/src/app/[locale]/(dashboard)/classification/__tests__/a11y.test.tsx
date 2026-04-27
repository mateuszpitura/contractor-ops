// ---------------------------------------------------------------------------
// Phase 60 · CLASS-10 — dashboard a11y contract tests (WCAG 2.2 AA).
// ---------------------------------------------------------------------------
//
// Plan 60-04 originally specified an axe-core automated assertion. axe-core
// is NOT currently a dependency in this repo and the plan forbids introducing
// new npm dependencies (UI-SPEC Registry Safety). These tests instead
// exercise the specific WCAG 2.2 AA contracts the dashboard MUST uphold via
// testing-library + explicit ARIA assertions — the same properties axe-core
// would assert against (role, aria-label, aria-live, name accessibility,
// semantic headings). Adding axe-core is tracked in the SUMMARY under
// deferred items.

import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (opts: { queryKey?: unknown[] }) => {
      const key = JSON.stringify(opts?.queryKey ?? []);
      if (key.includes('globalHeader')) {
        return {
          data: {
            totalContractors: 4,
            totalActiveEngagements: 2,
            lastScannedAt: new Date('2026-04-10T00:00:00Z'),
          },
          isLoading: false,
        };
      }
      if (key.includes('coverageByMarket')) {
        return { data: { completed: 2, total: 4 }, isLoading: false };
      }
      if (key.includes('riskDistributionByMarket')) {
        return {
          data: { counts: { safe: 2, warning: 1, critical: 1 }, totalCompleted: 4 },
          isLoading: false,
        };
      }
      if (key.includes('overdueByMarket')) {
        return { data: { count: 0, items: [] }, isLoading: false };
      }
      if (key.includes('activeAlertsByMarket')) {
        const isGb = key.includes('"GB"');
        return isGb
          ? { data: { openReassessmentTriggers: 1 }, isLoading: false }
          : {
              data: {
                economicBands: { warning: 1, critical: 0 },
                drvExpiringWithin90d: 0,
              },
              isLoading: false,
            };
      }
      return { data: undefined, isLoading: false };
    },
    useMutation: (opts?: Record<string, unknown>) => ({
      mutate: vi.fn(),
      status: 'idle' as const,
      ...opts,
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn(async () => undefined) }),
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

import { render, screen } from '@/test/test-utils';
import ClassificationDashboardPage from '../page';

describe('Classification dashboard page — a11y contract (60-04-08)', () => {
  it("stacked-bar tile has role='img' and an aria-label summarising segments", () => {
    render(<ClassificationDashboardPage />);
    const bars = screen.getAllByTestId('risk-distribution-bar');
    // Two market cards → two stacked bars.
    expect(bars).toHaveLength(2);
    for (const bar of bars) {
      expect(bar.getAttribute('role')).toBe('img');
      const label = bar.getAttribute('aria-label') ?? '';
      expect(label).toMatch(/%/);
      expect(label.length).toBeGreaterThan(10);
    }
  });

  it("refresh button exposes an aria-live='polite' region for its status update", () => {
    render(<ClassificationDashboardPage />);
    const announcement = screen.getByTestId('refresh-announcement');
    expect(announcement.getAttribute('aria-live')).toBe('polite');
    expect(announcement.getAttribute('role')).toBe('status');
  });

  it('renders exactly one H1 with the page title (WCAG 2.4.6 heading hierarchy)', () => {
    render(<ClassificationDashboardPage />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
  });

  it('every interactive control on the page has an accessible name', () => {
    render(<ClassificationDashboardPage />);
    // Refresh button + two CSV download buttons.
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const btn of buttons) {
      const label =
        btn.getAttribute('aria-label') ||
        btn.getAttribute('aria-labelledby') ||
        btn.textContent?.trim();
      expect(label).toBeTruthy();
    }
  });

  it('uses semantic colour + text (never colour-alone per WCAG 1.4.1)', () => {
    // Risk buckets always carry a visible label in the tooltip trigger's
    // aria-label and in the outer bar's aria-label — even a fully colour-
    // blind user receives the safe/warning/critical information.
    render(<ClassificationDashboardPage />);
    const bars = screen.getAllByTestId('risk-distribution-bar');
    const labels = bars.map(b => b.getAttribute('aria-label') ?? '');
    expect(labels.every(l => /safe/i.test(l) && /warning/i.test(l) && /critical/i.test(l))).toBe(
      true,
    );
  });
});
