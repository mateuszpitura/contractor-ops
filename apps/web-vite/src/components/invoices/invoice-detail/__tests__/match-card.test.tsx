import { render, screen } from '@/test/test-utils';

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ role: 'admin' }),
}));

import { MatchCard } from '../match-card';

function createInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    matchStatus: 'MATCHED',
    contractorId: 'ctr-1',
    contractId: 'con-1',
    totalMinor: 500000,
    currency: 'PLN',
    flagsJson: null,
    contractor: {
      id: 'ctr-1',
      legalName: 'Acme Corp',
      taxId: '1234567890',
    },
    contract: {
      id: 'con-1',
      title: 'Dev Services',
      type: 'B2B',
      status: 'ACTIVE',
      rateValueMinor: 500000,
      currency: 'PLN',
    },
    matchResults: [
      {
        matchScore: 95,
        expectedAmountMinor: 500000,
        amountDeltaMinor: 0,
        amountDeltaPercent: 0,
        explanationJson: null,
        status: 'MATCHED',
      },
    ],
    ...overrides,
  } as Parameters<typeof MatchCard>[0]['invoice'];
}

describe('MatchCard', () => {
  it('renders heading for matched invoice', () => {
    render(<MatchCard invoice={createInvoice()} />);
    expect(screen.getByText('Matching')).toBeInTheDocument();
  });

  it('shows confidence label and score percentage', () => {
    render(<MatchCard invoice={createInvoice()} />);
    expect(screen.getByText('Match confidence')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('Strong match')).toBeInTheDocument();
  });

  it('renders amber dot + partial-match label for scores in 50-89', () => {
    const invoice = createInvoice({
      matchResults: [
        {
          matchScore: 65,
          expectedAmountMinor: 500000,
          amountDeltaMinor: 0,
          amountDeltaPercent: 0,
          explanationJson: null,
          status: 'MATCHED',
        },
      ],
    });
    const { container } = render(<MatchCard invoice={invoice} />);
    expect(container.querySelector('.bg-amber-500.rounded-full')).toBeInTheDocument();
    expect(screen.getByText('Partial match')).toBeInTheDocument();
  });

  it('renders red dot + weak-match label for scores < 50', () => {
    const invoice = createInvoice({
      matchResults: [
        {
          matchScore: 30,
          expectedAmountMinor: 500000,
          amountDeltaMinor: 0,
          amountDeltaPercent: 0,
          explanationJson: null,
          status: 'MATCHED',
        },
      ],
    });
    const { container } = render(<MatchCard invoice={invoice} />);
    expect(container.querySelector('.bg-red-500.rounded-full')).toBeInTheDocument();
    expect(screen.getByText('Weak match')).toBeInTheDocument();
  });

  it('renders contractor name as link with the contractor id', () => {
    render(<MatchCard invoice={createInvoice()} />);
    const link = screen.getByRole('link', { name: 'Acme Corp' });
    expect(link).toHaveAttribute('href', '/en/contractors/ctr-1');
  });

  it('renders contract title as link with the contract id', () => {
    render(<MatchCard invoice={createInvoice()} />);
    const link = screen.getByRole('link', { name: 'Dev Services' });
    expect(link).toHaveAttribute('href', '/en/contracts/con-1');
  });

  it('renders Expected / Actual / Deviation labels for matched results', () => {
    render(<MatchCard invoice={createInvoice()} />);
    expect(screen.getByText('Expected')).toBeInTheDocument();
    expect(screen.getByText('Actual')).toBeInTheDocument();
    expect(screen.getByText('Deviation')).toBeInTheDocument();
  });

  it('renders destructive colour for >10% deviation', () => {
    const invoice = createInvoice({
      matchResults: [
        {
          matchScore: 70,
          expectedAmountMinor: 500000,
          amountDeltaMinor: 100000,
          amountDeltaPercent: 20,
          explanationJson: null,
          status: 'MATCHED',
        },
      ],
    });
    const { container } = render(<MatchCard invoice={invoice} />);
    const deviationEl = container.querySelector('.text-destructive');
    expect(deviationEl).toBeInTheDocument();
    expect(deviationEl?.textContent).toContain('20.0%');
  });

  it('renders positive deviation with a plus sign', () => {
    const invoice = createInvoice({
      matchResults: [
        {
          matchScore: 80,
          expectedAmountMinor: 500000,
          amountDeltaMinor: 50000,
          amountDeltaPercent: 10,
          explanationJson: null,
          status: 'MATCHED',
        },
      ],
    });
    const { container } = render(<MatchCard invoice={invoice} />);
    const text = Array.from(container.querySelectorAll('.font-mono.font-medium'))
      .map(el => el.textContent ?? '')
      .join('');
    expect(text).toContain('+10.0%');
  });

  it('omits the deviation block when expectedAmountMinor is null', () => {
    const invoice = createInvoice({
      matchResults: [
        {
          matchScore: 90,
          expectedAmountMinor: null,
          amountDeltaMinor: null,
          amountDeltaPercent: null,
          explanationJson: null,
          status: 'MATCHED',
        },
      ],
    });
    render(<MatchCard invoice={invoice} />);
    expect(screen.queryByText('Expected')).not.toBeInTheDocument();
    expect(screen.queryByText('Deviation')).not.toBeInTheDocument();
  });

  it('shows the manual match badge for MANUALLY_CONFIRMED', () => {
    render(<MatchCard invoice={createInvoice({ matchStatus: 'MANUALLY_CONFIRMED' })} />);
    expect(screen.getByText('Manually matched')).toBeInTheDocument();
  });

  it('renders contract type badge', () => {
    render(<MatchCard invoice={createInvoice()} />);
    expect(screen.getByText('B2B')).toBeInTheDocument();
  });

  it('renders NO_ACTIVE_CONTRACT flag badge', () => {
    render(<MatchCard invoice={createInvoice({ flagsJson: ['NO_ACTIVE_CONTRACT'] })} />);
    expect(screen.getByText('No active contract found')).toBeInTheDocument();
  });

  it('filters out DUPLICATE_SUSPECTED from flag badges', () => {
    render(
      <MatchCard
        invoice={createInvoice({ flagsJson: ['DUPLICATE_SUSPECTED', 'NO_ACTIVE_CONTRACT'] })}
      />,
    );
    expect(screen.getByText('No active contract found')).toBeInTheDocument();
    expect(screen.queryByText(/DUPLICATE_SUSPECTED/)).not.toBeInTheDocument();
  });

  it('does not render an unknown flag badge', () => {
    render(<MatchCard invoice={createInvoice({ flagsJson: ['UNKNOWN_FLAG'] })} />);
    expect(screen.queryByText('UNKNOWN_FLAG')).not.toBeInTheDocument();
  });

  it('handles empty matchResults without crashing (score falls back to 0)', () => {
    render(<MatchCard invoice={createInvoice({ matchResults: [] })} />);
    expect(screen.getByText('Matching')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
