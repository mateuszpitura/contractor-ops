import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { WhtSummaryCard } from '../wht-summary-card';

vi.mock('@/lib/format-currency', () => ({
  formatMinorUnits: (minor: number) => (minor / 100).toFixed(2),
}));

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    tax: {
      generateWhtCertificate: {
        mutationOptions: (opts: Record<string, unknown>) => ({ mutationFn: vi.fn(), ...opts }),
      },
    },
  },
}));

const items = [
  {
    id: 'item-1',
    amountMinor: 100000,
    grossAmountMinor: 100000,
    whtAmountMinor: 15000,
    whtRate: 15,
    whtTreatyApplied: true,
    currency: 'SAR',
  },
  {
    id: 'item-2',
    amountMinor: 50000,
    grossAmountMinor: 50000,
    whtAmountMinor: 7500,
    whtRate: 15,
    whtTreatyApplied: false,
    currency: 'SAR',
  },
  {
    id: 'item-3',
    amountMinor: 30000,
    grossAmountMinor: 30000,
    whtAmountMinor: 0,
    whtRate: 0,
    whtTreatyApplied: false,
    currency: 'SAR',
  },
];

describe('WhtSummaryCard', () => {
  it('renders nothing when no items have WHT', () => {
    const noWhtItems = [{ ...(items[2] ?? items[0]) }];
    const { container } = render(<WhtSummaryCard paymentRunId="run-1" items={noWhtItems} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the card title', () => {
    render(<WhtSummaryCard paymentRunId="run-1" items={items} />);
    expect(screen.getByText('Withholding Tax Summary')).toBeInTheDocument();
  });

  it('renders Gross Total, WHT Withheld, and Net Payable labels', () => {
    render(<WhtSummaryCard paymentRunId="run-1" items={items} />);
    expect(screen.getByText('Gross Total')).toBeInTheDocument();
    expect(screen.getByText('WHT Withheld')).toBeInTheDocument();
    expect(screen.getByText('Net Payable')).toBeInTheDocument();
  });

  it('displays correct WHT item count', () => {
    render(<WhtSummaryCard paymentRunId="run-1" items={items} />);
    expect(screen.getByText(/Items with WHT: 2 of 3/)).toBeInTheDocument();
  });

  it('displays treaty rates applied badge when treaties exist', () => {
    render(<WhtSummaryCard paymentRunId="run-1" items={items} />);
    expect(screen.getByText(/Treaty rates applied: 1/)).toBeInTheDocument();
  });

  it('renders Generate Certificates button', () => {
    render(<WhtSummaryCard paymentRunId="run-1" items={items} />);
    expect(screen.getByRole('button', { name: /generate certificates/i })).toBeInTheDocument();
  });
});
