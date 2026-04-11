import { describe, it, expect } from "vitest";
import { render } from "@/test/test-utils";
import { GoogleWorkspaceLogo } from "../google-workspace-logo";

describe("GoogleWorkspaceLogo", () => {
  it("renders an SVG element", () => {
    const { container } = render(<GoogleWorkspaceLogo />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("has aria-hidden attribute", () => {
    const { container } = render(<GoogleWorkspaceLogo />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("applies custom className", () => {
    const { container } = render(<GoogleWorkspaceLogo className="size-4" />);
    const svg = container.querySelector("svg");
    expect(svg?.className.baseVal).toContain("size-4");
  });

  it("renders Google brand color paths", () => {
    const { container } = render(<GoogleWorkspaceLogo />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(4);

    const fills = Array.from(paths).map((p) => p.getAttribute("fill"));
    expect(fills).toContain("#4285F4");
    expect(fills).toContain("#34A853");
    expect(fills).toContain("#FBBC05");
    expect(fills).toContain("#EA4335");
  });

  it("has viewBox attribute", () => {
    const { container } = render(<GoogleWorkspaceLogo />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });
});
