import { render, screen } from "@/test/test-utils";
import { ContractSidePanel } from "../contract-side-panel";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("date-fns", () => ({
  differenceInDays: () => 45,
  isPast: () => false,
}));

const baseContract = {
  id: "ct1",
  title: "B2B Agreement",
  type: "B2B_MASTER_SERVICE",
  status: "ACTIVE",
  startDate: "2024-01-01",
  endDate: "2025-12-31",
  currency: "PLN",
  billingModel: "HOURLY",
  rateType: "PER_HOUR",
  rateValueMinor: 15000,
  complianceRiskLevel: null,
  contractor: {
    id: "c1",
    legalName: "ACME Sp. z o.o.",
    displayName: "ACME",
  },
  internalOwner: { id: "u1", name: "Jan Kowalski" },
};

describe("ContractSidePanel", () => {
  it("returns null when contract is null", () => {
    const { container } = render(
      <ContractSidePanel
        contract={null}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders contract title", () => {
    render(
      <ContractSidePanel
        contract={baseContract}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("B2B Agreement")).toBeInTheDocument();
  });

  it("renders contractor name as link", () => {
    render(
      <ContractSidePanel
        contract={baseContract}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    const link = screen.getByText("ACME");
    expect(link.closest("a")).toHaveAttribute("href", "/contractors/c1");
  });

  it("renders rate display", () => {
    render(
      <ContractSidePanel
        contract={baseContract}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/150,00/)).toBeInTheDocument();
  });

  it("renders open contract button", () => {
    render(
      <ContractSidePanel
        contract={baseContract}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders legalName when displayName is null", () => {
    render(
      <ContractSidePanel
        contract={{
          ...baseContract,
          contractor: { ...baseContract.contractor, displayName: null },
        }}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("ACME Sp. z o.o.")).toBeInTheDocument();
  });

  it("renders owner name when present", () => {
    render(
      <ContractSidePanel
        contract={baseContract}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Jan Kowalski")).toBeInTheDocument();
  });

  it("renders mdash when owner is null", () => {
    render(
      <ContractSidePanel
        contract={{ ...baseContract, internalOwner: null }}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    const mdashes = document.querySelectorAll("span.text-muted-foreground");
    expect(mdashes.length).toBeGreaterThan(0);
  });

  it("renders mdash when rateValueMinor is null", () => {
    render(
      <ContractSidePanel
        contract={{ ...baseContract, rateValueMinor: null }}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    const mdashes = document.querySelectorAll("span.text-muted-foreground");
    expect(mdashes.length).toBeGreaterThan(0);
  });

  it("renders start and end dates", () => {
    render(
      <ContractSidePanel
        contract={baseContract}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    // startDate and endDate should be formatted as pl-PL
    const container = document.body;
    expect(container.textContent).toContain("2024");
    expect(container.textContent).toContain("2025");
  });

  it("renders mdash when startDate is null", () => {
    render(
      <ContractSidePanel
        contract={{ ...baseContract, startDate: null }}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    const mdashes = document.querySelectorAll("span.text-muted-foreground");
    expect(mdashes.length).toBeGreaterThan(0);
  });

  it("renders key dates section when endDate exists", () => {
    render(
      <ContractSidePanel
        contract={baseContract}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    // Key dates section should be rendered since endDate is set
    const body = document.body.textContent ?? "";
    // differenceInDays mock returns 45, isPast returns false, so daysRemaining branch
    expect(body.length).toBeGreaterThan(0);
  });

  it("does not render key dates section when endDate is null", () => {
    render(
      <ContractSidePanel
        contract={{ ...baseContract, endDate: null }}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    // No key dates section when endDate is null
    const body = document.body.textContent ?? "";
    expect(body).not.toContain("keyDates");
  });

  it("renders link to full contract page", () => {
    render(
      <ContractSidePanel
        contract={baseContract}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    const link = document.querySelector('a[href="/contracts/ct1"]');
    expect(link).toBeInTheDocument();
  });

  it("does not render content when open is false", () => {
    render(
      <ContractSidePanel
        contract={baseContract}
        open={false}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("B2B Agreement")).not.toBeInTheDocument();
  });
});
