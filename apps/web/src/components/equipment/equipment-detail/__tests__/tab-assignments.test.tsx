import { render, screen } from '@/test/test-utils';
import { TabAssignments } from '../tab-assignments';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function makeAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a-1',
    contractorId: 'c-1',
    contractor: { id: 'c-1', legalName: 'Acme Corp', displayName: null },
    assignedByUserId: 'u-1',
    assignedAt: '2026-01-15T00:00:00Z',
    unassignedAt: null,
    unassignedByUserId: null,
    notes: null,
    ...overrides,
  };
}

describe('TabAssignments', () => {
  it('renders empty state when no assignments', () => {
    render(<TabAssignments assignments={[]} currentAssignmentId={null} />);

    expect(screen.getByText('No assignment history')).toBeInTheDocument();
  });

  it('renders assignment table with contractor name', () => {
    const assignment = makeAssignment();
    render(<TabAssignments assignments={[assignment]} currentAssignmentId="a-1" />);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('shows displayName over legalName when available', () => {
    const assignment = makeAssignment({
      contractor: { id: 'c-1', legalName: 'Acme Corp', displayName: 'Acme' },
    });
    render(<TabAssignments assignments={[assignment]} currentAssignmentId={null} />);

    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('shows unassigned date when present', () => {
    const assignment = makeAssignment({
      unassignedAt: '2026-03-15T00:00:00Z',
    });
    render(<TabAssignments assignments={[assignment]} currentAssignmentId={null} />);

    expect(screen.getByText('Mar 15, 2026')).toBeInTheDocument();
  });

  it('renders notes when provided', () => {
    const assignment = makeAssignment({ notes: 'Temporary assignment' });
    render(<TabAssignments assignments={[assignment]} currentAssignmentId={null} />);

    expect(screen.getByText('Temporary assignment')).toBeInTheDocument();
  });
});
