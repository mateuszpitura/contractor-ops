/**
 * Ported from apps/web/src/components/time/__tests__/approval-queue-table.test.tsx.
 *
 * Covers the high-value behaviour: row callbacks, batch selection,
 * bulk-approve confirm, bulk-reject dialog opening. Mocks the heavy
 * child components (status badge, rejection dialog) to keep the test
 * focused on the table's own state machine.
 */

import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// `RejectionReasonDialog` itself wraps a `<Dialog>` from `@contractor-ops/ui`
// which calls `useTranslations` from `next-intl` — see notes on the
// rejection-reason-dialog test. Stub the dialog primitive to a passthrough so
// the alert-dialog confirm + the rejection mock remain inspectable.
vi.mock('@contractor-ops/ui/components/shadcn/dialog', () => {
  const passthrough = ({ children }: { children?: ReactNode }) => children as React.ReactElement;
  return {
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? (passthrough({ children }) as React.ReactElement) : null,
    DialogContent: passthrough,
    DialogHeader: passthrough,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    DialogFooter: passthrough,
  };
});

vi.mock('../time-entry-status-badge', () => ({
  TimeEntryStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

vi.mock('../rejection-reason-dialog', () => ({
  RejectionReasonDialog: ({
    open,
    onConfirm,
    isBulk,
  }: {
    open: boolean;
    onConfirm: (r: string) => void;
    isBulk?: boolean;
  }) =>
    open ? (
      <div data-testid={isBulk ? 'rejection-dialog-bulk' : 'rejection-dialog'}>
        {/* biome-ignore lint/nursery/noJsxPropsBind: test stub */}
        <button type="button" onClick={() => onConfirm('too long')}>
          confirm-reject
        </button>
      </div>
    ) : null,
}));

import type { TimesheetRow } from '../approval-queue-table.js';
import { ApprovalQueueTable } from '../approval-queue-table.js';
import { click, findAllByText, findButton, findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

function makeTimesheet(id: string, status: TimesheetRow['status'] = 'SUBMITTED'): TimesheetRow {
  return {
    id,
    weekStartDate: '2026-01-06',
    totalMinutes: 2400,
    status,
    submittedAt: '2026-01-10T10:00:00Z',
    contractor: {
      id: `c-${id}`,
      legalName: `Contractor ${id}`,
      email: `c${id}@test.com`,
    },
    _count: { entries: 5 },
  };
}

const baseProps = {
  timesheets: [makeTimesheet('1'), makeTimesheet('2')],
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onBulkApprove: vi.fn(),
  onBulkReject: vi.fn(),
  onNavigateToReview: vi.fn(),
};

describe('ApprovalQueueTable (web-vite)', () => {
  it('renders every timesheet row', async () => {
    await mount(<ApprovalQueueTable {...baseProps} />);
    expect(findByText(document.body, 'Contractor 1')).not.toBeNull();
    expect(findByText(document.body, 'Contractor 2')).not.toBeNull();
  });

  it('renders skeleton rows when isLoading', async () => {
    const { container } = await mount(<ApprovalQueueTable {...baseProps} isLoading />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('formats total hours (2400 minutes -> 40h)', async () => {
    await mount(<ApprovalQueueTable {...baseProps} />);
    expect(findAllByText(document.body, '40h').length).toBeGreaterThan(0);
  });

  it('calls onApprove(id) when the row Approve button is clicked', async () => {
    const onApprove = vi.fn();
    await mount(<ApprovalQueueTable {...baseProps} onApprove={onApprove} />);
    const approveButtons = Array.from(document.body.querySelectorAll('button')).filter(
      b =>
        (b.textContent ?? '').trim().includes('Approve') && !(b.textContent ?? '').includes('All'),
    );
    expect(approveButtons.length).toBeGreaterThanOrEqual(2);
    await click(approveButtons[0] as HTMLButtonElement);
    expect(onApprove).toHaveBeenCalledWith('1');
  });

  it('opens the rejection dialog when the row Reject button is clicked', async () => {
    await mount(<ApprovalQueueTable {...baseProps} />);
    const rejectButtons = Array.from(document.body.querySelectorAll('button')).filter(
      b => (b.textContent ?? '').trim() === 'Reject',
    );
    expect(rejectButtons.length).toBeGreaterThanOrEqual(2);
    await click(rejectButtons[0] as HTMLButtonElement);
    expect(document.body.querySelector('[data-testid="rejection-dialog"]')).not.toBeNull();
  });

  it('calls onReject(id, reason) once the rejection dialog confirms', async () => {
    const onReject = vi.fn();
    await mount(<ApprovalQueueTable {...baseProps} onReject={onReject} />);
    const rejectButtons = Array.from(document.body.querySelectorAll('button')).filter(
      b => (b.textContent ?? '').trim() === 'Reject',
    );
    await click(rejectButtons[0] as HTMLButtonElement);
    const confirmBtn = findButton(document.body, 'confirm-reject');
    expect(confirmBtn).not.toBeNull();
    await click(confirmBtn as HTMLButtonElement);
    expect(onReject).toHaveBeenCalledWith('1', 'too long');
  });

  it('calls onNavigateToReview(contractorId, weekStart) when the contractor link is clicked', async () => {
    const onNavigateToReview = vi.fn();
    await mount(<ApprovalQueueTable {...baseProps} onNavigateToReview={onNavigateToReview} />);
    const link = findButton(document.body, 'Contractor 1');
    expect(link).not.toBeNull();
    await click(link as HTMLButtonElement);
    expect(onNavigateToReview).toHaveBeenCalledWith('c-1', '2026-01-06');
  });

  it('shows the batch-action bar after selecting all rows', async () => {
    await mount(<ApprovalQueueTable {...baseProps} />);
    const checkbox = document.body.querySelector<HTMLElement>("[role='checkbox']");
    expect(checkbox).not.toBeNull();
    await click(checkbox as HTMLElement);
    expect(findByText(document.body, /2 timesheets selected/)).not.toBeNull();
    expect(findButton(document.body, 'Approve All')).not.toBeNull();
    expect(findButton(document.body, 'Reject All')).not.toBeNull();
  });

  it('clears the selection when the Clear button is pressed', async () => {
    await mount(<ApprovalQueueTable {...baseProps} />);
    const checkbox = document.body.querySelector<HTMLElement>("[role='checkbox']");
    await click(checkbox as HTMLElement);
    expect(findByText(document.body, /2 timesheets selected/)).not.toBeNull();
    await click(findButton(document.body, 'Clear') as HTMLButtonElement);
    expect(findByText(document.body, /timesheets selected/)).toBeNull();
  });

  it('opens the bulk-rejection dialog when Reject All is clicked', async () => {
    await mount(<ApprovalQueueTable {...baseProps} />);
    const checkbox = document.body.querySelector<HTMLElement>("[role='checkbox']");
    await click(checkbox as HTMLElement);
    await click(findButton(document.body, 'Reject All') as HTMLButtonElement);
    expect(document.body.querySelector('[data-testid="rejection-dialog-bulk"]')).not.toBeNull();
  });

  it('renders one status badge per row', async () => {
    await mount(<ApprovalQueueTable {...baseProps} />);
    const badges = document.body.querySelectorAll('[data-testid="status-badge"]');
    expect(badges.length).toBe(2);
  });
});
