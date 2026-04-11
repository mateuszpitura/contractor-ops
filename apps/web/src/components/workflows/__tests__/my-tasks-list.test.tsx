import { render, screen } from "@/test/test-utils";
import { useQuery } from "@tanstack/react-query";
import { MyTasksList } from "../my-tasks-list";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return { ...actual, useQuery: vi.fn() };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    workflow: {
      myTasks: {
        queryOptions: () => ({ queryKey: ["workflow", "myTasks"] }),
      },
    },
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const mockedUseQuery = vi.mocked(useQuery);

const mockTasks = [
  {
    id: "t1",
    title: "Collect NDA",
    status: "TODO",
    taskType: "DOCUMENT_COLLECTION",
    dueAt: "2026-04-10",
    isOverdue: false,
    workflowRun: {
      id: "run-1",
      status: "IN_PROGRESS",
      contractor: { id: "c1", legalName: "Acme sp. z o.o.", displayName: "Acme" },
      workflowTemplate: { name: "Onboarding", type: "ONBOARDING" },
    },
  },
  {
    id: "t2",
    title: "Setup VPN",
    status: "IN_PROGRESS",
    taskType: "ACCESS_GRANT",
    dueAt: "2026-04-01",
    isOverdue: true,
    workflowRun: {
      id: "run-2",
      status: "IN_PROGRESS",
      contractor: { id: "c2", legalName: "Beta LLC", displayName: null },
      workflowTemplate: { name: "IT Setup", type: "CUSTOM" },
    },
  },
];

describe("MyTasksList", () => {
  it("shows skeletons when loading", () => {
    mockedUseQuery.mockReturnValue({ data: undefined, isLoading: true } as any);
    render(<MyTasksList />);
    expect(screen.queryByText("Collect NDA")).not.toBeInTheDocument();
  });

  it("renders empty state when no tasks", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
    } as any);
    render(<MyTasksList />);
    expect(screen.getByText("No tasks assigned")).toBeInTheDocument();
    expect(screen.getByText(/You have no pending workflow tasks/)).toBeInTheDocument();
  });

  it("renders task list with titles and workflow names", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTasks, total: 2 },
      isLoading: false,
    } as any);
    render(<MyTasksList />);
    expect(screen.getByText("Collect NDA")).toBeInTheDocument();
    expect(screen.getByText("Setup VPN")).toBeInTheDocument();
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
    expect(screen.getByText(/Beta LLC/)).toBeInTheDocument();
  });

  it("links each task to its workflow run", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTasks, total: 2 },
      isLoading: false,
    } as any);
    render(<MyTasksList />);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/workflows/run-1");
    expect(links[1]).toHaveAttribute("href", "/workflows/run-2");
  });

  it("shows overdue toggle", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTasks, total: 2 },
      isLoading: false,
    } as any);
    render(<MyTasksList />);
    expect(screen.getByText("Overdue only")).toBeInTheDocument();
  });
});
