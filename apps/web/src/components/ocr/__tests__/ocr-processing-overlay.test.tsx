import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { OcrProcessingOverlay } from "../ocr-processing-overlay";

describe("OcrProcessingOverlay", () => {
  it("renders the analyzing text", () => {
    render(<OcrProcessingOverlay />);
    expect(screen.getByText("Analyzing invoice...")).toBeInTheDocument();
    expect(screen.getByText("This usually takes a few seconds")).toBeInTheDocument();
  });

  it("renders skeleton fields underneath the overlay", () => {
    const { container } = render(<OcrProcessingOverlay />);
    // 8 skeleton groups
    const skeletonGroups = container.querySelectorAll(".flex.flex-col.gap-2");
    // The outer container also matches, so check for at least 8 skeleton pairs
    expect(skeletonGroups.length).toBeGreaterThanOrEqual(8);
  });

  it("does not show progress bar when progress is undefined", () => {
    const { container } = render(<OcrProcessingOverlay />);
    expect(container.querySelector("[role='progressbar']")).toBeNull();
  });

  it("shows progress bar when progress is provided", () => {
    render(<OcrProcessingOverlay progress={45} />);
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();
  });

  it("shows progress bar when progress is 0", () => {
    render(<OcrProcessingOverlay progress={0} />);
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();
  });
});
