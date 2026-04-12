import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { JiraTaskConfig } from '../jira-task-config';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../jira-project-mapping-dialog', () => ({
  JiraProjectMappingDialog: ({
    open,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    taskTemplateId: string;
    connectionId: string;
  }) => (open ? <div data-testid="jira-mapping-dialog">MappingDialog</div> : null),
}));

let connectionData: unknown = { id: 'conn-1', status: 'CONNECTED' };
let configData: unknown;

const mockMutate = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (opts: { queryKey?: unknown }) => {
      const key = JSON.stringify(opts.queryKey ?? '');
      if (key.includes('connectionStatus')) {
        return { isLoading: false, data: connectionData };
      }
      if (key.includes('getTaskConfig')) {
        return { isLoading: false, data: configData };
      }
      return { isLoading: false, data: null };
    },
    useMutation: (opts: Record<string, unknown>) => ({
      mutate: mockMutate,
      isPending: false,
      ...opts,
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    jira: {
      connectionStatus: {
        queryOptions: vi.fn(() => ({ queryKey: ['jira', 'connectionStatus'] })),
      },
      getTaskConfig: {
        queryOptions: vi.fn(() => ({ queryKey: ['jira', 'getTaskConfig'] })),
        queryKey: vi.fn(() => ['jira', 'getTaskConfig']),
      },
      saveTaskConfig: { mutationOptions: vi.fn(() => ({})) },
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JiraTaskConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectionData = { id: 'conn-1', status: 'CONNECTED' };
    configData = undefined;
  });

  it('renders nothing when Jira is not connected', () => {
    connectionData = null;
    const { container } = render(<JiraTaskConfig taskTemplateId="tt-1" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders toggle label when connected', () => {
    render(<JiraTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByText('Create Jira issue when task activates')).toBeInTheDocument();
  });

  it('renders switch element', () => {
    render(<JiraTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it("renders 'Not configured' when no mapping exists", () => {
    render(<JiraTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });

  it('renders Configure Jira button', () => {
    render(<JiraTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByRole('button', { name: 'Configure Jira' })).toBeInTheDocument();
  });

  it('switch is disabled when no mapping is configured', () => {
    render(<JiraTaskConfig taskTemplateId="tt-1" />);
    const toggle = screen.getByRole('switch');
    // Base UI Switch uses data-disabled attribute instead of HTML disabled
    expect(toggle).toHaveAttribute('data-disabled');
  });

  it('renders mapping summary when config exists', () => {
    configData = {
      jiraEnabled: true,
      jiraProjectId: 'proj-1',
      jiraProjectKey: 'WEB',
      jiraProjectName: 'Web App',
      jiraIssueTypeId: 'it-1',
      jiraIssueTypeName: 'Task',
    };
    render(<JiraTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByText('Web App / Task')).toBeInTheDocument();
  });

  it('switch is enabled when mapping is configured', () => {
    configData = {
      jiraEnabled: false,
      jiraProjectId: 'proj-1',
      jiraProjectKey: 'WEB',
      jiraProjectName: 'Web App',
      jiraIssueTypeId: 'it-1',
      jiraIssueTypeName: 'Task',
    };
    render(<JiraTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByRole('switch')).not.toBeDisabled();
  });

  it('opens mapping dialog when Configure Jira clicked', async () => {
    const { user } = setup(<JiraTaskConfig taskTemplateId="tt-1" />);
    await user.click(screen.getByText('Configure Jira'));
    expect(screen.getByTestId('jira-mapping-dialog')).toBeInTheDocument();
  });

  it('calls mutate when toggle is changed with configured mapping', async () => {
    configData = {
      jiraEnabled: false,
      jiraProjectId: 'proj-1',
      jiraProjectKey: 'WEB',
      jiraProjectName: 'Web App',
      jiraIssueTypeId: 'it-1',
      jiraIssueTypeName: 'Task',
    };
    const { user } = setup(<JiraTaskConfig taskTemplateId="tt-1" />);
    await user.click(screen.getByRole('switch'));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        taskTemplateId: 'tt-1',
        config: expect.objectContaining({
          jiraEnabled: true,
        }),
      }),
    );
  });
});
