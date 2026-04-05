import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, setup, waitFor } from "@/test/test-utils";

import { InvoiceUploadArea } from "../invoice-upload-area";

const { sampleOcrDataForMock } = vi.hoisted(() => ({
  sampleOcrDataForMock: {
    invoiceNumber: "INV-ACCEPT-1",
    issueDate: "2026-01-01",
    dueDate: "2026-01-15",
    currency: "PLN",
    subtotalGrosze: 10000,
    vatAmountGrosze: 2300,
    totalGrosze: 12300,
    sellerTaxId: "5250000000",
    sellerName: "Seller Sp. z o.o.",
    buyerTaxId: "",
    buyerName: "Buyer SA",
    sellerBankAccount: "",
    lineItems: [] as {
      id: string;
      description: string;
      quantity: number | null;
      unit: string | null;
      unitPriceGrosze: number | null;
      netAmountGrosze: number | null;
      vatRate: string | null;
      vatAmountGrosze: number | null;
      grossAmountGrosze: number | null;
      confidence: number;
    }[],
  },
}));

const { toastSuccess, toastError, invalidateQueries } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries,
    }),
  };
});

const {
  requestUploadMutationFn,
  confirmUploadMutationFn,
  createInvoiceMutationFn,
  ocrTriggerMutationFn,
  ocrRetriggerMutationFn,
} = vi.hoisted(() => ({
  requestUploadMutationFn: vi.fn(async () => ({
    documentId: "doc-1",
    uploadUrl: "https://r2.example/put",
    storageKey: "sk-1",
  })),
  confirmUploadMutationFn: vi.fn(async () => ({})),
  createInvoiceMutationFn: vi.fn(async () => ({})),
  ocrTriggerMutationFn: vi.fn(async () => ({ extractionId: "ext-1" })),
  ocrRetriggerMutationFn: vi.fn(async () => ({ extractionId: "ext-2" })),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    document: {
      requestUpload: {
        mutationOptions: vi.fn(() => ({
          mutationKey: ["document", "requestUpload"],
          mutationFn: requestUploadMutationFn,
        })),
      },
      confirmUpload: {
        mutationOptions: vi.fn(() => ({
          mutationKey: ["document", "confirmUpload"],
          mutationFn: confirmUploadMutationFn,
        })),
      },
    },
    invoice: {
      create: {
        mutationOptions: vi.fn(() => ({
          mutationKey: ["invoice", "create"],
          mutationFn: createInvoiceMutationFn,
        })),
      },
      list: {
        queryKey: vi.fn(() => ["invoice", "list"] as const),
      },
      statusCounts: {
        queryKey: vi.fn(() => ["invoice", "statusCounts"] as const),
      },
    },
    ocr: {
      trigger: {
        mutationOptions: vi.fn(() => ({
          mutationKey: ["ocr", "trigger"],
          mutationFn: ocrTriggerMutationFn,
        })),
      },
      retrigger: {
        mutationOptions: vi.fn(() => ({
          mutationKey: ["ocr", "retrigger"],
          mutationFn: ocrRetriggerMutationFn,
        })),
      },
    },
  },
}));

vi.mock("@/components/ocr/ocr-review-panel", () => ({
  OcrReviewPanel: ({
    onAccept,
    onDiscard,
    onRetrigger,
  }: {
    onAccept: (data: typeof sampleOcrDataForMock) => void;
    onDiscard: () => void;
    onRetrigger: () => void | Promise<void>;
  }) => (
    <div data-testid="ocr-review-panel">
      <button type="button" onClick={() => onAccept(sampleOcrDataForMock)}>
        Apply OCR data
      </button>
      <button type="button" onClick={() => onDiscard()}>
        Discard OCR
      </button>
      <button type="button" onClick={() => void onRetrigger()}>
        Re-run OCR
      </button>
    </div>
  ),
}));

const { mockRouterPush } = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
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

// ---------------------------------------------------------------------------
// TRPCClientError stub — must match the real class enough for instanceof check
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// XHR helpers
// ---------------------------------------------------------------------------

function XhrSuccess() {
  return class {
    status = 200;
    upload = {
      onprogress: null as ((e: ProgressEvent) => void) | null,
    };
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
}

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InvoiceUploadArea", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateQueries.mockClear();
    mockRouterPush.mockClear();
    requestUploadMutationFn.mockClear();
    requestUploadMutationFn.mockImplementation(async () => ({
      documentId: "doc-1",
      uploadUrl: "https://r2.example/put",
      storageKey: "sk-1",
    }));
    confirmUploadMutationFn.mockClear();
    createInvoiceMutationFn.mockClear();
    ocrTriggerMutationFn.mockClear();
    ocrRetriggerMutationFn.mockClear();
    ocrRetriggerMutationFn.mockImplementation(async () => ({
      extractionId: "ext-2",
    }));
    vi.stubGlobal("XMLHttpRequest", XhrSuccess());
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-pdf");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders CreditExhaustedInline when OCR returns PRECONDITION_FAILED credit error", async () => {
    ocrTriggerMutationFn.mockRejectedValueOnce(
      new MockTRPCClientError("OCR credits exhausted", "PRECONDITION_FAILED"),
    );

    const { user } = setup(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <InvoiceUploadArea />
      </QueryClientProvider>,
    );

    // No credit-exhausted banner initially
    expect(screen.queryByTestId("credit-exhausted-inline")).not.toBeInTheDocument();

    const file = new File(["%PDF-1.4 test"], "inv-credit.pdf", {
      type: "application/pdf",
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    await user.upload(input, file);

    // Wait for upload chain to complete and credit exhaustion to be detected
    await waitFor(() => {
      expect(ocrTriggerMutationFn).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId("credit-exhausted-inline")).toBeInTheDocument();
    });

    expect(screen.getByText("OCR credits exhausted")).toBeInTheDocument();
    expect(screen.getByText("Upgrade plan")).toBeInTheDocument();
    expect(screen.getByText("Buy credits")).toBeInTheDocument();
  });

  it("does not render CreditExhaustedInline on generic OCR error", async () => {
    ocrTriggerMutationFn.mockRejectedValueOnce(new Error("Network error"));

    const { user } = setup(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <InvoiceUploadArea />
      </QueryClientProvider>,
    );

    const file = new File(["%PDF-1.4 test"], "inv-generic.pdf", {
      type: "application/pdf",
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(ocrTriggerMutationFn).toHaveBeenCalled();
    });

    // Give the async chain time to settle
    await waitFor(() => {
      expect(createInvoiceMutationFn).toHaveBeenCalled();
    });

    // CreditExhaustedInline should NOT appear for generic errors
    expect(screen.queryByTestId("credit-exhausted-inline")).not.toBeInTheDocument();
  });

  it("navigates to /settings?tab=billing when Upgrade plan is clicked", async () => {
    ocrTriggerMutationFn.mockRejectedValueOnce(
      new MockTRPCClientError("OCR credits exhausted", "PRECONDITION_FAILED"),
    );

    const { user } = setup(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <InvoiceUploadArea />
      </QueryClientProvider>,
    );

    const file = new File(["%PDF-1.4 test"], "inv-upgrade.pdf", {
      type: "application/pdf",
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByTestId("credit-exhausted-inline")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("upgrade-btn"));
    expect(mockRouterPush).toHaveBeenCalledWith("/settings?tab=billing");
  });
});
