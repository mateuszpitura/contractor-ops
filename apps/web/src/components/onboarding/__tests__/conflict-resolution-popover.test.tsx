import { render, screen } from '@/test/test-utils';
import { ConflictResolutionPopover } from '../conflict-resolution-popover';

const mockConflicts = [
  {
    field: 'name',
    values: [
      { source: 'JIRA', value: 'John Doe' },
      { source: 'SLACK', value: 'John D.' },
    ],
  },
];

describe('ConflictResolutionPopover', () => {
  it('renders badge with unresolved count', () => {
    render(
      <ConflictResolutionPopover
        conflicts={mockConflicts}
        resolvedConflicts={{}}
        onResolve={vi.fn()}
      />,
    );
    expect(screen.getByText(/Status.*\(1\)/)).toBeInTheDocument();
  });

  it('shows 0 count when all conflicts resolved', () => {
    render(
      <ConflictResolutionPopover
        conflicts={mockConflicts}
        resolvedConflicts={{ name: 'John Doe' }}
        onResolve={vi.fn()}
      />,
    );
    expect(screen.getByText(/\(0\)/)).toBeInTheDocument();
  });
});
