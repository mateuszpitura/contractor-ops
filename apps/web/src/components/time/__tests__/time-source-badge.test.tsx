import { render, screen } from "@/test/test-utils";
import { TimeSourceBadge } from "../time-source-badge";

describe("TimeSourceBadge", () => {
  it("renders Manual label for MANUAL source", () => {
    render(<TimeSourceBadge source="MANUAL" />);
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  it("renders Clockify label for CLOCKIFY source", () => {
    render(<TimeSourceBadge source="CLOCKIFY" importedAt="2025-03-10T00:00:00Z" />);
    expect(screen.getByText("Clockify")).toBeInTheDocument();
  });

  it("renders Jira label for JIRA source", () => {
    render(<TimeSourceBadge source="JIRA" importedAt={new Date("2025-03-10")} />);
    expect(screen.getByText("Jira")).toBeInTheDocument();
  });

  it("renders an icon for each source", () => {
    const { container } = render(<TimeSourceBadge source="MANUAL" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("handles missing importedAt gracefully for imported sources", () => {
    render(<TimeSourceBadge source="CLOCKIFY" />);
    expect(screen.getByText("Clockify")).toBeInTheDocument();
  });
});
