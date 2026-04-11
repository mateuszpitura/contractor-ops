import { render, screen } from "@/test/test-utils";
import { ContractDetailTabs } from "../contract-detail-tabs";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/contracts/ct1",
}));

vi.mock("../overview-tab", () => ({
  OverviewTab: () => <div data-testid="overview">Overview</div>,
}));

vi.mock("../documents-tab", () => ({
  DocumentsTab: () => <div data-testid="documents">Documents</div>,
}));

vi.mock("../amendments-tab", () => ({
  AmendmentsTab: () => <div data-testid="amendments">Amendments</div>,
}));

vi.mock("../activity-tab", () => ({
  ActivityTab: () => <div data-testid="activity">Activity</div>,
}));

describe("ContractDetailTabs", () => {
  const contract = {
    id: "ct1",
    contractor: {
      displayName: "ACME",
      email: "test@acme.pl",
    },
  };

  it("renders all 4 tab triggers", () => {
    render(<ContractDetailTabs contract={contract} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
  });

  it("shows overview content by default", () => {
    render(<ContractDetailTabs contract={contract} />);
    expect(screen.getByTestId("overview")).toBeInTheDocument();
  });
});
