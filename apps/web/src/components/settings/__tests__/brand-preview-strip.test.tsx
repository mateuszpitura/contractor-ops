import { render, screen } from "@/test/test-utils";
import { BrandPreviewStrip } from "../brand-preview-strip";

describe("BrandPreviewStrip", () => {
  it("renders preview button and link text", () => {
    render(<BrandPreviewStrip color="#4f46e5" />);
    expect(screen.getByText("Sample Button")).toBeInTheDocument();
    expect(screen.getByText("Sample Link")).toBeInTheDocument();
  });

  it("applies the brand color to the button background", () => {
    render(<BrandPreviewStrip color="#dc2626" />);
    const button = screen.getByText("Sample Button");
    expect(button).toHaveStyle({ backgroundColor: "#dc2626" });
  });

  it("applies the brand color to the link text", () => {
    render(<BrandPreviewStrip color="#16a34a" />);
    const link = screen.getByText("Sample Link");
    expect(link).toHaveStyle({ color: "#16a34a" });
  });
});
