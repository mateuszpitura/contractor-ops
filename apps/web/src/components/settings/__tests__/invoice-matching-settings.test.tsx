import { render, screen } from "@/test/test-utils";
import { InvoiceMatchingSettings } from "../invoice-matching-settings";

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useTranslations: () => (key: string) => key,
  };
});

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: vi.fn().mockImplementation((opts: { queryKey: string[] }) => {
      if (opts?.queryKey?.[1] === "getInvoiceSettings") {
        return { isLoading: false, data: { invoiceDeviationThresholdPercent: 10 } };
      }
      return { isLoading: false, data: { slug: "acme" } };
    }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    settings: {
      get: {
        queryOptions: vi.fn(() => ({ queryKey: ["settings", "get"] })),
      },
      getInvoiceSettings: {
        queryOptions: vi.fn(() => ({ queryKey: ["settings", "getInvoiceSettings"] })),
        queryKey: vi.fn(() => ["settings", "getInvoiceSettings"]),
      },
      updateInvoiceSettings: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("InvoiceMatchingSettings", () => {
  it("renders heading", () => {
    render(<InvoiceMatchingSettings />);
    const matches = screen.getAllByText("invoiceEmailInbox");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders email address with org slug", () => {
    render(<InvoiceMatchingSettings />);
    expect(screen.getByDisplayValue("invoices@acme.contractorhub.io")).toBeInTheDocument();
  });

  it("renders deviation threshold input", () => {
    render(<InvoiceMatchingSettings />);
    expect(screen.getByLabelText("deviationThreshold")).toBeInTheDocument();
  });

  it("renders save button", () => {
    render(<InvoiceMatchingSettings />);
    expect(screen.getByText("saveCta")).toBeInTheDocument();
  });

  // ---- Copy email button ----
  it("renders copy email button", () => {
    render(<InvoiceMatchingSettings />);
    expect(screen.getByLabelText("copyEmail")).toBeInTheDocument();
  });

  // ---- Threshold input value ----
  it("renders threshold input with default value of 10", () => {
    render(<InvoiceMatchingSettings />);
    const input = screen.getByLabelText("deviationThreshold");
    expect(input).toHaveValue(10);
  });

  // ---- Description text ----
  it("renders description text", () => {
    render(<InvoiceMatchingSettings />);
    // invoiceEmailBody is rendered multiple times (CardDescription + help text)
    const matches = screen.getAllByText("invoiceEmailBody");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Help text for threshold ----
  it("renders threshold help text", () => {
    render(<InvoiceMatchingSettings />);
    expect(screen.getByText("deviationThresholdHelp")).toBeInTheDocument();
  });

  // ---- Save button not disabled ----
  it("save button is not disabled", () => {
    render(<InvoiceMatchingSettings />);
    const saveBtn = screen.getByText("saveCta").closest("button");
    expect(saveBtn).not.toBeDisabled();
  });

  // ---- Email address with org slug ----
  it("constructs email from org slug", () => {
    render(<InvoiceMatchingSettings />);
    const input = screen.getByDisplayValue("invoices@acme.contractorhub.io");
    expect(input).toHaveAttribute("readonly");
  });

  // ---- Card structure ----
  it("renders card with header and content", () => {
    const { container } = render(<InvoiceMatchingSettings />);
    expect(container.querySelector('[data-slot="card"]')).toBeInTheDocument();
  });
});
