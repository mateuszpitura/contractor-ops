import { render, screen } from "@/test/test-utils";
import { UsageKpiCard } from "../usage-kpi-card";

describe("UsageKpiCard", () => {
  it("renders the label", () => {
    render(
      <UsageKpiCard
        icon={<span data-testid="icon">I</span>}
        label="Test Label"
        value="42"
      />,
    );
    expect(screen.getByText("Test Label")).toBeInTheDocument();
  });

  it("renders the value", () => {
    render(
      <UsageKpiCard
        icon={<span>I</span>}
        label="Label"
        value="99"
      />,
    );
    expect(screen.getByText("99")).toBeInTheDocument();
  });

  it("renders the icon", () => {
    render(
      <UsageKpiCard
        icon={<span data-testid="kpi-icon">I</span>}
        label="Label"
        value="1"
      />,
    );
    expect(screen.getByTestId("kpi-icon")).toBeInTheDocument();
  });

  it("renders subText when provided", () => {
    render(
      <UsageKpiCard
        icon={<span>I</span>}
        label="Label"
        value="5"
        subText="Additional info"
      />,
    );
    expect(screen.getByText("Additional info")).toBeInTheDocument();
  });

  it("does not render subText when not provided", () => {
    render(
      <UsageKpiCard
        icon={<span>I</span>}
        label="Label"
        value="5"
      />,
    );
    expect(screen.queryByText("Additional info")).not.toBeInTheDocument();
  });

  it("renders ReactNode as value", () => {
    render(
      <UsageKpiCard
        icon={<span>I</span>}
        label="Label"
        value={<div data-testid="complex-value">Complex</div>}
      />,
    );
    expect(screen.getByTestId("complex-value")).toBeInTheDocument();
  });
});
