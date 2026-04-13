import { workflowTaskSkipReason } from '@contractor-ops/validators';
import { useQuery } from '@tanstack/react-query';
import { render, screen } from '@/test/test-utils';
import { WorkflowSidePanel } from '../workflow-side-panel';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...actual, useQuery: vi.fn() };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    workflow: {
      getRun: { queryOptions: () => ({ queryKey: ['workflow', 'getRun'] }) },
    },
    jira: {
      connectionStatus: { queryOptions: () => ({ queryKey: ['jira', 'connection'] }) },
      linkedIssues: { queryOptions: () => ({ queryKey: ['jira', 'linked'] }) },
    },
    linear: {
      connectionStatus: { queryOptions: () => ({ queryKey: ['linear', 'connection'] }) },
      linkedIssues: { queryOptions: () => ({ queryKey: ['linear', 'linked'] }) },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/integrations/jira-issue-chip', () => ({
  JiraIssueChip: () => null,
}));

vi.mock('@/components/integrations/linear-issue-chip', () => ({
  LinearIssueChip: () => null,
}));

const mockedUseQuery = vi.mocked(useQuery);

describe('WorkflowSidePanel', () => {
  it('renders nothing visually when runId is null', () => {
    mockedUseQuery.mockReturnValue({ data: undefined, isLoading: false } as unknown);
    render(<WorkflowSidePanel runId={null} onClose={vi.fn()} />);
    // Sheet is closed when runId is null
    expect(screen.queryByText('Open workflow')).not.toBeInTheDocument();
  });

  it('renders run details when open with data', () => {
    mockedUseQuery.mockImplementation(((opts: Record<string, unknown>) => {
      if (opts?.queryKey?.[0] === 'workflow') {
        return {
          data: {
            id: 'run-1',
            status: 'IN_PROGRESS',
            startedAt: '2026-03-01',
            workflowTemplate: { name: 'Onboarding', id: 't1' },
            contractor: { id: 'c1', legalName: 'Acme', displayName: 'Acme' },
            tasks: [
              { status: 'DONE', isOverdue: false, resultJson: null },
              { status: 'TODO', isOverdue: false, resultJson: null },
            ],
          },
          isLoading: false,
        };
      }
      // jira/linear connection status
      return { data: null, isLoading: false };
    }) as unknown);
    render(<WorkflowSidePanel runId="run-1" onClose={vi.fn()} />);
    expect(screen.getAllByText('Onboarding').length).toBeGreaterThan(0);
  });

  it('does not show run details when query is loading', () => {
    mockedUseQuery.mockReturnValue({ data: undefined, isLoading: true } as unknown);
    render(<WorkflowSidePanel runId="run-1" onClose={vi.fn()} />);
    expect(screen.queryByText('Open workflow')).not.toBeInTheDocument();
  });

  it('renders progress bar and task summary', () => {
    mockedUseQuery.mockImplementation(((opts: Record<string, unknown>) => {
      if (opts?.queryKey?.[0] === 'workflow') {
        return {
          data: {
            id: 'run-1',
            status: 'IN_PROGRESS',
            startedAt: '2026-03-01',
            workflowTemplate: { name: 'Onboarding', id: 't1' },
            contractor: null,
            tasks: [
              { status: 'DONE', isOverdue: false, resultJson: null },
              { status: 'DONE', isOverdue: false, resultJson: null },
              { status: 'TODO', isOverdue: false, resultJson: null },
              { status: 'IN_PROGRESS', isOverdue: true, resultJson: null },
            ],
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    }) as unknown);
    render(<WorkflowSidePanel runId="run-1" onClose={vi.fn()} />);
    expect(screen.getByText('2 of 4 tasks complete')).toBeInTheDocument();
  });

  it('renders open workflow link button', () => {
    mockedUseQuery.mockImplementation(((opts: Record<string, unknown>) => {
      if (opts?.queryKey?.[0] === 'workflow') {
        return {
          data: {
            id: 'run-1',
            status: 'COMPLETED',
            startedAt: null,
            workflowTemplate: { name: 'Offboarding', id: 't2' },
            contractor: null,
            tasks: [],
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    }) as unknown);
    render(<WorkflowSidePanel runId="run-1" onClose={vi.fn()} />);
    expect(screen.getByText('Open workflow')).toBeInTheDocument();
  });

  it('renders contractor link when contractor is present', () => {
    mockedUseQuery.mockImplementation(((opts: Record<string, unknown>) => {
      if (opts?.queryKey?.[0] === 'workflow') {
        return {
          data: {
            id: 'run-1',
            status: 'IN_PROGRESS',
            startedAt: '2026-03-01',
            workflowTemplate: { name: 'Onboarding', id: 't1' },
            contractor: { id: 'c-1', legalName: 'Acme Corp', displayName: 'Acme' },
            tasks: [],
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    }) as unknown);
    render(<WorkflowSidePanel runId="run-1" onClose={vi.fn()} />);
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('excludes condition-skipped tasks from progress count', () => {
    mockedUseQuery.mockImplementation(((opts: Record<string, unknown>) => {
      if (opts?.queryKey?.[0] === 'workflow') {
        return {
          data: {
            id: 'run-1',
            status: 'IN_PROGRESS',
            startedAt: '2026-03-01',
            workflowTemplate: { name: 'Onboarding', id: 't1' },
            contractor: null,
            tasks: [
              { status: 'DONE', isOverdue: false, resultJson: null },
              {
                status: 'SKIPPED',
                isOverdue: false,
                resultJson: { skipReason: workflowTaskSkipReason.conditionNotMet },
              },
              { status: 'TODO', isOverdue: false, resultJson: null },
            ],
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    }) as unknown);
    render(<WorkflowSidePanel runId="run-1" onClose={vi.fn()} />);
    // 1 DONE of 2 active tasks (condition-skipped excluded)
    expect(screen.getByText('1 of 2 tasks complete')).toBeInTheDocument();
  });
});
