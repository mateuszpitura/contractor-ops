import { render, screen } from '@/test/test-utils';
import { DeactivateDialog } from '../deactivate-dialog';

const mockMutate = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useMutation: () => ({ mutate: mockMutate, isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    user: {
      deactivate: { mutationOptions: vi.fn((o: object) => o) },
      list: { queryKey: vi.fn(() => ['user', 'list']) },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('DeactivateDialog', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it('renders title and body when open', () => {
    render(
      <DeactivateDialog open={true} onOpenChange={onOpenChange} userId="u1" userName="John" />,
    );
    expect(screen.getByText(/Deactivate John/)).toBeInTheDocument();
    expect(
      screen.getByText(
        'This will immediately revoke their access. They will be logged out of all sessions. This action can be reversed.',
      ),
    ).toBeInTheDocument();
  });

  it('renders CTA and cancel buttons', () => {
    render(
      <DeactivateDialog open={true} onOpenChange={onOpenChange} userId="u1" userName="John" />,
    );
    expect(screen.getByText('Deactivate member')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(
      <DeactivateDialog open={false} onOpenChange={onOpenChange} userId="u1" userName="John" />,
    );
    expect(
      screen.queryByText(
        'This will immediately revoke their access. They will be logged out of all sessions. This action can be reversed.',
      ),
    ).not.toBeInTheDocument();
  });
});
