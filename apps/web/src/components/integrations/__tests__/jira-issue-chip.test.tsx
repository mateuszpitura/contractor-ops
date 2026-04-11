import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { JiraIssueChip } from "../jira-issue-chip";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({
    children,
    render: renderProp,
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
  }) => {
    if (renderProp) {
      const { props } = renderProp as React.ReactElement<Record<string, unknown>>;
      return (
        <a {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
          {children}
        </a>
      );
    }
    return <div>{children}</div>;
  },
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JiraIssueChip", () => {
  const baseProps = {
    issueKey: "ENG-42",
    summary: "Fix authentication bug",
    status: "In Progress",
    statusCategory: "indeterminate" as const,
    url: "https://jira.example.com/browse/ENG-42",
  };

  it("renders the issue key", () => {
    render(<JiraIssueChip {...baseProps} />);
    expect(screen.getByText("ENG-42")).toBeInTheDocument();
  });

  it("renders the status text", () => {
    render(<JiraIssueChip {...baseProps} />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("renders a link to the issue url", () => {
    render(<JiraIssueChip {...baseProps} />);
    const link = screen.getByLabelText("Open Jira issue ENG-42 in new tab");
    expect(link).toHaveAttribute(
      "href",
      "https://jira.example.com/browse/ENG-42",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders summary in tooltip", () => {
    render(<JiraIssueChip {...baseProps} />);
    expect(screen.getByText("Fix authentication bug")).toBeInTheDocument();
  });

  it("renders status dot element", () => {
    const { container } = render(<JiraIssueChip {...baseProps} />);
    const dot = container.querySelector(".rounded-full");
    expect(dot).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<JiraIssueChip {...baseProps} className="extra-class" />);
    const link = screen.getByLabelText("Open Jira issue ENG-42 in new tab");
    expect(link.className).toContain("extra-class");
  });

  it("uses bg-success for done statusCategory", () => {
    const { container } = render(
      <JiraIssueChip {...baseProps} statusCategory="done" />,
    );
    const dot = container.querySelector(".rounded-full");
    expect(dot?.className).toContain("bg-success");
  });

  it("uses bg-muted-foreground for new statusCategory", () => {
    const { container } = render(
      <JiraIssueChip {...baseProps} statusCategory="new" />,
    );
    const dot = container.querySelector(".rounded-full");
    expect(dot?.className).toContain("bg-muted-foreground");
  });
});
