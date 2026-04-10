import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, setup, waitFor } from "@/test/test-utils";
import { InvoiceSubmitForm } from "../invoice-submit-form";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/components/ocr/confidence-badge", () => ({
  ConfidenceBadge: ({ confidence }: { confidence: number }) => (
    <span data-testid="confidence-badge">{confidence}</span>
  ),
}));

vi.mock("@/components/ocr/nip-validation-badge", () => ({
  NipValidationBadge: ({ nip }: { nip: string }) => (
    <span data-testid="nip-badge">{nip}</span>
  ),
}));

vi.mock("@/components/ocr/extraction-status-bar", () => ({
  ExtractionStatusBar: ({
    status,
    fieldCount,
    totalFields,
  }: {
    status: string;
    fieldCount: number;
    totalFields: number;
  }) => (
    <div data-testid="extraction-status-bar">
      {status} {fieldCount}/{totalFields}
    </div>
  ),
}));

vi.mock("@/components/ocr/ocr-processing-overlay", () => ({
  OcrProcessingOverlay: () => (
    <div data-testid="ocr-processing-overlay">Processing...</div>
  ),
}));

vi.mock("@/components/billing/credit-exhausted-inline", () => ({
  CreditExhaustedInline: ({
    onUpgrade,
    onBuyCredits,
  }: {
    onUpgrade: () => void;
    onBuyCredits: () => void;
  }) => (
    <div data-testid="credit-exhausted-inline" role="alert">
      <span>OCR credits exhausted</span>
      <button type="button" data-testid="upgrade-btn" onClick={onUpgrade}>
        Upgrade plan
      </button>
      <button type="button" data-testid="buy-credits-btn" onClick={onBuyCredits}>
        Buy credits
      </button>
    </div>
  ),
}));

const { MockTRPCClientError } = vi.hoisted(() => {
  class MockTRPCClientError extends Error {
    data: { code: string };
    constructor(message: string, code: string) {
      super(message);
      this.name = "TRPCClientError";
      this.data = { code };
    }
  }
  return { MockTRPCClientError };
});

vi.mock("@trpc/client", () => ({
  TRPCClientError: MockTRPCClientError,
}));

const mockContracts = [
  {
    id: "c1",
    title: "Dev Contract",
    rateValueGrosze: 1500000,
    currency: "PLN",
    rateType: "MONTHLY",
    billingModel: "MONTHLY_RETAINER",
  },
  {
    id: "c2",
    title: "Design Contract",
    rateValueGrosze: 800000,
    currency: "PLN",
    rateType: "HOURLY",
    billingModel: "HOURLY",
  },
];

let contractsData: typeof mockContracts | null = mockContracts;
let contractsLoading = false;
let ocrData: Record<string, unknown> | null = null;

// Track OCR trigger behavior for credit exhaustion tests
let ocrTriggerBehavior: "success" | "credit-exhausted" | "generic-error" = "success";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: (opts: { queryKey?: unknown }) => {
      const key = JSON.stringify(opts.queryKey ?? "");
      if (key.includes("portalGetResult")) {
        return { isLoading: false, data: ocrData };
      }
      return { isLoading: contractsLoading, data: contractsData };
    },
    useMutation: (opts?: { mutationKey?: string[] }) => {
      const key = opts?.mutationKey?.join(".") ?? "";
      return {
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockImplementation(async () => {
          if (key === "ocr.portalTrigger") {
            if (ocrTriggerBehavior === "credit-exhausted") {
              throw new MockTRPCClientError("OCR credits exhausted", "PRECONDITION_FAILED");
            }
            if (ocrTriggerBehavior === "generic-error") {
              throw new Error("Network error");
            }
            return { extractionId: "ext-1" };
          }
          return {
            uploadUrl: "https://upload.test/put",
            documentId: "doc-1",
            storageKey: "key-1",
            extractionId: "ext-1",
            invoiceId: "inv-1",
            invoiceNumber: "INV-001",
          };
        }),
        isPending: false,
      };
    },
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    portal: {
      getActiveContracts: { queryOptions: vi.fn(() => ({ queryKey: ["portal", "getActiveContracts"] })) },
      getUploadUrl: { mutationOptions: vi.fn(() => ({ mutationKey: ["portal", "getUploadUrl"] })) },
      submitInvoice: { mutationOptions: vi.fn(() => ({ mutationKey: ["portal", "submitInvoice"] })) },
    },
    ocr: {
      portalTrigger: { mutationOptions: vi.fn(() => ({ mutationKey: ["ocr", "portalTrigger"] })) },
      portalGetResult: { queryOptions: vi.fn(() => ({ queryKey: ["ocr", "portalGetResult"] })) },
    },
  },
}));

// XHR stub for file upload
function stubXhr() {
  const XhrClass = class {
    status = 200;
    upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    open = vi.fn();
    setRequestHeader = vi.fn();
    send = vi.fn(() => {
      queueMicrotask(() => {
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 100,
          total: 100,
        } as ProgressEvent);
        queueMicrotask(() => {
          this.onload?.();
        });
      });
    });
  };
  vi.stubGlobal("XMLHttpRequest", XhrClass);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InvoiceSubmitForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    contractsData = mockContracts;
    contractsLoading = false;
    ocrData = null;
    ocrTriggerBehavior = "success";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders contract selection with multiple contracts", () => {
    render(<InvoiceSubmitForm />);
    expect(screen.getByText("Contract")).toBeInTheDocument();
    expect(screen.getByText("Invoice PDF")).toBeInTheDocument();
    expect(screen.getByText("Invoice Details")).toBeInTheDocument();
  });

  it("renders drop zone in idle state", () => {
    render(<InvoiceSubmitForm />);
    expect(screen.getByText("Drop your invoice PDF here or browse")).toBeInTheDocument();
    expect(screen.getByText("PDF files only, up to 25 MB")).toBeInTheDocument();
  });

  it("shows loading skeleton when contracts are loading", () => {
    contractsLoading = true;
    contractsData = null;
    const { container } = render(<InvoiceSubmitForm />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("auto-selects contract when only one is available", async () => {
    contractsData = [mockContracts[0]!];
    render(<InvoiceSubmitForm />);
    await waitFor(() => {
      expect(screen.getByText(/Expected:/)).toBeInTheDocument();
    });
  });

  it("renders form fields with placeholders", () => {
    render(<InvoiceSubmitForm />);
    expect(screen.getByPlaceholderText("INV-001")).toBeInTheDocument();
  });

  it("submit button is disabled initially", () => {
    render(<InvoiceSubmitForm />);
    const submitBtn = screen.getByRole("button", { name: "Submit Invoice" });
    expect(submitBtn).toBeDisabled();
  });

  it("shows review section when invoice number is entered", async () => {
    const { user } = setup(<InvoiceSubmitForm />);
    const invoiceInput = screen.getByPlaceholderText("INV-001");
    await user.type(invoiceInput, "INV-123");
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("INV-123")).toBeInTheDocument();
  });

  it("shows extraction status bar with EXTRACTED status", () => {
    ocrData = {
      status: "EXTRACTED",
      resultJson: {
        status: "EXTRACTED",
        fields: {
          invoiceNumber: { value: "FV/2025/01", confidence: 0.95 },
          issueDate: { value: "2025-01-15", confidence: 0.88 },
          totalNet: { value: 100000, confidence: 0.92 },
          totalGross: { value: 123000, confidence: 0.91 },
        },
      },
    };
    render(<InvoiceSubmitForm />);
    expect(screen.getByTestId("extraction-status-bar")).toBeInTheDocument();
    expect(screen.getByTestId("extraction-status-bar")).toHaveTextContent("EXTRACTED");
  });

  it("shows FAILED extraction status", () => {
    ocrData = {
      status: "FAILED",
      resultJson: {
        status: "FAILED",
        fields: {},
        errorMessage: "Could not parse PDF",
      },
    };
    render(<InvoiceSubmitForm />);
    expect(screen.getByTestId("extraction-status-bar")).toHaveTextContent("FAILED");
  });

  it("shows processing overlay when OCR is PROCESSING", () => {
    ocrData = { status: "PROCESSING", resultJson: null };
    render(<InvoiceSubmitForm />);
    expect(screen.getByTestId("ocr-processing-overlay")).toBeInTheDocument();
  });

  it("renders date and amount fields", () => {
    render(<InvoiceSubmitForm />);
    expect(screen.getByText("Issue date")).toBeInTheDocument();
    expect(screen.getByText("Due date")).toBeInTheDocument();
    expect(screen.getByText(/Net amount/)).toBeInTheDocument();
    expect(screen.getByText(/Gross amount/)).toBeInTheDocument();
  });

  it("shows OCR pre-fill banner after extraction populates fields", async () => {
    ocrData = {
      status: "EXTRACTED",
      resultJson: {
        status: "EXTRACTED",
        fields: {
          invoiceNumber: { value: "FV/01", confidence: 0.95 },
        },
      },
    };
    render(<InvoiceSubmitForm />);
    await waitFor(() => {
      expect(screen.queryByText(/pre-filled some fields/)).toBeInTheDocument();
    });
  });

  it("shows confidence badges after OCR extraction", async () => {
    ocrData = {
      status: "EXTRACTED",
      resultJson: {
        status: "EXTRACTED",
        fields: {
          invoiceNumber: { value: "FV/01", confidence: 0.95 },
          issueDate: { value: "2025-01-01", confidence: 0.85 },
          dueDate: { value: "2025-02-01", confidence: 0.80 },
          totalNet: { value: 50000, confidence: 0.90 },
          totalGross: { value: 61500, confidence: 0.88 },
        },
      },
    };
    render(<InvoiceSubmitForm />);
    await waitFor(() => {
      const badges = screen.getAllByTestId("confidence-badge");
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it("shows NIP badges when seller NIP is present in extraction", async () => {
    ocrData = {
      status: "EXTRACTED",
      resultJson: {
        status: "EXTRACTED",
        fields: {
          invoiceNumber: { value: "FV/01", confidence: 0.95 },
          sellerNip: { value: "1234567890", confidence: 0.99 },
          buyerNip: { value: "0987654321", confidence: 0.95 },
        },
      },
    };
    render(<InvoiceSubmitForm />);
    await waitFor(() => {
      const nipBadges = screen.getAllByTestId("nip-badge");
      expect(nipBadges.length).toBe(2);
    });
  });

  it("renders CreditExhaustedInline when OCR returns PRECONDITION_FAILED credit error", async () => {
    ocrTriggerBehavior = "credit-exhausted";
    stubXhr();

    const { user } = setup(<InvoiceSubmitForm />);

    // No credit-exhausted banner initially
    expect(screen.queryByTestId("credit-exhausted-inline")).not.toBeInTheDocument();

    // Simulate file drop via the hidden file input
    const file = new File(["%PDF-1.4 test"], "inv-credit.pdf", {
      type: "application/pdf",
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    await user.upload(input, file);

    // Wait for the async upload chain to complete and credit exhaustion to be detected
    await waitFor(() => {
      expect(screen.getByTestId("credit-exhausted-inline")).toBeInTheDocument();
    });

    expect(screen.getByText("OCR credits exhausted")).toBeInTheDocument();
    expect(screen.getByText("Upgrade plan")).toBeInTheDocument();
    expect(screen.getByText("Buy credits")).toBeInTheDocument();
  });

  it("does not render CreditExhaustedInline on generic OCR error", async () => {
    ocrTriggerBehavior = "generic-error";
    stubXhr();
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { user } = setup(<InvoiceSubmitForm />);

    const file = new File(["%PDF-1.4 test"], "inv-generic.pdf", {
      type: "application/pdf",
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    await user.upload(input, file);

    // Wait for the upload chain to settle
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("manual entry available"),
      );
    });

    // CreditExhaustedInline should NOT appear for generic errors
    expect(screen.queryByTestId("credit-exhausted-inline")).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
