import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { PdfViewer } from "../pdf-viewer";

// Mock react-pdf
vi.mock("react-pdf", () => {
  const pdfjs = {
    GlobalWorkerOptions: { workerSrc: "" },
    version: "4.0.0",
  };
  return {
    pdfjs,
    Document: ({ children, onLoadSuccess }: any) => {
      // Simulate document load on mount
      if (onLoadSuccess) {
        setTimeout(() => onLoadSuccess({ numPages: 3 }), 0);
      }
      return <div data-testid="pdf-document">{children}</div>;
    },
    Page: ({ pageNumber, scale }: any) => (
      <div data-testid="pdf-page" data-page={pageNumber} data-scale={scale}>
        Page {pageNumber}
      </div>
    ),
  };
});

describe("PdfViewer", () => {
  it("renders toolbar with page navigation buttons", () => {
    render(<PdfViewer url="https://example.com/test.pdf" />);
    expect(screen.getByRole("button", { name: /Previous page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next page/i })).toBeInTheDocument();
  });

  it("renders zoom controls", () => {
    render(<PdfViewer url="https://example.com/test.pdf" />);
    expect(screen.getByRole("button", { name: /Zoom in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Zoom out/i })).toBeInTheDocument();
  });

  it("renders fit width button", () => {
    render(<PdfViewer url="https://example.com/test.pdf" />);
    expect(screen.getByText(/Fit width/i)).toBeInTheDocument();
  });

  it("renders pdf document component", () => {
    render(<PdfViewer url="https://example.com/test.pdf" />);
    expect(screen.getByTestId("pdf-document")).toBeInTheDocument();
  });

  it("renders the pdf page", () => {
    render(<PdfViewer url="https://example.com/test.pdf" />);
    expect(screen.getByTestId("pdf-page")).toBeInTheDocument();
  });

  it("starts on page 1", () => {
    render(<PdfViewer url="https://example.com/test.pdf" />);
    const page = screen.getByTestId("pdf-page");
    expect(page).toHaveAttribute("data-page", "1");
  });

  it("starts with scale 1.0", () => {
    render(<PdfViewer url="https://example.com/test.pdf" />);
    const page = screen.getByTestId("pdf-page");
    expect(page).toHaveAttribute("data-scale", "1");
  });

  it("previous page button is disabled on page 1", () => {
    render(<PdfViewer url="https://example.com/test.pdf" />);
    expect(screen.getByRole("button", { name: /Previous page/i })).toBeDisabled();
  });

  it("applies custom className", () => {
    const { container } = render(
      <PdfViewer url="https://example.com/test.pdf" className="custom-class" />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("custom-class");
  });
});
