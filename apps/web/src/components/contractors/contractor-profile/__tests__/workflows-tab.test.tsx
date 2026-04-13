import { render, screen } from '@/test/test-utils';
import { WorkflowsTab } from '../workflows-tab';

const mockUseQuery = vi.fn(() => ({
  data: null,
  isLoading: false,
  isFetching: false,
  isPending: false,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    workflow: {
      listRuns: {
        queryOptions: (input: unknown) => ({
          queryKey: ['workflow', 'listRuns', input],
        }),
      },
    },
    jira: {
      connectionStatus: { queryOptions: () => ({ queryKey: ['jira', 'conn'] }) },
      linkedIssues: { queryOptions: (input: unknown) => ({ queryKey: ['jira', 'linked', input] }) },
    },
    linear: {
      connectionStatus: { queryOptions: () => ({ queryKey: ['linear', 'conn'] }) },
      linkedIssues: {
        queryOptions: (input: unknown) => ({ queryKey: ['linear', 'linked', input] }),
      },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/workflows/template-picker-dialog', () => ({
  TemplatePicker: () => null,
}));

vi.mock('@/components/integrations/jira-activity-summary', () => ({
  JiraActivitySummary: () => null,
}));

vi.mock('@/components/integrations/jira-issue-chip', () => ({
  JiraIssueChip: () => null,
}));

vi.mock('@/components/integrations/linear-issue-chip', () => ({
  LinearIssueChip: () => null,
}));

describe('WorkflowsTab', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      isPending: false,
    });
  });

  it('renders empty state when no workflows', () => {
    render(<WorkflowsTab contractorId="c1" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders loading skeletons', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: true,
      isFetching: true,
      isPending: true,
    });

    const { container } = render(<WorkflowsTab contractorId="c1" />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  // ---- Empty state content ----
  it('shows empty state heading', () => {
    render(<WorkflowsTab contractorId="c1" />);
    expect(screen.getByText(/No workflows/i)).toBeInTheDocument();
  });

  it('shows empty state body text', () => {
    render(<WorkflowsTab contractorId="c1" />);
    expect(screen.getByText(/Start a workflow/i)).toBeInTheDocument();
  });

  it('shows empty state CTA button', () => {
    render(<WorkflowsTab contractorId="c1" />);
    expect(screen.getByText(/Start workflow/i)).toBeInTheDocument();
  });

  // ---- With workflow runs ----
  it('renders workflow run list when data exists', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'run-1',
            status: 'IN_PROGRESS',
            startedAt: '2026-01-15',
            workflowTemplate: { name: 'Onboarding', type: 'ONBOARDING' },
            progress: { done: 2, total: 5, percent: 40 },
          },
        ],
        total: 1,
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<WorkflowsTab contractorId="c1" />);
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });

  it('renders status badge for workflow run', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'run-1',
            status: 'COMPLETED',
            startedAt: '2026-01-15',
            workflowTemplate: { name: 'Offboarding', type: 'OFFBOARDING' },
            progress: { done: 3, total: 3, percent: 100 },
          },
        ],
        total: 1,
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<WorkflowsTab contractorId="c1" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders start workflow button in run list view', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'run-1',
            status: 'IN_PROGRESS',
            startedAt: '2026-01-15',
            workflowTemplate: { name: 'Onboarding', type: 'ONBOARDING' },
            progress: { done: 1, total: 4, percent: 25 },
          },
        ],
        total: 1,
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<WorkflowsTab contractorId="c1" />);
    expect(screen.getByText('Start workflow')).toBeInTheDocument();
  });

  it('renders tab heading for workflow list', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'run-1',
            status: 'IN_PROGRESS',
            startedAt: null,
            workflowTemplate: { name: 'Onboarding', type: 'ONBOARDING' },
            progress: { done: 0, total: 3, percent: 0 },
          },
        ],
        total: 1,
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<WorkflowsTab contractorId="c1" />);
    expect(screen.getByText('Workflows')).toBeInTheDocument();
  });

  it('renders date for workflow run when startedAt is provided', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'run-1',
            status: 'IN_PROGRESS',
            startedAt: '2026-03-15',
            workflowTemplate: { name: 'Compliance', type: 'COMPLIANCE_REVIEW' },
            progress: { done: 1, total: 2, percent: 50 },
          },
        ],
        total: 1,
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<WorkflowsTab contractorId="c1" />);
    // Date should be rendered in pl-PL format
    const dateStr = new Date('2026-03-15').toLocaleDateString('pl-PL');
    expect(screen.getByText(dateStr)).toBeInTheDocument();
  });

  it("falls back to 'Workflow' when template name is null", () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'run-1',
            status: 'NOT_STARTED',
            startedAt: null,
            workflowTemplate: null,
            progress: { done: 0, total: 1, percent: 0 },
          },
        ],
        total: 1,
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<WorkflowsTab contractorId="c1" />);
    expect(screen.getByText('Workflow')).toBeInTheDocument();
  });

  // ---- Pagination ----
  it('does not render pagination when total pages is 1', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'run-1',
            status: 'IN_PROGRESS',
            startedAt: null,
            workflowTemplate: { name: 'Test', type: 'CUSTOM' },
            progress: { done: 0, total: 1, percent: 0 },
          },
        ],
        total: 1,
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<WorkflowsTab contractorId="c1" />);
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
  });
});
