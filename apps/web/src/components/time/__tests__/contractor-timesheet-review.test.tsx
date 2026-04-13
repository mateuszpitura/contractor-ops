import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { ContractorTimesheetReview } from '../contractor-timesheet-review';

vi.mock('../time-entry-status-badge', () => ({
  TimeEntryStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

vi.mock('../time-source-badge', () => ({
  TimeSourceBadge: ({ source }: { source: string }) => (
    <span data-testid="source-badge">{source}</span>
  ),
}));

vi.mock('../rejection-reason-dialog', () => ({
  RejectionReasonDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: (r: string) => void;
  }) =>
    open ? (
      <div data-testid="rejection-dialog">
        <button type="button" onClick={() => onConfirm('reason text')}>
          confirm-reject
        </button>
      </div>
    ) : null,
}));

const baseTimesheet = {
  id: 'ts-1',
  weekStartDate: '2026-01-06',
  totalMinutes: 2400,
  status: 'SUBMITTED' as const,
  entries: [
    {
      id: 'e-1',
      contractId: 'contract-1',
      entryDate: '2026-01-06',
      minutes: 480,
      description: 'Working on feature X',
      source: 'MANUAL' as const,
      contract: { id: 'contract-1', title: 'Project Alpha' },
    },
    {
      id: 'e-2',
      contractId: 'contract-1',
      entryDate: '2026-01-07',
      minutes: 480,
      description: null,
      source: 'CLOCKIFY' as const,
      contract: { id: 'contract-1', title: 'Project Alpha' },
    },
  ],
  contractor: {
    id: 'c-1',
    legalName: 'Test Contractor',
    email: 'test@test.com',
  },
};

const defaultProps = {
  timesheet: baseTimesheet,
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onBack: vi.fn(),
};

describe('ContractorTimesheetReview', () => {
  it('renders contractor name', () => {
    render(<ContractorTimesheetReview {...defaultProps} />);
    expect(screen.getByText('Test Contractor')).toBeInTheDocument();
  });

  it('renders total hours', () => {
    render(<ContractorTimesheetReview {...defaultProps} />);
    // 2400 min = 40h
    expect(screen.getAllByText('40h').length).toBeGreaterThan(0);
  });

  it('renders project name in grid', () => {
    render(<ContractorTimesheetReview {...defaultProps} />);
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<ContractorTimesheetReview {...defaultProps} />);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('SUBMITTED');
  });

  it('shows approve and reject buttons for SUBMITTED status', () => {
    render(<ContractorTimesheetReview {...defaultProps} />);
    expect(screen.getByText('Approve Timesheet')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('hides approve and reject for APPROVED status', () => {
    render(
      <ContractorTimesheetReview
        {...defaultProps}
        timesheet={{ ...baseTimesheet, status: 'APPROVED' }}
      />,
    );
    expect(screen.queryByText('Approve Timesheet')).not.toBeInTheDocument();
  });

  it('calls onApprove when approve clicked', async () => {
    const onApprove = vi.fn();
    const { user } = setup(<ContractorTimesheetReview {...defaultProps} onApprove={onApprove} />);
    await user.click(screen.getByText('Approve Timesheet'));
    expect(onApprove).toHaveBeenCalled();
  });

  it('calls onBack when back clicked', async () => {
    const onBack = vi.fn();
    const { user } = setup(<ContractorTimesheetReview {...defaultProps} onBack={onBack} />);
    await user.click(screen.getByText('Back to Queue'));
    expect(onBack).toHaveBeenCalled();
  });

  it('renders entries with descriptions', () => {
    render(<ContractorTimesheetReview {...defaultProps} />);
    expect(screen.getByText('Working on feature X')).toBeInTheDocument();
  });

  it('shows source badge for imported entries', () => {
    render(<ContractorTimesheetReview {...defaultProps} />);
    expect(screen.getAllByTestId('source-badge').length).toBeGreaterThan(0);
  });
});
