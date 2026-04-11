import { render, screen } from "@/test/test-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ImportProgressTracker } from "../import-progress-tracker";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    onboardingImport: {
      getProgress: {
        queryOptions: () => ({ queryKey: ["progress"] }),
        queryKey: () => ["progress"],
      },
      retryFailedItem: { mutationOptions: () => ({}) },
    },
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

describe("ImportProgressTracker", () => {
  beforeEach(() => {
    mockedUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  });

  it("shows loading spinner when no progress data", () => {
    mockedUseQuery.mockReturnValue({ data: undefined, isLoading: true } as any);
    const { container } = render(<ImportProgressTracker jobId="job-1" />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows completed state", () => {
    mockedUseQuery.mockReturnValue({
      data: { status: "completed", completedItems: 5, totalItems: 5, failedItems: [] },
      isLoading: false,
    } as any);
    render(<ImportProgressTracker jobId="job-1" />);
    expect(screen.getByText("Import complete")).toBeInTheDocument();
    expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
  });

  it("shows progress bar for in-progress import", () => {
    mockedUseQuery.mockReturnValue({
      data: { status: "in_progress", completedItems: 3, totalItems: 10, failedItems: [] },
      isLoading: false,
    } as any);
    render(<ImportProgressTracker jobId="job-1" />);
    expect(screen.getByText("Processing...")).toBeInTheDocument();
  });

  it("shows failed items with retry buttons", () => {
    mockedUseQuery.mockReturnValue({
      data: {
        status: "failed",
        completedItems: 4,
        totalItems: 5,
        failedItems: [{ email: "bad@test.com", error: "Invalid email" }],
      },
      isLoading: false,
    } as any);
    render(<ImportProgressTracker jobId="job-1" />);
    expect(screen.getByText("bad@test.com")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });
});
