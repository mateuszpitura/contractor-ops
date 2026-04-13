import { workflowTaskSkipReason } from '@contractor-ops/validators';
import { render, screen } from '@/test/test-utils';
import { TaskChecklist } from '../task-checklist';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
    useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    workflow: {
      completeTask: { mutationOptions: () => ({}) },
      skipTask: { mutationOptions: () => ({}) },
      reassignTask: { mutationOptions: () => ({}) },
      getRun: { queryKey: () => ['workflow', 'getRun'] },
    },
    user: { list: { queryOptions: () => ({ queryKey: ['user', 'list'] }) } },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/integrations/doc-links-section', () => ({
  DocLinksSection: () => null,
}));

vi.mock('../task-comments', () => ({ TaskComments: () => null }));
vi.mock('../task-attachments', () => ({ TaskAttachments: () => null }));

const mockTasks = [
  {
    id: 't1',
    title: 'Task 1',
    description: null,
    taskType: 'MANUAL',
    status: 'DONE',
    required: true,
    assigneeUserId: null,
    assigneeRole: null,
    dueAt: null,
    completedAt: '2026-03-01',
    completedByUserId: 'u1',
    startedAt: null,
    dependsOnTaskRunId: null,
    resultJson: null,
    isOverdue: false,
    createdAt: '2026-02-01',
  },
  {
    id: 't2',
    title: 'Task 2',
    description: null,
    taskType: 'APPROVAL',
    status: 'TODO',
    required: false,
    assigneeUserId: 'u1',
    assigneeRole: null,
    dueAt: null,
    completedAt: null,
    completedByUserId: null,
    startedAt: null,
    dependsOnTaskRunId: null,
    resultJson: null,
    isOverdue: false,
    createdAt: '2026-02-01',
  },
];

describe('TaskChecklist', () => {
  it('renders heading', () => {
    render(<TaskChecklist tasks={mockTasks} runId="run-1" currentUserId="u1" />);
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('renders all tasks', () => {
    render(<TaskChecklist tasks={mockTasks} runId="run-1" currentUserId="u1" />);
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
  });

  it('shows skeleton when loading', () => {
    render(<TaskChecklist tasks={[]} runId="run-1" currentUserId="u1" isLoading />);
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('applies opacity to condition-skipped tasks', () => {
    const skippedTask = {
      ...mockTasks[0],
      id: 't3',
      status: 'SKIPPED',
      resultJson: { skipReason: workflowTaskSkipReason.conditionNotMet },
    };
    render(<TaskChecklist tasks={[skippedTask]} runId="run-1" currentUserId="u1" />);
    const wrapper = screen.getByText('Task 1').closest("[class*='opacity']");
    expect(wrapper).toBeInTheDocument();
  });
});
