/**
 * web-vite port. Tests the pure view `MarketCardView` so we don't have to
 * mock the multi-query hook. The download-csv container is mocked because it
 * pulls in a tRPC export-mutation.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../download-csv-button.js', () => ({
  DownloadCsvButton: ({ market }: { market: 'GB' | 'DE' }) => (
    <button type="button" data-testid={`download-csv-${market.toLowerCase()}`}>
      Download CSV
    </button>
  ),
}));

import { render, screen } from '../../../../../test/test-utils.js';
import { MarketCardView } from '../market-card.js';

type MarketCardViewParams = Parameters<typeof MarketCardView>[0];

function makeData<K extends 'coverage' | 'riskDistribution' | 'overdue' | 'activeAlerts'>(
  value: unknown,
): MarketCardViewParams[K] {
  return { data: value, isLoading: false, isPending: false } as unknown as MarketCardViewParams[K];
}

const baseProps = {
  coverage: makeData<'coverage'>({ completed: 3, total: 5 }),
  riskDistribution: makeData<'riskDistribution'>({
    counts: { safe: 2, warning: 1, critical: 0 },
    totalCompleted: 3,
  }),
  overdue: makeData<'overdue'>({ count: 0, items: [] as unknown[] }),
};

describe('MarketCardView', () => {
  it('renders GB title from i18n', () => {
    render(
      <MarketCardView
        market="GB"
        {...baseProps}
        activeAlerts={makeData<'activeAlerts'>({ openReassessmentTriggers: 1 })}
      />,
    );
    expect(screen.getByTestId('market-card-gb')).toBeInTheDocument();
    expect(screen.getByText(/UK — IR35/i)).toBeInTheDocument();
  });

  it('renders DE title from i18n', () => {
    render(
      <MarketCardView
        market="DE"
        {...baseProps}
        activeAlerts={makeData<'activeAlerts'>({
          economicBands: { warning: 1, critical: 0 },
          drvExpiringWithin90d: 0,
        })}
      />,
    );
    expect(screen.getByTestId('market-card-de')).toBeInTheDocument();
    expect(screen.getByText(/Germany — Scheinselbständigkeit/i)).toBeInTheDocument();
  });

  it('renders 4 tiles for the given market', () => {
    render(
      <MarketCardView
        market="GB"
        {...baseProps}
        activeAlerts={makeData<'activeAlerts'>({ openReassessmentTriggers: 1 })}
      />,
    );
    expect(screen.getByTestId('coverage-tile')).toBeInTheDocument();
    expect(screen.getByTestId('risk-distribution-tile')).toBeInTheDocument();
    expect(screen.getByTestId('overdue-reassessments-tile')).toBeInTheDocument();
    expect(screen.getByTestId('active-alerts-tile-gb')).toBeInTheDocument();
  });

  it('renders download CSV CTA scoped to the given market', () => {
    render(
      <MarketCardView
        market="DE"
        {...baseProps}
        activeAlerts={makeData<'activeAlerts'>({
          economicBands: { warning: 0, critical: 0 },
          drvExpiringWithin90d: 0,
        })}
      />,
    );
    expect(screen.getByTestId('download-csv-de')).toBeInTheDocument();
  });
});
