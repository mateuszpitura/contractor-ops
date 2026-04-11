import { render, screen } from "@/test/test-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RunHeader } from "../run-header";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useMutation: vi.fn(),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    workflow: {
      cancelRun: { mutationOptions: () => ({}) },
      getRun: { queryKey: () => ["workflow", "getRun"] },
    },
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedUseMutation = vi.mocked(useMutation);

const mockRun = {
  id: "run-1",
  status: "IN_PROGRESS",
  startedAt: "2026-03-01T10:00:00Z",
  dueAt: "2026-04-10T10:00:00Z",
  startedByUserId: "user-1",
  workflowTemplate: { id: "tmpl-1", name: "Onboarding", type: "ONBOARDING" },
  contractor: { id: "c1", legalName: "Acme sp. z o.o.", displayName: "Acme" },
  tasks: [
    { status: "DONE", resultJson: null, isOverdue: false },
    { status: "IN_PROGRESS", resultJson: null, isOverdue: false },
    { status: "TODO", resultJson: null, isOverdue: false },
  ],
};

describe("RunHeader", () => {
  beforeEach(() => {
    mockedUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  });

  it("renders workflow template name", () => {
    render(<RunHeader run={mockRun} />);
    expect(screen.getAllByText("Onboarding").length).toBeGreaterThan(0);
  });

  it("renders status badge", () => {
    render(<RunHeader run={mockRun} />);
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("renders contractor link", () => {
    render(<RunHeader run={mockRun} />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("renders progress info", () => {
    render(<RunHeader run={mockRun} />);
    expect(screen.getByText(/of.*tasks complete/)).toBeInTheDocument();
  });

  it("shows actions dropdown for non-completed runs", () => {
    render(<RunHeader run={mockRun} />);
    expect(screen.getByText(/actions/i)).toBeInTheDocument();
  });

  it("hides actions for completed runs", () => {
    render(<RunHeader run={{ ...mockRun, status: "COMPLETED" }} />);
    expect(screen.queryByText(/actions/i)).not.toBeInTheDocument();
  });
});
