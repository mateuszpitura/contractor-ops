import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";

import { KsefSourceBadge } from "../ksef-badge";

describe("KsefSourceBadge", () => {
  it("renders KSeF label for screen readers and sighted users", () => {
    render(<KsefSourceBadge />);
    expect(screen.getByText("KSeF")).toBeInTheDocument();
  });

  it("renders without fetchedAt (static tooltip copy)", () => {
    const { container } = render(<KsefSourceBadge />);
    expect(container.querySelector('[class*="inline-flex"]')).toBeTruthy();
  });
});
