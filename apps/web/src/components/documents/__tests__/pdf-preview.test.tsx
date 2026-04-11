import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";
import { PdfPreview } from "../pdf-preview";

const mockFetch = vi.fn();

describe("PdfPreview", () => {
  const defaultProps = {
    documentId: "doc-1",
    filename: "invoice.pdf",
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders dialog with filename as title when open", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          result: { data: { url: "https://example.com/file.pdf" } },
        }),
    });
    render(<PdfPreview {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
    });
  });

  it("renders download button after URL is loaded", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          result: { data: { url: "https://example.com/file.pdf" } },
        }),
    });
    render(<PdfPreview {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Download/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders pdf object element after URL is loaded", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          result: { data: { url: "https://example.com/file.pdf" } },
        }),
    });
    render(<PdfPreview {...defaultProps} />);
    await waitFor(() => {
      const objectEl = document.querySelector("object");
      expect(objectEl).toHaveAttribute(
        "data",
        "https://example.com/file.pdf",
      );
    });
  });

  it("shows error state when URL fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    render(<PdfPreview {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText("Could not load PDF preview"),
      ).toBeInTheDocument();
    });
  });

  it("does not fetch when dialog is closed", () => {
    render(<PdfPreview {...defaultProps} open={false} />);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
