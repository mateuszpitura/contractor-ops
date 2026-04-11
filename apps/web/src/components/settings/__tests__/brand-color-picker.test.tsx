import { render, screen } from "@/test/test-utils";
import { BrandColorPicker } from "../brand-color-picker";

describe("BrandColorPicker", () => {
  it("renders trigger button with correct background color", () => {
    render(<BrandColorPicker value="#dc2626" onChange={vi.fn()} />);
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveStyle({ backgroundColor: "#dc2626" });
  });
});
