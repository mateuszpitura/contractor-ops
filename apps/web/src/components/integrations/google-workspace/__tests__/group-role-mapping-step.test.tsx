import { render, screen } from '@/test/test-utils';
import { GroupRoleMappingStep } from '../group-role-mapping-step';

describe('GroupRoleMappingStep', () => {
  const groups = [
    {
      id: 'g1',
      email: 'eng@test.com',
      name: 'Engineering',
      memberEmails: ['a@test.com', 'b@test.com'],
    },
    { id: 'g2', email: 'hr@test.com', name: 'HR', memberEmails: ['c@test.com'] },
  ];

  it('renders group names', () => {
    render(
      <GroupRoleMappingStep
        groups={groups}
        mappings={new Map()}
        onMappingChange={vi.fn()}
        defaultRole="readonly"
      />,
    );
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('HR')).toBeInTheDocument();
  });

  it('renders member count badges', () => {
    render(
      <GroupRoleMappingStep
        groups={groups}
        mappings={new Map()}
        onMappingChange={vi.fn()}
        defaultRole="readonly"
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders nothing when groups is empty', () => {
    const { container } = render(
      <GroupRoleMappingStep
        groups={[]}
        mappings={new Map()}
        onMappingChange={vi.fn()}
        defaultRole="readonly"
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows default label when no mapping set', () => {
    render(
      <GroupRoleMappingStep
        groups={groups}
        mappings={new Map()}
        onMappingChange={vi.fn()}
        defaultRole="readonly"
      />,
    );
    const defaultLabels = screen.getAllByText('(default)');
    expect(defaultLabels.length).toBe(2);
  });
});
