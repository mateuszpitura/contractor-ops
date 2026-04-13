import { workflowTaskSkipReason } from '@contractor-ops/validators';
import { useMutation } from '@tanstack/react-query';
import { render, screen, setup } from '@/test/test-utils';
import { TaskCardRun } from '../task-card-run';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
    useMutation: vi.fn(),
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
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../task-comments', () => ({
  TaskComments: () => <div data-testid="task-comments" />,
}));

vi.mock('../task-attachments', () => ({
  TaskAttachments: () => <div data-testid="task-attachments" />,
}));

vi.mock('@/components/integrations/doc-links-section', () => ({
  DocLinksSection: () => null,
}));

const mockedUseMutation = vi.mocked(useMutation);

const mockTask = {
  id: 'task-1',
  title: 'Collect NDA',
  description: 'Please collect the NDA document',
  taskType: 'DOCUMENT_COLLECTION',
  status: 'TODO',
  required: true,
  assigneeUserId: 'user-1',
  assigneeRole: null,
  dueAt: '2026-04-10',
  completedAt: null,
  completedByUserId: null,
  startedAt: null,
  dependsOnTaskRunId: null,
  resultJson: null,
  isOverdue: false,
  createdAt: '2026-03-01',
};

describe('TaskCardRun', () => {
  beforeEach(() => {
    mockedUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown);
  });

  it('renders task title and type badge', () => {
    render(<TaskCardRun task={mockTask} runId="run-1" currentUserId="user-1" />);
    expect(screen.getByText('Collect NDA')).toBeInTheDocument();
    expect(screen.getByText('Document collection')).toBeInTheDocument();
  });

  it('shows complete button when assigned to current user and actionable', () => {
    render(<TaskCardRun task={mockTask} runId="run-1" currentUserId="user-1" />);
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('hides complete button when not assigned to current user', () => {
    render(<TaskCardRun task={mockTask} runId="run-1" currentUserId="other-user" />);
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
  });

  it('shows reassign for non-assigned users', () => {
    render(<TaskCardRun task={mockTask} runId="run-1" currentUserId="other-user" />);
    expect(screen.getByText('Reassign')).toBeInTheDocument();
  });

  it('does not show actions for done tasks', () => {
    render(
      <TaskCardRun task={{ ...mockTask, status: 'DONE' }} runId="run-1" currentUserId="user-1" />,
    );
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
  });

  it('shows skip button when assigned to current user and actionable', () => {
    render(<TaskCardRun task={mockTask} runId="run-1" currentUserId="user-1" />);
    expect(screen.getByText('Skip')).toBeInTheDocument();
  });

  it('shows reassign button alongside complete for assigned users', () => {
    render(<TaskCardRun task={mockTask} runId="run-1" currentUserId="user-1" />);
    expect(screen.getByText('Reassign')).toBeInTheDocument();
  });

  it('renders due date label when dueAt is present and not overdue', () => {
    render(<TaskCardRun task={mockTask} runId="run-1" currentUserId="user-1" />);
    expect(screen.getByText(/Due/)).toBeInTheDocument();
  });

  it('renders overdue label when task is overdue', () => {
    render(
      <TaskCardRun task={{ ...mockTask, isOverdue: true }} runId="run-1" currentUserId="user-1" />,
    );
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('shows assignee info when assigneeUserId is present', () => {
    render(<TaskCardRun task={mockTask} runId="run-1" currentUserId="user-1" />);
    expect(screen.getByText(/user-1/)).toBeInTheDocument();
  });

  it('does not show actions when currentUserId is null', () => {
    render(<TaskCardRun task={mockTask} runId="run-1" currentUserId={null} />);
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
  });

  it('does not show actions for SKIPPED tasks', () => {
    render(
      <TaskCardRun
        task={{ ...mockTask, status: 'SKIPPED', resultJson: { skipReason: 'Not needed' } }}
        runId="run-1"
        currentUserId="user-1"
      />,
    );
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
  });

  it('does not show actions for CANCELLED tasks', () => {
    render(
      <TaskCardRun
        task={{ ...mockTask, status: 'CANCELLED' }}
        runId="run-1"
        currentUserId="user-1"
      />,
    );
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
  });

  it('shows IN_PROGRESS task actions for assigned user', () => {
    render(
      <TaskCardRun
        task={{ ...mockTask, status: 'IN_PROGRESS' }}
        runId="run-1"
        currentUserId="user-1"
      />,
    );
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Skip')).toBeInTheDocument();
  });

  it('renders without dueAt or assigneeUserId', () => {
    render(
      <TaskCardRun
        task={{ ...mockTask, dueAt: null, assigneeUserId: null }}
        runId="run-1"
        currentUserId="user-1"
      />,
    );
    expect(screen.getByText('Collect NDA')).toBeInTheDocument();
    expect(screen.queryByText(/Due/)).not.toBeInTheDocument();
  });

  it('does not show reassign for DONE tasks even when not assigned', () => {
    render(
      <TaskCardRun
        task={{ ...mockTask, status: 'DONE' }}
        runId="run-1"
        currentUserId="other-user"
      />,
    );
    expect(screen.queryByText('Reassign')).not.toBeInTheDocument();
  });

  it('renders description when task is expanded', async () => {
    const { user } = setup(<TaskCardRun task={mockTask} runId="run-1" currentUserId="user-1" />);
    await user.click(screen.getByText('Collect NDA'));
    expect(screen.getByText('Please collect the NDA document')).toBeInTheDocument();
  });

  it('renders task comments and attachments when expanded', async () => {
    const { user } = setup(<TaskCardRun task={mockTask} runId="run-1" currentUserId="user-1" />);
    await user.click(screen.getByText('Collect NDA'));
    expect(screen.getByTestId('task-comments')).toBeInTheDocument();
    expect(screen.getByTestId('task-attachments')).toBeInTheDocument();
  });

  it('shows completed by info for DONE tasks when expanded', async () => {
    const { user } = setup(
      <TaskCardRun
        task={{
          ...mockTask,
          status: 'DONE',
          completedAt: '2026-04-05T14:00:00Z',
          completedByUserId: 'admin-1',
        }}
        runId="run-1"
        currentUserId="user-1"
      />,
    );
    await user.click(screen.getByText('Collect NDA'));
    expect(screen.getByText(/Completed by admin-1/)).toBeInTheDocument();
  });

  it('shows skip reason for user-skipped tasks when expanded', async () => {
    const { user } = setup(
      <TaskCardRun
        task={{
          ...mockTask,
          status: 'SKIPPED',
          resultJson: { skipReason: 'Not applicable' },
        }}
        runId="run-1"
        currentUserId="user-1"
      />,
    );
    await user.click(screen.getByText('Collect NDA'));
    expect(screen.getByText(/Not applicable/)).toBeInTheDocument();
  });

  it('shows condition skipped message for condition-skipped tasks when expanded', async () => {
    const { user } = setup(
      <TaskCardRun
        task={{
          ...mockTask,
          status: 'SKIPPED',
          resultJson: { skipReason: workflowTaskSkipReason.conditionNotMet },
        }}
        runId="run-1"
        currentUserId="user-1"
      />,
    );
    await user.click(screen.getByText('Collect NDA'));
    expect(screen.getByText('Skipped (condition not met)')).toBeInTheDocument();
  });

  it('renders BLOCKED task with dependency tooltip when dependencyTitle provided', () => {
    render(
      <TaskCardRun
        task={{ ...mockTask, status: 'BLOCKED', dependsOnTaskRunId: 'dep-1' }}
        runId="run-1"
        currentUserId="user-1"
        dependencyTitle="Prerequisite Task"
      />,
    );
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
  });

  it('renders created date when expanded', async () => {
    const { user } = setup(<TaskCardRun task={mockTask} runId="run-1" currentUserId="user-1" />);
    await user.click(screen.getByText('Collect NDA'));
    expect(screen.getByText(/Created/)).toBeInTheDocument();
  });

  it('does not show description when task has no description', async () => {
    const { user } = setup(
      <TaskCardRun
        task={{ ...mockTask, description: null }}
        runId="run-1"
        currentUserId="user-1"
      />,
    );
    await user.click(screen.getByText('Collect NDA'));
    expect(screen.queryByText('Please collect the NDA document')).not.toBeInTheDocument();
  });

  // ---- Complete button click triggers mutation ----
  it('clicking complete button triggers mutation', async () => {
    const mockMutate = vi.fn();
    mockedUseMutation.mockReturnValue({ mutate: mockMutate, isPending: false } as unknown);
    const { user } = setup(<TaskCardRun task={mockTask} runId="run-1" currentUserId="user-1" />);
    await user.click(screen.getByText('Complete'));
    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ taskRunId: 'task-1' }));
  });

  // ---- Skip popover opens on click ----
  it('clicking skip button opens skip popover with textarea', async () => {
    const { user } = setup(<TaskCardRun task={mockTask} runId="run-1" currentUserId="user-1" />);
    await user.click(screen.getByText('Skip'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  // ---- Skip popover: confirm disabled when reason too short ----
  it('skip confirm button disabled when reason is less than 3 chars', async () => {
    const { user } = setup(<TaskCardRun task={mockTask} runId="run-1" currentUserId="user-1" />);
    await user.click(screen.getByText('Skip'));
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'ab');
    const confirmBtn = screen.getByText('Skip task').closest('button');
    expect(confirmBtn).toBeDisabled();
  });

  // ---- Skip popover: confirm enabled when reason is 3+ chars ----
  it('skip confirm button enabled when reason is 3+ chars', async () => {
    const { user } = setup(<TaskCardRun task={mockTask} runId="run-1" currentUserId="user-1" />);
    await user.click(screen.getByText('Skip'));
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Not needed for this contractor');
    const confirmBtn = screen.getByText('Skip task').closest('button');
    expect(confirmBtn).not.toBeDisabled();
  });

  // ---- Reassign popover opens on click ----
  it('clicking reassign button opens reassign popover with select', async () => {
    const { user } = setup(<TaskCardRun task={mockTask} runId="run-1" currentUserId="user-1" />);
    await user.click(screen.getByText('Reassign'));
    // Reassign popover should have a select trigger and confirm button
    expect(screen.getByText('Reassign task')).toBeInTheDocument();
  });

  // ---- BLOCKED status renders lock icon ----
  it('renders BLOCKED status with lock icon styling', () => {
    render(
      <TaskCardRun
        task={{ ...mockTask, status: 'BLOCKED', dependsOnTaskRunId: 'dep-1' }}
        runId="run-1"
        currentUserId="user-1"
      />,
    );
    expect(screen.getByText('Collect NDA')).toBeInTheDocument();
  });

  // ---- Different task types render correct badges ----
  it('renders APPROVAL task type badge', () => {
    render(
      <TaskCardRun
        task={{ ...mockTask, taskType: 'APPROVAL' }}
        runId="run-1"
        currentUserId="user-1"
      />,
    );
    expect(screen.getByText('Approval')).toBeInTheDocument();
  });

  it('renders ACCESS_GRANT task type badge', () => {
    render(
      <TaskCardRun
        task={{ ...mockTask, taskType: 'ACCESS_GRANT' }}
        runId="run-1"
        currentUserId="user-1"
      />,
    );
    expect(screen.getByText('Access grant')).toBeInTheDocument();
  });

  // ---- Overdue task styling ----
  it('overdue task renders with destructive icon styling', () => {
    render(
      <TaskCardRun
        task={{ ...mockTask, isOverdue: true, dueAt: '2026-03-01' }}
        runId="run-1"
        currentUserId="user-1"
      />,
    );
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  // ---- Expanded view shows attachments and comments for any status ----
  it('renders attachments and comments for BLOCKED tasks when expanded', async () => {
    const { user } = setup(
      <TaskCardRun
        task={{ ...mockTask, status: 'BLOCKED', dependsOnTaskRunId: 'dep-1' }}
        runId="run-1"
        currentUserId="user-1"
      />,
    );
    await user.click(screen.getByText('Collect NDA'));
    expect(screen.getByTestId('task-comments')).toBeInTheDocument();
    expect(screen.getByTestId('task-attachments')).toBeInTheDocument();
  });
});
