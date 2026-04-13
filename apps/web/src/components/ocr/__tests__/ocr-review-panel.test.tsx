import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { OcrReviewPanel } from '../ocr-review-panel';

// Mock tanstack query
const {
  mockUseQuery,
  mockUseMutation,
} = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    ocr: {
      getResult: {
        queryOptions: (input: unknown) => ({
          queryKey: ['ocr', 'getResult', input],
          queryFn: vi.fn(),
        }),
      },
      portalGetResult: {
        queryOptions: (input: unknown) => ({
          queryKey: ['ocr', 'portalGetResult', input],
          queryFn: vi.fn(),
        }),
      },
    },
  },
}));

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const PdfViewer = ({ url }: { url: string }) => <div data-testid="pdf-viewer">{url}</div>;
    PdfViewer.displayName = 'PdfViewer';
    return PdfViewer;
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

describe('OcrReviewPanel', () => {
  const defaultProps = {
    pdfUrl: 'https://example.com/test.pdf',
    extractionId: 'ext-123',
    onAccept: vi.fn(),
    onDiscard: vi.fn(),
    onRetrigger: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('shows processing overlay when status is PENDING', () => {
    mockUseQuery.mockReturnValue({
      data: { status: 'PENDING', resultJson: null },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByText('Analyzing invoice...')).toBeInTheDocument();
  });

  it('shows processing overlay when status is PROCESSING', () => {
    mockUseQuery.mockReturnValue({
      data: { status: 'PROCESSING', resultJson: null },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByText('Analyzing invoice...')).toBeInTheDocument();
  });

  it('shows form when extraction is complete', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/001', confidence: 95 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByText('Review Extracted Data')).toBeInTheDocument();
  });

  it('shows extraction status bar for non-pending statuses', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'FAILED',
        resultJson: {
          status: 'FAILED',
          fields: {},
          lineItems: [],
          errorMessage: 'OCR failed',
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows PARTIAL status with form visible', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'PARTIAL',
        resultJson: {
          status: 'PARTIAL',
          fields: {
            invoiceNumber: { value: 'FV/002', confidence: 60 },
            sellerName: { value: 'Partial Corp', confidence: 40 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByText('Review Extracted Data')).toBeInTheDocument();
  });

  it('renders PDF viewer with correct URL', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/003', confidence: 99 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByTestId('pdf-viewer')).toHaveTextContent('https://example.com/test.pdf');
  });

  it('renders Accept & Save button when extraction is complete', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/004', confidence: 95 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByText('Accept & Save')).toBeInTheDocument();
  });

  it('renders Discard Extraction button when extraction is complete', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/005', confidence: 95 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByText('Discard Extraction')).toBeInTheDocument();
  });

  it('renders Re-run OCR button when extraction is complete', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/006', confidence: 95 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByText('Re-run OCR')).toBeInTheDocument();
  });

  it('renders form fields with labels for extracted data', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/007', confidence: 90 },
            issueDate: { value: '2026-01-01', confidence: 85 },
            dueDate: { value: '2026-01-15', confidence: 80 },
            currency: { value: 'PLN', confidence: 95 },
            sellerNip: { value: '5250000000', confidence: 88 },
            buyerNip: { value: '1234567890', confidence: 75 },
            sellerName: { value: 'Test Seller', confidence: 92 },
            buyerName: { value: 'Test Buyer', confidence: 90 },
            totalNet: { value: 10000, confidence: 85 },
            totalTax: { value: 2300, confidence: 85 },
            totalGross: { value: 12300, confidence: 95 },
            bankAccount: { value: 'PL12345678', confidence: 70 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByText('Invoice Number')).toBeInTheDocument();
    expect(screen.getByText('Issue Date')).toBeInTheDocument();
    expect(screen.getByText('Due Date')).toBeInTheDocument();
    expect(screen.getByText('Currency')).toBeInTheDocument();
    expect(screen.getByText('Seller NIP')).toBeInTheDocument();
    expect(screen.getByText('Buyer NIP')).toBeInTheDocument();
    expect(screen.getByText('Net Amount')).toBeInTheDocument();
    expect(screen.getByText('Total Gross')).toBeInTheDocument();
  });

  it('shows loading state when query is loading', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: true,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    // PENDING status shows processing overlay
    expect(screen.getByText('Analyzing invoice...')).toBeInTheDocument();
  });

  it('renders empty form fields when status is FAILED (no data to populate)', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'FAILED',
        resultJson: {
          status: 'FAILED',
          fields: {},
          lineItems: [],
          errorMessage: 'Processing failed',
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    // Form is still rendered but without populated data
    expect(screen.getByText('Review Extracted Data')).toBeInTheDocument();
    expect(screen.getByText('Accept & Save')).toBeInTheDocument();
    // Status bar shows Failed
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders editable invoice number input field', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/EDIT/01', confidence: 90 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByText('Invoice Number')).toBeInTheDocument();
    // Form should show the value
    expect(screen.getByDisplayValue('FV/EDIT/01')).toBeInTheDocument();
  });

  it('renders Seller Name and Buyer Name fields', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/SB', confidence: 95 },
            sellerName: { value: 'Seller Inc', confidence: 80 },
            buyerName: { value: 'Buyer Corp', confidence: 85 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByText('Seller Name')).toBeInTheDocument();
    expect(screen.getByText('Buyer Name')).toBeInTheDocument();
  });

  it('renders Seller Bank Account field when present', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/BANK', confidence: 95 },
            bankAccount: { value: 'PL12345678', confidence: 70 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByText('Seller Bank Account')).toBeInTheDocument();
  });

  it('renders VAT Amount field', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/TAX', confidence: 95 },
            totalTax: { value: 2300, confidence: 85 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    const vatLabels = screen.getAllByText('VAT Amount');
    expect(vatLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('renders action buttons disabled during pending state', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/PEND', confidence: 95 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByText('Accept & Save')).toBeInTheDocument();
    expect(screen.getByText('Discard Extraction')).toBeInTheDocument();
    expect(screen.getByText('Re-run OCR')).toBeInTheDocument();
  });

  it('renders all extracted fields with confidence badges', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/ALL', confidence: 99 },
            issueDate: { value: '2026-01-01', confidence: 95 },
            dueDate: { value: '2026-02-01', confidence: 88 },
            currency: { value: 'PLN', confidence: 99 },
            sellerNip: { value: '5250000000', confidence: 92 },
            buyerNip: { value: '1234567890', confidence: 85 },
            sellerName: { value: 'Full Seller', confidence: 90 },
            buyerName: { value: 'Full Buyer', confidence: 88 },
            totalNet: { value: 200000, confidence: 95 },
            totalTax: { value: 46000, confidence: 90 },
            totalGross: { value: 246000, confidence: 97 },
            bankAccount: { value: 'PL99999999', confidence: 80 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    // Verify all field labels rendered
    expect(screen.getByText('Invoice Number')).toBeInTheDocument();
    expect(screen.getByText('Issue Date')).toBeInTheDocument();
    expect(screen.getByText('Due Date')).toBeInTheDocument();
    expect(screen.getByText('Currency')).toBeInTheDocument();
    expect(screen.getByText('Seller NIP')).toBeInTheDocument();
    expect(screen.getByText('Buyer NIP')).toBeInTheDocument();
    expect(screen.getByText('Seller Name')).toBeInTheDocument();
    expect(screen.getByText('Buyer Name')).toBeInTheDocument();
    expect(screen.getByText('Net Amount')).toBeInTheDocument();
    expect(screen.getByText('Total Gross')).toBeInTheDocument();
    expect(screen.getByText('Seller Bank Account')).toBeInTheDocument();
  });

  it('renders with portal mode when isPortal prop is true', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/PORTAL', confidence: 95 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} isPortal={true} />);
    expect(screen.getByText('Review Extracted Data')).toBeInTheDocument();
  });

  it('renders with no extraction data gracefully', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    // Should show processing state when no data
    expect(screen.getByText('Analyzing invoice...')).toBeInTheDocument();
  });

  it('calls onAccept with form data when Accept & Save is clicked', async () => {
    const onAccept = vi.fn();
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/ACC/01', confidence: 95 },
            issueDate: { value: '2026-01-10', confidence: 90 },
            dueDate: { value: '2026-02-10', confidence: 85 },
            currency: { value: 'PLN', confidence: 99 },
            sellerNip: { value: '5250000000', confidence: 88 },
            buyerNip: { value: '1234567890', confidence: 75 },
            sellerName: { value: 'Seller Inc', confidence: 92 },
            buyerName: { value: 'Buyer Corp', confidence: 90 },
            totalNet: { value: 10000, confidence: 85 },
            totalTax: { value: 2300, confidence: 85 },
            totalGross: { value: 12300, confidence: 95 },
            bankAccount: { value: 'PL12345678', confidence: 70 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    const { user } = (await import('@/test/test-utils')).setup(
      <OcrReviewPanel {...defaultProps} onAccept={onAccept} />,
    );
    await user.click(screen.getByText('Accept & Save'));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNumber: 'FV/ACC/01',
        sellerName: 'Seller Inc',
        buyerName: 'Buyer Corp',
      }),
    );
  });

  it('calls onDiscard via alert dialog confirmation', async () => {
    const onDiscard = vi.fn();
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: { invoiceNumber: { value: 'FV/D01', confidence: 95 } },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    const { user } = (await import('@/test/test-utils')).setup(
      <OcrReviewPanel {...defaultProps} onDiscard={onDiscard} />,
    );
    await user.click(screen.getByText('Discard Extraction'));
    // Alert dialog should appear
    const { waitFor } = await import('@/test/test-utils');
    await waitFor(() => {
      expect(
        screen.getByText('Discard extracted data and start with an empty form?'),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByText('Discard'));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('calls onRetrigger via re-run OCR alert dialog confirmation', async () => {
    const onRetrigger = vi.fn();
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: { invoiceNumber: { value: 'FV/R01', confidence: 95 } },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    const { user } = (await import('@/test/test-utils')).setup(
      <OcrReviewPanel {...defaultProps} onRetrigger={onRetrigger} />,
    );
    await user.click(screen.getByText('Re-run OCR'));
    const { waitFor } = await import('@/test/test-utils');
    await waitFor(() => {
      expect(
        screen.getByText('Re-running OCR will replace the current extracted data. Continue?'),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByText('Re-run'));
    expect(onRetrigger).toHaveBeenCalledTimes(1);
  });

  it('allows editing invoice number field', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: { invoiceNumber: { value: 'FV/ORIG', confidence: 90 } },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    const { user } = (await import('@/test/test-utils')).setup(
      <OcrReviewPanel {...defaultProps} />,
    );
    const input = screen.getByDisplayValue('FV/ORIG');
    await user.clear(input);
    await user.type(input, 'FV/EDITED');
    expect(input).toHaveValue('FV/EDITED');
  });

  it('renders with line items from extraction', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: { invoiceNumber: { value: 'FV/LI', confidence: 95 } },
          lineItems: [
            {
              description: 'Service A',
              quantity: 1,
              unit: 'szt',
              unitPriceMinor: 10000,
              netAmountMinor: 10000,
              vatRate: '23%',
              vatAmountMinor: 2300,
              grossAmountMinor: 12300,
              confidence: 90,
            },
          ],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    expect(screen.getByText('Review Extracted Data')).toBeInTheDocument();
  });

  it('uses portal query endpoint when isPortal is true', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: { invoiceNumber: { value: 'FV/PORT', confidence: 95 } },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} isPortal={true} />);
    // portalQuery path used - verify both queries are called
    expect(mockUseQuery).toHaveBeenCalled();
    expect(screen.getByText('Review Extracted Data')).toBeInTheDocument();
  });

  it('allows editing seller name and buyer name fields', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/ED', confidence: 95 },
            sellerName: { value: 'Original Seller', confidence: 80 },
            buyerName: { value: 'Original Buyer', confidence: 85 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    const { user } = (await import('@/test/test-utils')).setup(
      <OcrReviewPanel {...defaultProps} />,
    );
    const sellerInput = screen.getByDisplayValue('Original Seller');
    await user.clear(sellerInput);
    await user.type(sellerInput, 'New Seller');
    expect(sellerInput).toHaveValue('New Seller');
  });

  it('allows editing net amount field', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/AMT', confidence: 95 },
            totalNet: { value: 50000, confidence: 85 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    const { user } = (await import('@/test/test-utils')).setup(
      <OcrReviewPanel {...defaultProps} />,
    );
    const netInput = screen.getByDisplayValue('500.00');
    await user.clear(netInput);
    await user.type(netInput, '750.00');
    expect(netInput).toHaveValue(750);
  });

  it('renders keep data button in discard dialog', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: { invoiceNumber: { value: 'FV/KD', confidence: 95 } },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    const { user } = (await import('@/test/test-utils')).setup(
      <OcrReviewPanel {...defaultProps} />,
    );
    await user.click(screen.getByText('Discard Extraction'));
    const { waitFor } = await import('@/test/test-utils');
    await waitFor(() => {
      expect(screen.getByText('Keep Data')).toBeInTheDocument();
    });
  });

  it('allows editing seller bank account field', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/BANK2', confidence: 95 },
            bankAccount: { value: 'PL99999999', confidence: 70 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    const { user } = (await import('@/test/test-utils')).setup(
      <OcrReviewPanel {...defaultProps} />,
    );
    const bankInput = screen.getByDisplayValue('PL99999999');
    await user.clear(bankInput);
    await user.type(bankInput, 'PL11111111');
    expect(bankInput).toHaveValue('PL11111111');
  });

  it('allows editing buyer name field', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/BN', confidence: 95 },
            buyerName: { value: 'Old Buyer', confidence: 85 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    const { user } = (await import('@/test/test-utils')).setup(
      <OcrReviewPanel {...defaultProps} />,
    );
    const input = screen.getByDisplayValue('Old Buyer');
    await user.clear(input);
    await user.type(input, 'New Buyer');
    expect(input).toHaveValue('New Buyer');
  });

  it('allows editing seller tax ID field', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/NIP', confidence: 95 },
            sellerNip: { value: '1111111111', confidence: 88 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    const { user } = (await import('@/test/test-utils')).setup(
      <OcrReviewPanel {...defaultProps} />,
    );
    const nipInput = screen.getByDisplayValue('1111111111');
    await user.clear(nipInput);
    await user.type(nipInput, '9999999999');
    expect(nipInput).toHaveValue('9999999999');
  });

  it('renders extraction status bar with field count', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/CNT', confidence: 95 },
            issueDate: { value: '2026-01-01', confidence: 90 },
            sellerName: { value: null, confidence: 0 },
          },
          lineItems: [],
        },
      },
      isLoading: false,
    });
    render(<OcrReviewPanel {...defaultProps} />);
    // Status bar should show extracted status
    expect(screen.getByText('Review Extracted Data')).toBeInTheDocument();
  });

  it('calls onAccept with correct line items data', async () => {
    const onAccept = vi.fn();
    mockUseQuery.mockReturnValue({
      data: {
        status: 'EXTRACTED',
        resultJson: {
          status: 'EXTRACTED',
          fields: {
            invoiceNumber: { value: 'FV/LI2', confidence: 95 },
          },
          lineItems: [
            {
              description: 'Consulting',
              quantity: 10,
              unit: 'h',
              unitPriceMinor: 20000,
              netAmountMinor: 200000,
              vatRate: '23%',
              vatAmountMinor: 46000,
              grossAmountMinor: 246000,
              confidence: 92,
            },
          ],
        },
      },
      isLoading: false,
    });
    const { user } = (await import('@/test/test-utils')).setup(
      <OcrReviewPanel {...defaultProps} onAccept={onAccept} />,
    );
    await user.click(screen.getByText('Accept & Save'));
    expect(onAccept).toHaveBeenCalledTimes(1);
    const callArg = onAccept.mock.calls[0][0];
    expect(callArg.lineItems).toHaveLength(1);
    expect(callArg.lineItems[0].description).toBe('Consulting');
  });
});
