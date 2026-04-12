import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { ReconciliationCard } from '../reconciliation-card';

vi.mock('../deviation-flag', () => ({
  DeviationFlag: ({ deviationPercent }: { deviationPercent: number }) => (
    <span data-testid="deviation-flag">{deviationPercent}%</span>
  ),
}));

const baseReconciliation = {
  approvedMinutes: 9600, // 160h
  rateValueMinor: 15000, // 150 PLN/h
  rateType: 'HOURLY',
  hoursPerDay: 8,
  expectedAmountMinor: 2400000, // 24,000 PLN
  invoicedAmountMinor: 2500000, // 25,000 PLN
  deviationMinor: 100000,
  deviationPercent: 4.17,
  withinThreshold: true,
  thresholdPercent: 10,
};

describe('ReconciliationCard', () => {
  it('renders heading', () => {
    render(<ReconciliationCard reconciliation={baseReconciliation} />);
    expect(screen.getByText('Time Reconciliation')).toBeInTheDocument();
  });

  it('renders approved hours', () => {
    render(<ReconciliationCard reconciliation={baseReconciliation} />);
    // 9600 min = 160h
    expect(screen.getByText('160h')).toBeInTheDocument();
  });

  it('renders stat labels', () => {
    render(<ReconciliationCard reconciliation={baseReconciliation} />);
    expect(screen.getByText('Approved Hours')).toBeInTheDocument();
    expect(screen.getByText('Expected Amount')).toBeInTheDocument();
    expect(screen.getByText('Invoiced Amount')).toBeInTheDocument();
  });

  it('renders deviation flag', () => {
    render(<ReconciliationCard reconciliation={baseReconciliation} />);
    expect(screen.getByTestId('deviation-flag')).toHaveTextContent('4.17%');
  });

  it('applies green border for within-threshold deviation', () => {
    const { container } = render(<ReconciliationCard reconciliation={baseReconciliation} />);
    const card = container.querySelector("[data-slot='card']") ?? container.firstElementChild;
    expect(card?.className).toContain('green');
  });

  it('applies destructive border for high deviation', () => {
    const { container } = render(
      <ReconciliationCard
        reconciliation={{
          ...baseReconciliation,
          deviationPercent: 25,
          thresholdPercent: 10,
        }}
      />,
    );
    const card = container.querySelector("[data-slot='card']") ?? container.firstElementChild;
    expect(card?.className).toContain('destructive');
  });

  it('applies amber border for moderate deviation', () => {
    const { container } = render(
      <ReconciliationCard
        reconciliation={{
          ...baseReconciliation,
          deviationPercent: 15,
          thresholdPercent: 10,
        }}
      />,
    );
    const card = container.querySelector("[data-slot='card']") ?? container.firstElementChild;
    expect(card?.className).toContain('amber');
  });
});
