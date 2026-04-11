import { render, screen } from "@/test/test-utils";
import { useQuery } from "@tanstack/react-query";
import { WorkflowRunsDataTable } from "../data-table";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(),
    keepPreviousData: vi.fn(),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    workflow: {
      listRuns: { queryOptions: () => ({ queryKey: ["workflow", "listRuns"] }) },
      listTemplates: { queryOptions: () => ({ queryKey: ["workflow", "listTemplates"] }) },
    },
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("../use-workflow-filters", () => ({
  useWorkflowFilters: () => [
    { page: 1, pageSize: 25, search: "", sortBy: "dueAt", sortOrder: "asc", status: [], templateId: [], overdueOnly: false },
    vi.fn(),
  ],
}));

const mockedUseQuery = vi.mocked(useQuery);

describe("WorkflowRunsDataTable", () => {
  it("renders toolbar with search and start workflow button", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
      isPending: false,
      isFetching: false,
    } as any);
    render(
      <WorkflowRunsDataTable onRowClick={vi.fn()} onStartWorkflow={vi.fn()} />,
    );
    expect(screen.getAllByText("Start workflow").length).toBeGreaterThan(0);
  });

  it("renders empty state when no runs exist", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
      isPending: false,
      isFetching: false,
    } as any);
    render(
      <WorkflowRunsDataTable onRowClick={vi.fn()} onStartWorkflow={vi.fn()} />,
    );
    expect(screen.getByText("No active workflows")).toBeInTheDocument();
  });

  it("shows skeleton rows while loading", () => {
    mockedUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isPending: true,
      isFetching: true,
    } as any);
    const { container } = render(
      <WorkflowRunsDataTable onRowClick={vi.fn()} onStartWorkflow={vi.fn()} />,
    );
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it("renders filter button", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
      isPending: false,
      isFetching: false,
    } as any);
    render(
      <WorkflowRunsDataTable onRowClick={vi.fn()} onStartWorkflow={vi.fn()} />,
    );
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });
});
