import { render, screen } from '@/test/test-utils';
import { RoleAssignmentControls } from '../role-assignment-controls';

describe('RoleAssignmentControls', () => {
  it('renders default role label', () => {
    render(<RoleAssignmentControls defaultRole="readonly" onDefaultRoleChange={vi.fn()} />);
    expect(screen.getByText('Default role for all imported users:')).toBeInTheDocument();
  });

  it('displays current role in trigger', () => {
    render(<RoleAssignmentControls defaultRole="admin" onDefaultRoleChange={vi.fn()} />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });
});
