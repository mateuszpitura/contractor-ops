import { describe, expect, it } from "vitest";
import { render } from "@/test/test-utils";
import { LinearLogo } from "../linear-logo";

describe("LinearLogo", () => {
  it("renders an SVG element", () => {
    const { container } = render(<LinearLogo />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("has aria-hidden attribute", () => {
    const { container } = render(<LinearLogo />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("applies custom className", () => {
    const { container } = render(<LinearLogo className="size-6" />);
    const svg = container.querySelector("svg");
    expect(svg?.classList.contains("size-6")).toBe(true);
  });
});
