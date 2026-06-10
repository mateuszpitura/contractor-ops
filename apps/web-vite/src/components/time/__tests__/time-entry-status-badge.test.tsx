import { render, screen } from '@/test/test-utils';
import { TimeEntryStatusBadge } from '../time-entry-status-badge';

describe('TimeEntryStatusBadge', () => {
  it.each([
    { status: 'DRAFT' as const, label: 'Draft' },
    { status: 'SUBMITTED' as const, label: 'Submitted' },
    { status: 'APPROVED' as const, label: 'Approved' },
    { status: 'REJECTED' as const, label: 'Rejected' },
  ])("renders $status with label '$label'", ({ status, label }) => {
    render(<TimeEntryStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('renders status pills with atelier layout classes', () => {
    const { container } = render(<TimeEntryStatusBadge status="DRAFT" />);
    expect(container.querySelector('span.inline-flex')).not.toBeNull();
  });
});
