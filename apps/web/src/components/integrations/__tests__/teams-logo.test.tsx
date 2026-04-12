import { describe, expect, it } from "vitest";
import { render } from "@/test/test-utils";
import { TeamsLogo } from "../teams-logo";

describe("TeamsLogo", () => {
  it("renders an SVG element", () => {
    const { container } = render(<TeamsLogo />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("has aria-hidden attribute", () => {
    const { container } = render(<TeamsLogo />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("applies custom className", () => {
    const { container } = render(<TeamsLogo className="size-8" />);
    const svg = container.querySelector("svg");
    expect(svg?.classList.contains("size-8")).toBe(true);
  });

  it("uses Teams brand color", () => {
    const { container } = render(<TeamsLogo />);
    const svg = container.querySelector("svg");
    expect(svg?.style.color).toBe("rgb(98, 100, 167)");
  });
});
