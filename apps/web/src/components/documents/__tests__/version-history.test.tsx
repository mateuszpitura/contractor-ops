import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, setup } from "@/test/test-utils";
import { VersionHistory } from "../version-history";

const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    document: {
      getVersionHistory: {
        queryOptions: (input: unknown) => ({
          queryKey: ["document", "getVersionHistory", input],
          queryFn: vi.fn(),
        }),
      },
    },
  },
}));

describe("VersionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it("renders collapsed toggle button initially", () => {
    render(<VersionHistory documentId="doc-1" />);
    expect(
      screen.getByText("View version history"),
    ).toBeInTheDocument();
  });

  it("expands on click and shows no other versions", async () => {
    const { user } = setup(<VersionHistory documentId="doc-1" />);
    await user.click(screen.getByText("View version history"));
    expect(
      screen.getByText("No other versions"),
    ).toBeInTheDocument();
  });

  it("shows loading text when fetching history", async () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    const { user } = setup(<VersionHistory documentId="doc-1" />);
    await user.click(screen.getByText("View version history"));
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it("renders version list when versions exist", async () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: "v-1",
          originalFileName: "invoice-v2.pdf",
          createdAt: "2026-03-15T10:00:00Z",
          status: "ACTIVE",
        },
        {
          id: "v-2",
          originalFileName: "invoice-v1.pdf",
          createdAt: "2026-03-10T10:00:00Z",
          status: "SUPERSEDED",
        },
      ],
      isLoading: false,
    });
    const { user } = setup(<VersionHistory documentId="doc-1" />);
    await user.click(screen.getByText("View version history"));
    expect(screen.getByText("(Superseded)")).toBeInTheDocument();
  });

  it("collapses on second click", async () => {
    const { user } = setup(<VersionHistory documentId="doc-1" />);
    await user.click(screen.getByText("View version history"));
    expect(screen.getByText("No other versions")).toBeInTheDocument();
    await user.click(screen.getByText("View version history"));
    expect(
      screen.queryByText("No other versions"),
    ).not.toBeInTheDocument();
  });
});
