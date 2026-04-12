import { render, screen, setup } from "@/test/test-utils";
import { PaczkomatDisplay } from "../paczkomat-display";

describe("PaczkomatDisplay", () => {
  const defaultProps = {
    pointId: "WAW01A",
    pointName: "Paczkomat WAW01A",
    pointAddress: "ul. Marszalkowska 1, 00-001 Warszawa",
    onChangeClick: vi.fn(),
  };

  it("renders point name", () => {
    render(<PaczkomatDisplay {...defaultProps} />);
    expect(screen.getByText("Paczkomat WAW01A")).toBeInTheDocument();
  });

  it("renders point address", () => {
    render(<PaczkomatDisplay {...defaultProps} />);
    expect(screen.getByText("ul. Marszalkowska 1, 00-001 Warszawa")).toBeInTheDocument();
  });

  it("renders change button with translated label", () => {
    render(<PaczkomatDisplay {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
  });

  it("calls onChangeClick when change button is clicked", async () => {
    const onClick = vi.fn();
    const { user } = setup(<PaczkomatDisplay {...defaultProps} onChangeClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "Change" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
