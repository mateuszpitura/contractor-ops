import { render, screen } from "@/test/test-utils";
import { DirectorySummaryBar } from "../directory-summary-bar";

describe("DirectorySummaryBar", () => {
  it("renders total, existing, and new counts", () => {
    render(
      <DirectorySummaryBar
        total={50}
        alreadyImported={20}
        newUsers={30}
        selected={0}
      />,
    );
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("renders selected count when > 0", () => {
    render(
      <DirectorySummaryBar
        total={50}
        alreadyImported={20}
        newUsers={30}
        selected={10}
      />,
    );
    expect(screen.getByText(/10 selected/)).toBeInTheDocument();
  });

  it("does not render selected when 0", () => {
    render(
      <DirectorySummaryBar
        total={50}
        alreadyImported={20}
        newUsers={30}
        selected={0}
      />,
    );
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it("has role=status for accessibility", () => {
    const { container } = render(
      <DirectorySummaryBar total={10} alreadyImported={5} newUsers={5} selected={0} />,
    );
    expect(container.querySelector('[role="status"]')).toBeInTheDocument();
  });
});
