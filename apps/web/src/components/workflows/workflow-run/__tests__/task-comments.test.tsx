import { useMutation, useQuery } from '@tanstack/react-query';
import { render, screen, setup } from '@/test/test-utils';
import { TaskComments } from '../task-comments';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    workflow: {
      listComments: {
        queryOptions: () => ({ queryKey: ['workflow', 'listComments'] }),
        queryKey: () => ['workflow', 'listComments'],
      },
      addComment: { mutationOptions: () => ({}) },
    },
  },
}));

vi.mock('@/lib/avatar-initials', () => ({
  getAvatarInitials: () => 'AB',
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

describe('TaskComments', () => {
  beforeEach(() => {
    mockedUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  });

  it('renders heading', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    render(<TaskComments runId="run-1" taskRunId="task-1" />);
    expect(screen.getByText('Comments')).toBeInTheDocument();
  });

  it('shows no comments message when empty', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    render(<TaskComments runId="run-1" taskRunId="task-1" />);
    expect(screen.getByText('No comments yet.')).toBeInTheDocument();
  });

  it('renders comments with author name', () => {
    mockedUseQuery.mockReturnValue({
      data: [
        {
          id: 'c1',
          body: 'Looks good!',
          createdAt: new Date().toISOString(),
          author: { name: 'John', email: 'john@test.com', image: null },
        },
      ],
      isLoading: false,
    } as any);
    render(<TaskComments runId="run-1" taskRunId="task-1" />);
    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('Looks good!')).toBeInTheDocument();
  });

  it('renders post button disabled when input is empty', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    render(<TaskComments runId="run-1" taskRunId="task-1" />);
    const postBtn = screen.getByText('Post');
    expect(postBtn.closest('button')).toBeDisabled();
  });

  it('shows loading skeletons when isLoading', () => {
    mockedUseQuery.mockReturnValue({ data: undefined, isLoading: true } as any);
    const { container } = render(<TaskComments runId="run-1" taskRunId="task-1" />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('enables post button when text is entered', async () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    const { user } = setup(<TaskComments runId="run-1" taskRunId="task-1" />);
    const textarea = screen.getByPlaceholderText(/comment/i);
    await user.type(textarea, 'Hello');
    const postBtn = screen.getByText('Post');
    expect(postBtn.closest('button')).not.toBeDisabled();
  });

  it('renders comment with avatar fallback initials', () => {
    mockedUseQuery.mockReturnValue({
      data: [
        {
          id: 'c2',
          body: 'Great work!',
          createdAt: new Date().toISOString(),
          author: { name: null, email: 'test@example.com', image: null },
        },
      ],
      isLoading: false,
    } as any);
    render(<TaskComments runId="run-1" taskRunId="task-1" />);
    expect(screen.getByText('Great work!')).toBeInTheDocument();
    expect(screen.getByText('AB')).toBeInTheDocument(); // from mocked getAvatarInitials
  });

  it("shows 'Unknown' for comment with no author name", () => {
    mockedUseQuery.mockReturnValue({
      data: [
        {
          id: 'c3',
          body: 'Anonymous comment',
          createdAt: new Date().toISOString(),
          author: { name: null, email: null, image: null },
        },
      ],
      isLoading: false,
    } as any);
    render(<TaskComments runId="run-1" taskRunId="task-1" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('disables post button when mutation is pending', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    mockedUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: true } as any);
    render(<TaskComments runId="run-1" taskRunId="task-1" />);
    const postBtn = screen.getByText('Post');
    expect(postBtn.closest('button')).toBeDisabled();
  });

  it('renders multiple comments', () => {
    mockedUseQuery.mockReturnValue({
      data: [
        {
          id: 'c1',
          body: 'Comment one',
          createdAt: new Date().toISOString(),
          author: { name: 'Alice', email: 'a@test.com', image: null },
        },
        {
          id: 'c2',
          body: 'Comment two',
          createdAt: new Date().toISOString(),
          author: { name: 'Bob', email: 'b@test.com', image: null },
        },
      ],
      isLoading: false,
    } as any);
    render(<TaskComments runId="run-1" taskRunId="task-1" />);
    expect(screen.getByText('Comment one')).toBeInTheDocument();
    expect(screen.getByText('Comment two')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });
});
