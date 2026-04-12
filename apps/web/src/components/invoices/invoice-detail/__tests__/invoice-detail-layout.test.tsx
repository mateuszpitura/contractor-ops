import { describe, expect, it } from "vitest";

import { render, screen } from "@/test/test-utils";

import { InvoiceDetailLayout } from "../invoice-detail-layout";

describe("InvoiceDetailLayout", () => {
  it("renders a PDF object when pdfUrl is provided", () => {
    const { container } = render(
      <InvoiceDetailLayout pdfUrl="https://example.com/invoice.pdf">
        <p>Side panel</p>
      </InvoiceDetailLayout>,
    );

    const obj = container.querySelector("object");
    expect(obj).toBeTruthy();
    expect(obj).toHaveAttribute("data", "https://example.com/invoice.pdf");
    expect(obj).toHaveAttribute("type", "application/pdf");
    expect(screen.getByText("Side panel")).toBeInTheDocument();
  });

  it("shows a no-PDF message when pdfUrl is null", () => {
    render(
      <InvoiceDetailLayout pdfUrl={null}>
        <span>Metadata</span>
      </InvoiceDetailLayout>,
    );

    expect(screen.getByText(/no pdf available/i)).toBeInTheDocument();
    expect(screen.getByText("Metadata")).toBeInTheDocument();
  });
});
