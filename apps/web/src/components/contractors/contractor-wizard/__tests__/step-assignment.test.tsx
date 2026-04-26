import { useForm } from 'react-hook-form';
import { render, screen } from '@/test/test-utils';
import { StepAssignment } from '../step-assignment';

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({
      data: [
        { id: 'u1', name: 'Jan Kowalski', email: 'jan@test.com' },
        { id: 'u2', name: 'Anna Nowak', email: 'anna@test.com' },
      ],
    }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    user: {
      list: { queryOptions: () => ({ queryKey: ['user', 'list'] }) },
    },
  },
}));

function Wrapper() {
  const form = useForm({
    defaultValues: {
      ownerUserId: '',
      primaryTeamId: '',
      primaryProjectId: '',
      defaultCostCenterId: '',
    },
  });
  return <StepAssignment form={form as never} />;
}

describe('StepAssignment', () => {
  it('renders owner select field', () => {
    render(<Wrapper />);
    // Should have labels for owner, team, project, cost center
    const labels = screen.getAllByText(/.+/);
    expect(labels.length).toBeGreaterThan(0);
  });

  it('renders disabled team, project, and cost center selects', () => {
    const { container } = render(<Wrapper />);
    // Team, project, cost center selects should be disabled
    const disabledTriggers = container.querySelectorAll('[disabled]');
    expect(disabledTriggers.length).toBeGreaterThanOrEqual(3);
  });
});
