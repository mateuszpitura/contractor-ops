import { render, screen } from "@/test/test-utils";
import { ProfileTabs } from "../profile-tabs";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/contractors/c1",
}));

describe("ProfileTabs", () => {
  const defaultProps = {
    overviewContent: <div>Overview content</div>,
    complianceContent: <div>Compliance content</div>,
    activityContent: <div>Activity content</div>,
    contractsContent: <div>Contracts content</div>,
    documentsContent: <div>Documents content</div>,
    workflowsContent: <div>Workflows content</div>,
    invoicesContent: <div>Invoices content</div>,
    paymentsContent: <div>Payments content</div>,
    equipmentContent: <div>Equipment content</div>,
  };

  it("renders all tab triggers", () => {
    render(<ProfileTabs {...defaultProps} />);
    // There should be 9 tabs
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(9);
  });

  it("shows overview content by default", () => {
    render(<ProfileTabs {...defaultProps} />);
    expect(screen.getByText("Overview content")).toBeInTheDocument();
  });
});
