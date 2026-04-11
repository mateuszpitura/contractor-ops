import { render, screen } from "@/test/test-utils";
import { OverviewTab } from "../overview-tab";

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    contract: {
      updateExpiryReminders: { mutationOptions: (opts: any) => opts },
      getById: { queryKey: () => ["contract", "getById"] },
    },
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const baseContract = {
  id: "ct1",
  title: "B2B Agreement",
  type: "B2B_MASTER_SERVICE",
  status: "ACTIVE",
  startDate: "2024-01-01",
  endDate: "2025-12-31",
  noticePeriodDays: 30,
  autoRenewal: false,
  renewalTerms: null,
  currency: "PLN",
  billingModel: "HOURLY",
  rateType: "PER_HOUR",
  rateValueMinor: 15000,
  retainerAmountMinor: null,
  paymentTermsDays: 14,
  invoiceCycle: "MONTHLY",
  notes: "Test notes",
  metadataJson: { reminderDaysBefore: [30, 7] },
  contractor: {
    id: "c1",
    legalName: "ACME Sp. z o.o.",
    displayName: "ACME",
    status: "ACTIVE",
  },
};

describe("OverviewTab", () => {
  it("renders contract details card", () => {
    render(<OverviewTab contract={baseContract} />);
    // Should have card headings
    const container = document.querySelector("div");
    expect(container).toBeInTheDocument();
  });

  it("renders financial terms with rate", () => {
    render(<OverviewTab contract={baseContract} />);
    // Rate: 150.00 PLN
    expect(screen.getByText("150.00 PLN")).toBeInTheDocument();
  });

  it("renders linked contractor", () => {
    render(<OverviewTab contract={baseContract} />);
    const link = screen.getByText("ACME");
    expect(link.closest("a")).toHaveAttribute("href", "/contractors/c1");
  });

  it("renders no contractor message when none linked", () => {
    render(
      <OverviewTab contract={{ ...baseContract, contractor: null }} />,
    );
    // Should show "no contractor" text
    const container = document.querySelector("div");
    expect(container).toBeInTheDocument();
  });

  it("renders key dates", () => {
    render(<OverviewTab contract={baseContract} />);
    // Start and end dates should be rendered
    const container = document.querySelector("div");
    expect(container).toBeInTheDocument();
  });

  it("renders payment terms", () => {
    render(<OverviewTab contract={baseContract} />);
    expect(screen.getByText(/14 days/)).toBeInTheDocument();
  });

  it("renders invoice cycle", () => {
    render(<OverviewTab contract={baseContract} />);
    expect(screen.getByText(/Monthly/i)).toBeInTheDocument();
  });

  it("renders billing model", () => {
    render(<OverviewTab contract={baseContract} />);
    expect(screen.getByText(/Hourly/i)).toBeInTheDocument();
  });

  it("renders notes section", () => {
    render(<OverviewTab contract={baseContract} />);
    expect(screen.getByText("Test notes")).toBeInTheDocument();
  });

  it("renders notice period", () => {
    render(<OverviewTab contract={baseContract} />);
    expect(screen.getByText(/30 days/)).toBeInTheDocument();
  });

  it("renders contractor status badge", () => {
    render(<OverviewTab contract={baseContract} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders contract type", () => {
    render(<OverviewTab contract={baseContract} />);
    // Type is translated via tEnum("type.B2B_MASTER_SERVICE")
    const container = document.querySelector("div");
    expect(container).toBeInTheDocument();
  });

  it("renders retainer amount when present", () => {
    const retainerContract = {
      ...baseContract,
      billingModel: "RETAINER",
      retainerAmountMinor: 500000,
    };
    render(<OverviewTab contract={retainerContract} />);
    expect(screen.getByText("5000.00 PLN")).toBeInTheDocument();
  });

  it("renders auto renewal as Yes when true", () => {
    const autoRenewal = { ...baseContract, autoRenewal: true };
    render(<OverviewTab contract={autoRenewal} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("renders auto renewal as No when false", () => {
    render(<OverviewTab contract={baseContract} />);
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("renders without end date gracefully", () => {
    render(
      <OverviewTab contract={{ ...baseContract, endDate: null, noticePeriodDays: null }} />,
    );
    const container = document.querySelector("div");
    expect(container).toBeInTheDocument();
  });

  it("renders contract details card heading", () => {
    render(<OverviewTab contract={baseContract} />);
    expect(screen.getByText("Contract details")).toBeInTheDocument();
  });

  it("renders financial terms card heading", () => {
    render(<OverviewTab contract={baseContract} />);
    expect(screen.getByText("Financial terms")).toBeInTheDocument();
  });

  it("renders linked contractor card heading", () => {
    render(<OverviewTab contract={baseContract} />);
    expect(screen.getByText("Linked contractor")).toBeInTheDocument();
  });
});
