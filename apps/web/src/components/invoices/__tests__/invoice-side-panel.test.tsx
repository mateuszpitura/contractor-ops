import type { ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";

import { render, screen, setup } from "@/test/test-utils";

import type { InvoiceRow } from "../invoice-table/columns";
import { InvoiceSidePanel } from "../invoice-side-panel";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const sampleInvoice: InvoiceRow = {
  id: "inv-panel-1",
  invoiceNumber: "FV/PANEL/01",
  issueDate: "2026-02-01T00:00:00.000Z",
  dueDate: "2030-12-31T00:00:00.000Z",
  subtotalMinor: 5000,
  totalMinor: 6150,
  currency: "EUR",
  status: "APPROVED",
  matchStatus: "MATCHED",
  source: "EMAIL_INTAKE",
  contractor: { id: "c-9", legalName: "Beta LLC" },
};

describe("InvoiceSidePanel", () => {
  it("renders nothing when invoice is null", () => {
    const { container } = render(
      <InvoiceSidePanel
        invoice={null}
        open
        onOpenChange={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows invoice number, amounts, contractor link, and open-invoice CTA when open", async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(
      <InvoiceSidePanel
        invoice={sampleInvoice}
        open
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText("FV/PANEL/01")).toBeInTheDocument();
    expect(screen.getByText("EUR")).toBeInTheDocument();

    const contractor = screen.getByRole("link", { name: /beta llc/i });
    expect(contractor).toHaveAttribute("href", "/contractors/c-9");

    const openInvoice = screen.getByRole("link", { name: /open invoice/i });
    expect(openInvoice).toHaveAttribute("href", "/invoices/inv-panel-1");

    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });
});
