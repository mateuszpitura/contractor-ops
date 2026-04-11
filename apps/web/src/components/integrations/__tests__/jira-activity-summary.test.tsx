import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/test-utils";
import { JiraActivitySummary } from "../jira-activity-summary";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../jira-logo", () => ({
  JiraLogo: ({ className }: { className?: string }) => (
    <span data-testid="jira-logo" className={className} />
  ),
}));

vi.mock("../jira-issue-chip", () => ({
  JiraIssueChip: ({
    issueKey,
    summary,
    status,
  }: {
    issueKey: string;
    summary: string;
    status: string;
    statusCategory: string;
    url: string;
  }) => (
    <span data-testid={`issue-chip-${issueKey}`}>
      {issueKey} - {status}
    </span>
  ),
}));

const mockItems = [
  {
    id: "item-1",
    externalId: "ext-1",
    externalUrl: "https://jira.example.com/ENG-101",
    metadataJson: {
      key: "ENG-101",
      summary: "Fix login bug",
      status: "In Progress",
      statusCategory: "indeterminate",
      url: "https://jira.example.com/ENG-101",
    },
    updatedAt: new Date(Date.now() - 60_000 * 5).toISOString(), // 5m ago
  },
  {
    id: "item-2",
    externalId: "ext-2",
    externalUrl: "https://jira.example.com/ENG-102",
    metadataJson: {
      key: "ENG-102",
      summary: "Add dashboard",
      status: "Done",
      statusCategory: "done",
      url: "https://jira.example.com/ENG-102",
    },
    updatedAt: new Date(Date.now() - 60_000 * 120).toISOString(), // 2h ago
  },
];

let activityData: unknown[] = [];
let activityLoading = false;

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: () => ({
      isLoading: activityLoading,
      data: activityData,
    }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    jira: {
      recentActivity: {
        queryOptions: vi.fn(() => ({
          queryKey: ["jira", "recentActivity"],
        })),
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JiraActivitySummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activityData = [];
    activityLoading = false;
  });

  it("renders nothing when no items and not loading", () => {
    const { container } = render(
      <JiraActivitySummary contractorId="c-1" />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders loading skeleton container when loading", () => {
    activityLoading = true;
    render(<JiraActivitySummary contractorId="c-1" />);
    // Loading state renders a container with skeleton elements
    const wrapper = document.querySelector(".rounded-lg.border");
    expect(wrapper).not.toBeNull();
  });

  it("renders header with Jira logo and title", () => {
    activityData = mockItems;
    render(<JiraActivitySummary contractorId="c-1" />);
    expect(screen.getByTestId("jira-logo")).toBeInTheDocument();
    expect(screen.getByText("Recent Jira Activity")).toBeInTheDocument();
  });

  it("renders issue chips for each item", () => {
    activityData = mockItems;
    render(<JiraActivitySummary contractorId="c-1" />);
    expect(screen.getByTestId("issue-chip-ENG-101")).toBeInTheDocument();
    expect(screen.getByTestId("issue-chip-ENG-102")).toBeInTheDocument();
  });

  it("renders summaries for each item", () => {
    activityData = mockItems;
    render(<JiraActivitySummary contractorId="c-1" />);
    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    expect(screen.getByText("Add dashboard")).toBeInTheDocument();
  });

  it("renders relative times", () => {
    activityData = mockItems;
    render(<JiraActivitySummary contractorId="c-1" />);
    expect(screen.getByText("5m ago")).toBeInTheDocument();
    expect(screen.getByText("2h ago")).toBeInTheDocument();
  });

  it("renders loading skeletons with header", () => {
    activityLoading = true;
    render(<JiraActivitySummary contractorId="c-1" />);
    // The loading state still shows Jira logo skeleton area
    // It has rounded-lg border container
    const wrapper = document.querySelector(".rounded-lg.border");
    expect(wrapper).not.toBeNull();
  });
});
