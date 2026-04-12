import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { MatchCard } from "../match-card";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/trpc/init", () => ({
  trpc: {
    invoice: {
      searchContractors: {
        queryOptions: vi.fn(() => ({
          queryKey: ["searchContractors"],
          queryFn: () => [],
        })),
      },
      contractsForContractor: {
        queryOptions: vi.fn(() => ({
          queryKey: ["contracts"],
          queryFn: () => [],
        })),
      },
      manualMatch: {
        mutationOptions: vi.fn((opts: any) => opts),
      },
    },
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const usePermissionsMock = vi.fn(() => ({ role: "admin" }));
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => usePermissionsMock(),
}));

vi.mock("@/lib/mask-pii", () => ({
  maskTaxId: (taxId: string) => {
    const cleaned = taxId.replace(/\s/g, "");
    if (cleaned.length <= 4) return "••••";
    return `${cleaned.slice(0, 2)}${"•".repeat(cleaned.length - 4)}${cleaned.slice(-2)}`;
  },
  canViewSensitivePii: (role: string) =>
    ["owner", "admin", "finance_admin", "ops_manager", "external_accountant"].includes(role),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: [], isLoading: false })),
    useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    matchStatus: "MATCHED",
    contractorId: "ctr-1",
    contractId: "con-1",
    totalMinor: 500000, // 5 000,00
    currency: "PLN",
    flagsJson: null,
    contractor: {
      id: "ctr-1",
      legalName: "Acme Corp",
      taxId: "1234567890",
    },
    contract: {
      id: "con-1",
      title: "Dev Services",
      type: "B2B",
      status: "ACTIVE",
      rateValueMinor: 500000,
      currency: "PLN",
    },
    matchResults: [
      {
        matchScore: 95,
        expectedAmountMinor: 500000,
        amountDeltaMinor: 0,
        amountDeltaPercent: 0,
        explanationJson: null,
        status: "MATCHED",
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MatchCard", () => {
  beforeEach(() => {
    usePermissionsMock.mockReturnValue({ role: "admin" });
  });

  // ---- Matched card basics ------------------------------------------------

  it("renders heading for matched invoice", () => {
    render(<MatchCard invoice={createInvoice()} />);

    expect(screen.getByText("Matching")).toBeInTheDocument();
  });

  it("shows confidence indicator with score percentage", () => {
    render(<MatchCard invoice={createInvoice()} />);

    expect(screen.getByText("Match confidence")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
  });

  // ---- Confidence dot colors -----------------------------------------------

  it("renders green dot for strong match (>=90)", () => {
    const { container } = render(<MatchCard invoice={createInvoice()} />);

    const dot = container.querySelector(".bg-green-500.rounded-full");
    expect(dot).toBeInTheDocument();
    expect(screen.getByText("Strong match")).toBeInTheDocument();
  });

  it("renders amber dot for partial match (50-89)", () => {
    const invoice = createInvoice({
      matchResults: [
        {
          matchScore: 65,
          expectedAmountMinor: 500000,
          amountDeltaMinor: 0,
          amountDeltaPercent: 0,
          explanationJson: null,
          status: "MATCHED",
        },
      ],
    });
    const { container } = render(<MatchCard invoice={invoice} />);

    const dot = container.querySelector(".bg-amber-500.rounded-full");
    expect(dot).toBeInTheDocument();
    expect(screen.getByText("Partial match")).toBeInTheDocument();
  });

  it("renders red dot for weak match (<50)", () => {
    const invoice = createInvoice({
      matchResults: [
        {
          matchScore: 30,
          expectedAmountMinor: 500000,
          amountDeltaMinor: 0,
          amountDeltaPercent: 0,
          explanationJson: null,
          status: "MATCHED",
        },
      ],
    });
    const { container } = render(<MatchCard invoice={invoice} />);

    const dot = container.querySelector(".bg-red-500.rounded-full");
    expect(dot).toBeInTheDocument();
    expect(screen.getByText("Weak match")).toBeInTheDocument();
  });

  // ---- Contractor & contract links -----------------------------------------

  it("shows contractor name as link to /contractors/{id}", () => {
    render(<MatchCard invoice={createInvoice()} />);

    const link = screen.getByRole("link", { name: "Acme Corp" });
    expect(link).toHaveAttribute("href", "/contractors/ctr-1");
  });

  it("shows contract title as link to /contracts/{id}", () => {
    render(<MatchCard invoice={createInvoice()} />);

    const link = screen.getByRole("link", { name: "Dev Services" });
    expect(link).toHaveAttribute("href", "/contracts/con-1");
  });

  // ---- PII masking ---------------------------------------------------------

  it("shows full tax ID for admin role", () => {
    render(<MatchCard invoice={createInvoice()} />);

    expect(screen.getByText("1234567890")).toBeInTheDocument();
  });

  it("masks tax ID for non-admin role", () => {
    usePermissionsMock.mockReturnValue({ role: "member" });

    render(<MatchCard invoice={createInvoice()} />);

    expect(screen.getByText("12••••••90")).toBeInTheDocument();
    expect(screen.queryByText("1234567890")).not.toBeInTheDocument();
  });

  // ---- Deviation section ---------------------------------------------------

  it("shows expected and actual amounts formatted in deviation section", () => {
    render(<MatchCard invoice={createInvoice()} />);

    expect(screen.getByText("Expected")).toBeInTheDocument();
    expect(screen.getByText("Actual")).toBeInTheDocument();
    expect(screen.getByText("Deviation")).toBeInTheDocument();
    // formatMinorUnits(500000) with pl-PL => "5 000,00" (narrow no-break space)
    const amounts = screen.getAllByText(
      (_content, el) => !!el?.textContent?.includes("5") && !!el?.textContent?.includes("PLN"),
    );
    expect(amounts.length).toBeGreaterThan(0);
  });

  it("renders destructive color for deviation >10%", () => {
    const invoice = createInvoice({
      matchResults: [
        {
          matchScore: 70,
          expectedAmountMinor: 500000,
          amountDeltaMinor: 100000,
          amountDeltaPercent: 20,
          explanationJson: null,
          status: "MATCHED",
        },
      ],
    });
    const { container } = render(<MatchCard invoice={invoice} />);

    const deviationEl = container.querySelector(".text-destructive");
    expect(deviationEl).toBeInTheDocument();
    expect(deviationEl?.textContent).toContain("20.0%");
  });

  it("renders green color for deviation <=10%", () => {
    const invoice = createInvoice({
      matchResults: [
        {
          matchScore: 90,
          expectedAmountMinor: 500000,
          amountDeltaMinor: 25000,
          amountDeltaPercent: 5,
          explanationJson: null,
          status: "MATCHED",
        },
      ],
    });
    const { container } = render(<MatchCard invoice={invoice} />);

    const greenEl = container.querySelector('[class*="text-green-600"], [class*="text-green-400"]');
    expect(greenEl).toBeInTheDocument();
    expect(greenEl?.textContent).toContain("5.0%");
  });

  // ---- Flags ---------------------------------------------------------------

  it("renders NO_ACTIVE_CONTRACT flag badge", () => {
    const invoice = createInvoice({
      flagsJson: ["NO_ACTIVE_CONTRACT"],
    });
    render(<MatchCard invoice={invoice} />);

    expect(screen.getByText("No active contract found")).toBeInTheDocument();
  });

  it("filters out DUPLICATE_SUSPECTED flag", () => {
    const invoice = createInvoice({
      flagsJson: ["DUPLICATE_SUSPECTED", "NO_ACTIVE_CONTRACT"],
    });
    render(<MatchCard invoice={invoice} />);

    expect(screen.getByText("No active contract found")).toBeInTheDocument();
    // DUPLICATE_SUSPECTED has no entry in FLAG_CONFIG so it would not render anyway,
    // but we verify it does not appear.
    expect(screen.queryByText("DUPLICATE_SUSPECTED")).not.toBeInTheDocument();
  });

  it("renders CURRENCY_MISMATCH flag badge", () => {
    const invoice = createInvoice({
      flagsJson: ["CURRENCY_MISMATCH"],
    });
    render(<MatchCard invoice={invoice} />);

    expect(screen.getByText("Currency mismatch")).toBeInTheDocument();
  });

  // ---- MANUALLY_CONFIRMED ---------------------------------------------------

  it("shows manual match badge for MANUALLY_CONFIRMED status", () => {
    const invoice = createInvoice({ matchStatus: "MANUALLY_CONFIRMED" });
    render(<MatchCard invoice={invoice} />);

    expect(screen.getByText("Manually matched")).toBeInTheDocument();
  });

  // ---- Edge case: empty matchResults -----------------------------------------

  it("handles empty matchResults without crashing", () => {
    const invoice = createInvoice({
      matchResults: [],
    });
    render(<MatchCard invoice={invoice} />);

    // Should render heading even with no results
    expect(screen.getByText("Matching")).toBeInTheDocument();
    // Score should fall back to 0 (weak match)
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  // ---- UNMATCHED card -------------------------------------------------------

  it("renders unmatched card with amber styling for UNMATCHED status", () => {
    const invoice = createInvoice({
      matchStatus: "UNMATCHED",
      contractor: null,
      contract: null,
      contractorId: null,
      contractId: null,
      matchResults: [],
    });
    const { container } = render(<MatchCard invoice={invoice} />);

    expect(screen.getByText("No match found")).toBeInTheDocument();
    const card = container.querySelector('[class*="border-amber"]');
    expect(card).toBeInTheDocument();
  });

  it("disables confirm button when no contractor is selected in unmatched card", () => {
    const invoice = createInvoice({
      matchStatus: "UNMATCHED",
      contractor: null,
      contract: null,
      contractorId: null,
      contractId: null,
      matchResults: [],
    });
    render(<MatchCard invoice={invoice} />);

    const button = screen.getByRole("button", { name: "Confirm match" });
    expect(button).toBeDisabled();
  });

  // ---- EXPIRED_CONTRACT flag -------------------------------------------------

  it("renders EXPIRED_CONTRACT flag badge", () => {
    const invoice = createInvoice({
      flagsJson: ["EXPIRED_CONTRACT"],
    });
    render(<MatchCard invoice={invoice} />);

    expect(screen.getByText("Matched contract is expired")).toBeInTheDocument();
  });

  // ---- No contractor or contract ------------------------------------------------

  it("does not render contractor section when contractor is null", () => {
    const invoice = createInvoice({ contractor: null });
    render(<MatchCard invoice={invoice} />);

    expect(screen.queryByRole("link", { name: "Acme Corp" })).not.toBeInTheDocument();
  });

  it("does not render contract section when contract is null", () => {
    const invoice = createInvoice({ contract: null });
    render(<MatchCard invoice={invoice} />);

    expect(screen.queryByRole("link", { name: "Dev Services" })).not.toBeInTheDocument();
  });

  // ---- No deviation section when missing data ---------------------------------

  it("does not render deviation section when expectedAmountMinor is null", () => {
    const invoice = createInvoice({
      matchResults: [
        {
          matchScore: 90,
          expectedAmountMinor: null,
          amountDeltaMinor: null,
          amountDeltaPercent: null,
          explanationJson: null,
          status: "MATCHED",
        },
      ],
    });
    render(<MatchCard invoice={invoice} />);

    expect(screen.queryByText("Expected")).not.toBeInTheDocument();
    expect(screen.queryByText("Deviation")).not.toBeInTheDocument();
  });

  // ---- Negative deviation --------------------------------------------------

  it("renders negative deviation without plus sign", () => {
    const invoice = createInvoice({
      matchResults: [
        {
          matchScore: 90,
          expectedAmountMinor: 600000,
          amountDeltaMinor: -100000,
          amountDeltaPercent: -5,
          explanationJson: null,
          status: "MATCHED",
        },
      ],
    });
    const { container } = render(<MatchCard invoice={invoice} />);

    const greenEl = container.querySelector('[class*="text-green-600"], [class*="text-green-400"]');
    expect(greenEl?.textContent).toContain("-5.0%");
  });

  // ---- Contractor without taxId -----------------------------------------------

  it("does not render taxId when contractor has no taxId", () => {
    const invoice = createInvoice({
      contractor: { id: "ctr-1", legalName: "Acme Corp", taxId: null },
    });
    render(<MatchCard invoice={invoice} />);

    expect(screen.queryByText(/\d{10}/)).not.toBeInTheDocument();
  });

  // ---- Empty flags array -------------------------------------------------------

  it("does not render flags section when flagsJson is empty array", () => {
    const invoice = createInvoice({ flagsJson: [] });
    render(<MatchCard invoice={invoice} />);

    expect(screen.queryByText("No active contract found")).not.toBeInTheDocument();
    expect(screen.queryByText("Currency mismatch")).not.toBeInTheDocument();
  });

  // ---- Unknown flag config ----------------------------------------------------

  it("does not render badge for unknown flag", () => {
    const invoice = createInvoice({ flagsJson: ["UNKNOWN_FLAG"] });
    render(<MatchCard invoice={invoice} />);

    expect(screen.queryByText("UNKNOWN_FLAG")).not.toBeInTheDocument();
  });

  // ---- Unmatched card: contractor search interactions -----------------------

  it("renders contractor search button in unmatched card", () => {
    const invoice = createInvoice({
      matchStatus: "UNMATCHED",
      contractor: null,
      contract: null,
      contractorId: null,
      contractId: null,
      matchResults: [],
    });
    render(<MatchCard invoice={invoice} />);

    // The search button has the placeholder text
    expect(screen.getByText(/Search contractor by name or NIP/)).toBeInTheDocument();
  });

  it("shows contractor label in unmatched card", () => {
    const invoice = createInvoice({
      matchStatus: "UNMATCHED",
      contractor: null,
      contract: null,
      contractorId: null,
      contractId: null,
      matchResults: [],
    });
    render(<MatchCard invoice={invoice} />);

    // The label "Contractor" appears in the unmatched card
    const labels = screen.getAllByText("Contractor");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("confirm match button shows correct text", () => {
    const invoice = createInvoice({
      matchStatus: "UNMATCHED",
      contractor: null,
      contract: null,
      contractorId: null,
      contractId: null,
      matchResults: [],
    });
    render(<MatchCard invoice={invoice} />);

    expect(screen.getByRole("button", { name: "Confirm match" })).toBeInTheDocument();
  });

  // ---- Multiple flags rendered simultaneously --------------------------------

  it("renders multiple flags at once", () => {
    const invoice = createInvoice({
      flagsJson: ["NO_ACTIVE_CONTRACT", "EXPIRED_CONTRACT", "CURRENCY_MISMATCH"],
    });
    render(<MatchCard invoice={invoice} />);

    expect(screen.getByText("No active contract found")).toBeInTheDocument();
    expect(screen.getByText("Matched contract is expired")).toBeInTheDocument();
    expect(screen.getByText("Currency mismatch")).toBeInTheDocument();
  });

  // ---- Deviation with plus sign for positive ----------------------------------

  it("renders positive deviation with plus sign", () => {
    const invoice = createInvoice({
      matchResults: [
        {
          matchScore: 80,
          expectedAmountMinor: 500000,
          amountDeltaMinor: 50000,
          amountDeltaPercent: 10,
          explanationJson: null,
          status: "MATCHED",
        },
      ],
    });
    const { container } = render(<MatchCard invoice={invoice} />);

    const deviationEls = container.querySelectorAll(".font-mono.font-medium");
    const deviationText = Array.from(deviationEls)
      .map((el) => el.textContent)
      .join("");
    expect(deviationText).toContain("+10.0%");
  });

  // ---- Contract type badge in matched card -----------------------------------

  it("shows contract type badge", () => {
    render(<MatchCard invoice={createInvoice()} />);
    expect(screen.getByText("B2B")).toBeInTheDocument();
  });
});
