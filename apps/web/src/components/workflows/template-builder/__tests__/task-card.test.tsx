import { render, screen } from '@/test/test-utils';
import { TaskCard } from '../task-card';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...actual, useQuery: vi.fn(() => ({ data: undefined, isLoading: false })) };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
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

vi.mock('@/components/integrations/jira-task-config', () => ({
  JiraTaskConfig: () => null,
}));

vi.mock('@/components/integrations/linear-task-config', () => ({
  LinearTaskConfig: () => null,
}));

vi.mock('@/components/workflow/calendar-task-config', () => ({
  CalendarTaskConfig: () => null,
}));

vi.mock('./condition-builder', () => ({
  ConditionBuilder: () => <div>ConditionBuilder</div>,
  getConditionSummary: () => null,
}));

const createMockForm = (taskData: Record<string, any> = {}) => {
  const defaultTask = {
    title: 'Test Task',
    taskType: 'MANUAL',
    assigneeMode: 'ROLE_BASED',
    required: false,
    conditions: null,
    dueOffsetDays: null,
    ...taskData,
  };
  return {
    watch: vi.fn((path: string) => {
      if (path.startsWith('tasks.')) return defaultTask;
      return;
    }),
    register: vi.fn(() => ({ name: 'test', onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() })),
    setValue: vi.fn(),
  } as any;
};

describe('TaskCard', () => {
  it('renders collapsed header with task title', () => {
    render(
      <TaskCard
        index={0}
        allTasks={[]}
        form={createMockForm({ title: 'Collect NDA' })}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('Collect NDA')).toBeInTheDocument();
  });

  it('shows untitled task text when title is empty', () => {
    render(
      <TaskCard index={0} allTasks={[]} form={createMockForm({ title: '' })} onRemove={vi.fn()} />,
    );
    expect(screen.getByText('Untitled task')).toBeInTheDocument();
  });

  it('shows task type badge', () => {
    render(
      <TaskCard
        index={0}
        allTasks={[]}
        form={createMockForm({ taskType: 'APPROVAL' })}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('Approval')).toBeInTheDocument();
  });

  it('shows required badge when task is required', () => {
    render(
      <TaskCard
        index={0}
        allTasks={[]}
        form={createMockForm({ required: true })}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('Required task')).toBeInTheDocument();
  });
});
