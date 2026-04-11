import { render, screen } from "@/test/test-utils";
import { EquipmentDetailTabs } from "../equipment-detail-tabs";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/equipment/eq-1",
}));

describe("EquipmentDetailTabs", () => {
  const defaultProps = {
    infoContent: <div>Info Content</div>,
    assignmentsContent: <div>Assignments Content</div>,
    shipmentsContent: <div>Shipments Content</div>,
  };

  it("renders all three tab triggers", () => {
    render(<EquipmentDetailTabs {...defaultProps} />);

    expect(screen.getByRole("tab", { name: /info/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /assignments/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /shipments/i })).toBeInTheDocument();
  });

  it("defaults to info tab content", () => {
    render(<EquipmentDetailTabs {...defaultProps} />);

    expect(screen.getByText("Info Content")).toBeInTheDocument();
  });
});
