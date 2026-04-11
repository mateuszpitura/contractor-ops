import { render, screen } from "@/test/test-utils";
import { PaczkomatPicker } from "../paczkomat-picker";

function makeProps(overrides: Partial<Parameters<typeof PaczkomatPicker>[0]> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    onSelect: vi.fn(),
    geowidgetToken: "test-token",
    ...overrides,
  };
}

describe("PaczkomatPicker", () => {
  it("renders dialog with title when open", () => {
    render(<PaczkomatPicker {...makeProps()} />);

    expect(screen.getByText(/select paczkomat/i)).toBeInTheDocument();
  });

  it("renders iframe with correct src", () => {
    render(<PaczkomatPicker {...makeProps()} />);

    const iframe = screen.getByTitle(/inpost paczkomat/i);
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      "src",
      expect.stringContaining("test-token"),
    );
  });

  it("confirm button is disabled when no point selected", () => {
    render(<PaczkomatPicker {...makeProps()} />);

    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    expect(confirmBtn).toBeDisabled();
  });

  it("renders cancel button", () => {
    render(<PaczkomatPicker {...makeProps()} />);

    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    render(<PaczkomatPicker {...makeProps({ open: false })} />);

    expect(screen.queryByText(/select paczkomat/i)).not.toBeInTheDocument();
  });
});
