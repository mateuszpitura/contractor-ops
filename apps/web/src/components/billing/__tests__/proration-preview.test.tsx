import { render, screen, setup } from "@/test/test-utils";
import { ProrationPreview } from "../proration-preview";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let prorationData: any = null;
let isLoading = false;
let isError = false;

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: prorationData, isLoading, isError }),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    billing: {
      getProrationPreview: { queryOptions: (args: any) => ({}) },
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProrationPreview", () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    prorationData = null;
    isLoading = false;
    isError = false;
    onConfirm.mockClear();
    onCancel.mockClear();
  });

  it("shows error message and cancel button on error", async () => {
    isError = true;
    const { user } = setup(
      <ProrationPreview newPriceId="price_123" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    expect(screen.getByText(/Failed to load proration preview/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("renders line items and total for a charge", () => {
    prorationData = {
      totalMinor: 15000,
      lines: [{ description: "Pro plan (remaining)", amountMinor: 15000 }],
    };
    render(<ProrationPreview newPriceId="price_123" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText("Plan change preview")).toBeInTheDocument();
    expect(screen.getByText("Pro plan (remaining)")).toBeInTheDocument();
    expect(screen.getAllByText("150.00 PLN")).toHaveLength(2); // line item + total
    expect(screen.getByText(/You will be charged 150.00 PLN today/)).toBeInTheDocument();
  });

  it("renders credit message for negative total", () => {
    prorationData = {
      totalMinor: -5000,
      lines: [{ description: "Unused portion credit", amountMinor: -5000 }],
    };
    render(<ProrationPreview newPriceId="price_123" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText(/You will receive a credit of 50.00 PLN/)).toBeInTheDocument();
  });

  it("calls onConfirm when Confirm change is clicked", async () => {
    prorationData = {
      totalMinor: 10000,
      lines: [{ description: "Upgrade", amountMinor: 10000 }],
    };
    const { user } = setup(
      <ProrationPreview newPriceId="price_123" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    await user.click(screen.getByRole("button", { name: /confirm change/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    prorationData = {
      totalMinor: 10000,
      lines: [{ description: "Upgrade", amountMinor: 10000 }],
    };
    const { user } = setup(
      <ProrationPreview newPriceId="price_123" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
