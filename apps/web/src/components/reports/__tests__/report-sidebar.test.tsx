import { render, screen, setup, within } from "@/test/test-utils";
import { ReportSidebar } from "../report-sidebar";

const _REPORT_IDS = [
  "spend-contractor",
  "spend-team",
  "expiring-contracts",
  "overdue-invoices",
  "compliance-gaps",
];

const REPORT_LABELS = [
  "Spend by contractor",
  "Spend by team",
  "Expiring contracts",
  "Overdue invoices",
  "Compliance gaps",
];

describe("ReportSidebar", () => {
  it("renders all report types in desktop nav", () => {
    render(<ReportSidebar activeReport="spend-contractor" onSelect={vi.fn()} />);
    // Both desktop and mobile navs are rendered; check labels exist
    REPORT_LABELS.forEach((label) => {
      const elements = screen.getAllByText(label);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders both desktop and mobile navigation", () => {
    const { container } = render(
      <ReportSidebar activeReport="spend-contractor" onSelect={vi.fn()} />,
    );
    const navs = container.querySelectorAll("nav");
    expect(navs.length).toBe(2); // desktop + mobile
  });

  it("calls onSelect when a report is clicked", async () => {
    const onSelect = vi.fn();
    const { user } = setup(<ReportSidebar activeReport="spend-contractor" onSelect={onSelect} />);
    const buttons = screen.getAllByText("Spend by team");
    // Click the first available button
    await user.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledWith("spend-team");
  });

  it("highlights active report on desktop with primary styles", () => {
    const { container } = render(
      <ReportSidebar activeReport="overdue-invoices" onSelect={vi.fn()} />,
    );
    const desktopNav = container.querySelector("nav.hidden");
    expect(desktopNav).toBeTruthy();
    const overdueBtn = within(desktopNav as HTMLElement).getByRole("button", {
      name: "Overdue invoices",
    });
    expect(overdueBtn.className).toMatch(/border-primary/);
    expect(overdueBtn.className).toMatch(/bg-primary\/5/);
  });

  it("renders icons for each report type", () => {
    const { container } = render(
      <ReportSidebar activeReport="spend-contractor" onSelect={vi.fn()} />,
    );
    const svgs = container.querySelectorAll("svg");
    // At least 5 icons per nav (desktop + mobile = 10)
    expect(svgs.length).toBeGreaterThanOrEqual(10);
  });
});
