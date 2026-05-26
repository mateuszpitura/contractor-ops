/**
 * Step-10 port. Presentational review view fed by shaped timesheet stub.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '../../../test/test-utils.js';
import { ContractorTimesheetReview } from '../contractor-timesheet-review.js';

function makeTimesheet(
  over: Partial<Parameters<typeof ContractorTimesheetReview>[0]['timesheet']> = {},
) {
  return {
    id: 't-1',
    weekStartDate: '2026-04-13T00:00:00Z',
    totalMinutes: 60 * 12,
    status: 'SUBMITTED' as const,
    rejectionReason: null,
    entries: [
      {
        id: 'e1',
        contractId: 'ct-1',
        entryDate: '2026-04-13',
        minutes: 60 * 4,
        description: 'Working on payroll',
        source: 'MANUAL' as const,
        createdAt: '2026-04-13T09:00:00Z',
        contract: { id: 'ct-1', title: 'Acme Web Dev' },
      },
      {
        id: 'e2',
        contractId: 'ct-1',
        entryDate: '2026-04-15',
        minutes: 60 * 8,
        description: null,
        source: 'JIRA' as const,
        createdAt: '2026-04-15T09:00:00Z',
        contract: { id: 'ct-1', title: 'Acme Web Dev' },
      },
    ],
    contractor: { id: 'c-1', legalName: 'John Doe', email: 'john@example.test' },
    ...over,
  };
}

describe('ContractorTimesheetReview (web-vite)', () => {
  it('renders the contractor name, total hours, and project rows', () => {
    render(
      <ContractorTimesheetReview
        timesheet={makeTimesheet()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Acme Web Dev')).toBeInTheDocument();
    expect(screen.getAllByText(/12/).length).toBeGreaterThan(0);
  });

  it('renders Approve and Reject actions for SUBMITTED state', () => {
    render(
      <ContractorTimesheetReview
        timesheet={makeTimesheet()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Approve Timesheet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reject$/i })).toBeInTheDocument();
  });

  it('omits action buttons when status is APPROVED', () => {
    render(
      <ContractorTimesheetReview
        timesheet={makeTimesheet({ status: 'APPROVED' })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Approve Timesheet/i })).not.toBeInTheDocument();
  });

  it('invokes onApprove when the approve button is clicked', async () => {
    const onApprove = vi.fn();
    const { user } = setup(
      <ContractorTimesheetReview
        timesheet={makeTimesheet()}
        onApprove={onApprove}
        onReject={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Approve Timesheet/i }));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('invokes onBack when the back link is clicked', async () => {
    const onBack = vi.fn();
    const { user } = setup(
      <ContractorTimesheetReview
        timesheet={makeTimesheet()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onBack={onBack}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Back to Queue/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
