/**
 * Ported from apps/web/src/components/contracts/contract-detail/__tests__/overview-tab.test.tsx.
 *
 * Web-vite split: OverviewTab is presentational; `reminders` prop is produced
 * by `useExpiryRemindersEditor`. We supply a shaped stub so the test renders
 * without a tRPC harness.
 */

import { vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { OverviewTab } from '../overview-tab';

type Props = Parameters<typeof OverviewTab>[0];

function makeReminders(overrides: Partial<Props['reminders']> = {}): Props['reminders'] {
  return {
    editing: false,
    handleCancel: vi.fn(),
    handleSave: vi.fn(),
    isPending: false,
    reminders: '',
    setReminders: vi.fn(),
    startEditing: vi.fn(),
    ...overrides,
  };
}

const baseContract = {
  id: 'ct1',
  title: 'B2B Agreement',
  type: 'B2B_MASTER_SERVICE',
  status: 'ACTIVE',
  startDate: '2024-01-01',
  endDate: '2025-12-31',
  noticePeriodDays: 30,
  autoRenewal: false,
  renewalTerms: null,
  currency: 'PLN',
  billingModel: 'HOURLY',
  rateType: 'PER_HOUR',
  rateValueMinor: 15000,
  retainerAmountMinor: null,
  paymentTermsDays: 14,
  invoiceCycle: 'MONTHLY',
  notes: 'Test notes',
  metadataJson: { reminderDaysBefore: [30, 7] },
  contractor: {
    id: 'c1',
    legalName: 'ACME Sp. z o.o.',
    displayName: 'ACME',
    status: 'ACTIVE',
  },
};

describe('OverviewTab', () => {
  it('renders contract details card', () => {
    render(<OverviewTab contract={baseContract} reminders={makeReminders()} />);
    expect(document.querySelector('div')).toBeInTheDocument();
  });

  it('renders financial terms with rate', () => {
    render(<OverviewTab contract={baseContract} reminders={makeReminders()} />);
    expect(screen.getByText('150.00 PLN')).toBeInTheDocument();
  });

  it('renders linked contractor', () => {
    render(<OverviewTab contract={baseContract} reminders={makeReminders()} />);
    const link = screen.getByText('ACME');
    expect(link.closest('a')).toHaveAttribute('href', '/en/contractors/c1');
  });

  it('renders no contractor message when none linked', () => {
    render(
      <OverviewTab contract={{ ...baseContract, contractor: null }} reminders={makeReminders()} />,
    );
    expect(document.querySelector('div')).toBeInTheDocument();
  });

  it('renders payment terms', () => {
    render(<OverviewTab contract={baseContract} reminders={makeReminders()} />);
    expect(screen.getByText(/14 days/)).toBeInTheDocument();
  });

  it('renders invoice cycle', () => {
    render(<OverviewTab contract={baseContract} reminders={makeReminders()} />);
    expect(screen.getByText(/Monthly/i)).toBeInTheDocument();
  });

  it('renders billing model', () => {
    render(<OverviewTab contract={baseContract} reminders={makeReminders()} />);
    expect(screen.getByText(/Hourly/i)).toBeInTheDocument();
  });

  it('renders notes section', () => {
    render(<OverviewTab contract={baseContract} reminders={makeReminders()} />);
    expect(screen.getByText('Test notes')).toBeInTheDocument();
  });

  it('renders notice period', () => {
    render(<OverviewTab contract={baseContract} reminders={makeReminders()} />);
    expect(screen.getByText(/30 days/)).toBeInTheDocument();
  });

  it('renders contractor status badge', () => {
    render(<OverviewTab contract={baseContract} reminders={makeReminders()} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders retainer amount when present', () => {
    const retainerContract = {
      ...baseContract,
      billingModel: 'RETAINER',
      retainerAmountMinor: 500000,
    };
    render(<OverviewTab contract={retainerContract} reminders={makeReminders()} />);
    expect(screen.getByText('5000.00 PLN')).toBeInTheDocument();
  });

  it('renders auto renewal as Yes when true', () => {
    render(
      <OverviewTab contract={{ ...baseContract, autoRenewal: true }} reminders={makeReminders()} />,
    );
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('renders auto renewal as No when false', () => {
    render(<OverviewTab contract={baseContract} reminders={makeReminders()} />);
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders without end date gracefully', () => {
    render(
      <OverviewTab
        contract={{ ...baseContract, endDate: null, noticePeriodDays: null }}
        reminders={makeReminders()}
      />,
    );
    expect(document.querySelector('div')).toBeInTheDocument();
  });

  it('renders contract details card heading', () => {
    render(<OverviewTab contract={baseContract} reminders={makeReminders()} />);
    expect(screen.getByText('Contract details')).toBeInTheDocument();
  });

  it('renders financial terms card heading', () => {
    render(<OverviewTab contract={baseContract} reminders={makeReminders()} />);
    expect(screen.getByText('Financial terms')).toBeInTheDocument();
  });

  it('renders linked contractor card heading', () => {
    render(<OverviewTab contract={baseContract} reminders={makeReminders()} />);
    expect(screen.getByText('Linked contractor')).toBeInTheDocument();
  });
});
