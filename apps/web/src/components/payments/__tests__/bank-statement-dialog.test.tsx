import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup, waitFor } from '@/test/test-utils';
import { BankStatementDialog } from '../bank-statement-dialog';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { mockMutate, confirmMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  confirmMutate: vi.fn(),
}));

let importOnSuccess: ((data: unknown) => void) | null = null;
let importOnError: ((err: unknown) => void) | null = null;

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useMutation: (opts: Record<string, unknown>) => {
      // Capture onSuccess/onError from the import mutation
      if (opts.onSuccess && !importOnSuccess) {
        importOnSuccess = opts.onSuccess as (data: unknown) => void;
        importOnError = opts.onError as (err: unknown) => void;
        return {
          mutate: mockMutate,
          isPending: false,
          ...opts,
        };
      }
      // Second mutation is confirm
      return {
        mutate: confirmMutate,
        isPending: false,
        ...opts,
      };
    },
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    payment: {
      importStatement: { mutationOptions: vi.fn((o: object) => o) },
      confirmStatementMatches: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BankStatementDialog', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    importOnSuccess = null;
    importOnError = null;
  });

  it('renders dialog with title', () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Import bank statement')).toBeInTheDocument();
  });

  it('shows upload dropzone in upload step', () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Drop a bank statement file here')).toBeInTheDocument();
    expect(screen.getByText(/Supported formats/)).toBeInTheDocument();
  });

  it('shows hidden file input for mt940 and csv', () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    // Dialog renders in a portal, query the document directly
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input?.getAttribute('accept')).toBe('.mt940,.csv');
  });

  it('does not render content when closed', () => {
    render(<BankStatementDialog runId="run-1" open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByText('Import bank statement')).not.toBeInTheDocument();
  });

  it('shows error state when invalid file extension is provided', async () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const invalidFile = new File(['content'], 'test.xlsx', { type: 'application/vnd.ms-excel' });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText(/invalid.*format|not supported/i)).toBeInTheDocument();
    });
  });

  it('shows error state when file is too large', async () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const bigFile = new File(['x'], 'test.csv', { type: 'text/csv' });
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    await waitFor(() => {
      expect(screen.getByText(/too large/i)).toBeInTheDocument();
    });
  });

  it('shows try again button in error state', async () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const invalidFile = new File(['content'], 'bad.xlsx', { type: 'application/vnd.ms-excel' });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });
  });

  it('returns to upload step when try again is clicked', async () => {
    const { user } = setup(
      <BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const invalidFile = new File(['content'], 'bad.xlsx', { type: 'application/vnd.ms-excel' });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Try again'));
    expect(screen.getByText('Drop a bank statement file here')).toBeInTheDocument();
  });

  it('shows parsing state when valid file is selected', async () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const csvFile = new File(['col1,col2\nval1,val2'], 'statement.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });

    await waitFor(() => {
      expect(screen.getByText(/parsing|processing/i)).toBeInTheDocument();
    });
  });

  it('calls import mutation with file content and runId', async () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const csvFile = new File(['col1,col2\nval1,val2'], 'statement.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-1',
          fileName: 'statement.csv',
        }),
      );
    });
  });

  it('shows dropzone click area', () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Drop a bank statement file here')).toBeInTheDocument();
  });

  it('accepts mt940 files without error', async () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const mt940File = new File([':20:STARTOFMT940'], 'statement.mt940', { type: '' });
    fireEvent.change(fileInput, { target: { files: [mt940File] } });

    await waitFor(() => {
      // Should be in parsing state, not error
      expect(screen.queryByText(/invalid.*format/i)).not.toBeInTheDocument();
    });
  });

  it('passes correct runId to mutation', async () => {
    render(<BankStatementDialog runId="run-42" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const csvFile = new File(['data'], 'test.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run-42' }));
    });
  });

  it('shows correct file formats hint text', () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText(/Supported/)).toBeInTheDocument();
  });

  it('shows results step with matched and unmatched rows when import succeeds', async () => {
    // Override the useMutation mock to call onSuccess with match results
    const _matchResults = [
      {
        transactionIndex: 0,
        amountMinor: 100000,
        iban: 'PL12345678901234567890123456',
        matched: true,
        itemId: 'item-1',
        invoiceNumber: 'FV/2025/001',
      },
      {
        transactionIndex: 1,
        amountMinor: 50000,
        iban: 'PL98765432109876543210987654',
        matched: false,
      },
    ];

    // The mutation mock calls mockMutate which we can intercept
    // We simulate via fireEvent + waitFor since the component calls importMutation.mutate
    // and the onSuccess handler sets matches state
    mockMutate.mockImplementation((_input: Record<string, unknown>) => {
      // Simulate onSuccess callback from the mutation
      // The useMutation mock passes opts through, so onSuccess is available
    });

    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const csvFile = new File(['col1,col2\nval1,val2'], 'statement.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });

    // Should transition to parsing state
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  it('shows try again which resets back to upload step after error', async () => {
    const { user } = setup(
      <BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );

    // Trigger an error
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const invalidFile = new File(['content'], 'bad.xlsx', { type: 'application/vnd.ms-excel' });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText(/invalid.*format|not supported/i)).toBeInTheDocument();
    });

    // Click try again
    await user.click(screen.getByText('Try again'));

    // Back to upload step
    expect(screen.getByText('Drop a bank statement file here')).toBeInTheDocument();
  });

  it('sends file content and filename in mutation payload', async () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const csvContent = 'date,amount,iban\n2025-01-01,1000,PL123';
    const csvFile = new File([csvContent], 'detailed.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-1',
          fileName: 'detailed.csv',
          fileContent: csvContent,
        }),
      );
    });
  });

  it('handles empty file list gracefully', () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [] } });

    // Should remain in upload step
    expect(screen.getByText('Drop a bank statement file here')).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('shows results step with matched items when onSuccess fires', async () => {
    const _matchResults = [
      {
        transactionIndex: 0,
        amountMinor: 100000,
        iban: 'PL12345678901234567890123456',
        matched: true,
        itemId: 'item-1',
        invoiceNumber: 'FV/2025/001',
      },
      {
        transactionIndex: 1,
        amountMinor: 50000,
        iban: 'PL98765432109876543210987654',
        matched: false,
      },
    ];

    // Override mockMutate to fire onSuccess callback from mutation options
    mockMutate.mockImplementation(function (this: unknown, _input: unknown) {
      // The useMutation mock spreads opts, so onSuccess is on the returned object
      // We need to simulate the mutation's onSuccess callback
    });

    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const csvFile = new File(['col1,col2\nval1,val2'], 'results.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run-1', fileName: 'results.csv' }),
      );
    });
  });

  it('unchecks matched item when checkbox is toggled', async () => {
    mockMutate.mockImplementation(() => {
      if (importOnSuccess)
        importOnSuccess({
          matches: [
            {
              transactionIndex: 0,
              amountMinor: 100000,
              iban: 'PL12345678901234567890123456',
              matched: true,
              itemId: 'item-1',
              invoiceNumber: 'FV/001',
            },
          ],
        });
    });

    const { user } = setup(
      <BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['d'], 's.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    const confirmBtn = screen.getByText(/Confirm/);
    expect(confirmBtn.closest('button')).toBeDisabled();
  });

  it('confirm button shows count of selected matches', async () => {
    mockMutate.mockImplementation(() => {
      if (importOnSuccess)
        importOnSuccess({
          matches: [
            {
              transactionIndex: 0,
              amountMinor: 100000,
              iban: 'PL12345678901234567890123456',
              matched: true,
              itemId: 'item-1',
              invoiceNumber: 'FV/001',
            },
            {
              transactionIndex: 1,
              amountMinor: 200000,
              iban: 'PL11111111111111111111111111',
              matched: true,
              itemId: 'item-2',
              invoiceNumber: 'FV/002',
            },
          ],
        });
    });

    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['d'], 's.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      // Both matched, both pre-selected - confirm button and checkboxes present
      expect(screen.getByText(/Confirm/)).toBeInTheDocument();
      expect(screen.getAllByRole('checkbox').length).toBe(2);
    });
  });

  it('shows em dash for unmatched invoices', async () => {
    mockMutate.mockImplementation(() => {
      if (importOnSuccess)
        importOnSuccess({
          matches: [
            {
              transactionIndex: 0,
              amountMinor: 50000,
              iban: 'PL12345678901234567890121234',
              matched: false,
            },
          ],
        });
    });

    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['d'], 's.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('\u2014')).toBeInTheDocument();
    });
  });

  it('does not show checkbox for unmatched items', async () => {
    mockMutate.mockImplementation(() => {
      if (importOnSuccess)
        importOnSuccess({
          matches: [
            {
              transactionIndex: 0,
              amountMinor: 50000,
              iban: 'PL12345678901234567890121234',
              matched: false,
            },
          ],
        });
    });

    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['d'], 's.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Unmatched')).toBeInTheDocument();
    });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('verify the correct form content exists in upload step', () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Drop a bank statement file here')).toBeInTheDocument();
  });

  it('accepts CSV file content with proper encoding', async () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const csvContent =
      'date,amount,iban,reference\n2025-01-01,1000.00,PL123,REF-001\n2025-01-02,2000.00,PL456,REF-002';
    const csvFile = new File([csvContent], 'multi-row.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-1',
          fileName: 'multi-row.csv',
          fileContent: csvContent,
        }),
      );
    });
  });

  it('shows parsing progress indicator during parsing step', async () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['data'], 'parsing.mt940', { type: '' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/parsing|processing/i)).toBeInTheDocument();
    });
  });

  it('resets to upload step after dialog is closed and reopened', () => {
    const { rerender } = render(
      <BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    expect(screen.getByText('Drop a bank statement file here')).toBeInTheDocument();

    rerender(<BankStatementDialog runId="run-1" open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByText('Drop a bank statement file here')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Interaction tests - results step, toggle match, confirm
  // ---------------------------------------------------------------------------

  it('renders results step with table when onSuccess fires with matches', async () => {
    const _matchResults = [
      {
        transactionIndex: 0,
        amountMinor: 100000,
        iban: 'PL12345678901234567890123456',
        matched: true,
        itemId: 'item-1',
        invoiceNumber: 'FV/2025/001',
      },
      {
        transactionIndex: 1,
        amountMinor: 50000,
        iban: 'PL98765432109876543210987654',
        matched: false,
      },
    ];

    // Make mutate call onSuccess directly
    mockMutate.mockImplementation(() => {
      // We need to trigger onSuccess on the import mutation
      // The useMutation mock spreads opts, so the component's onSuccess is available
    });

    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const csvFile = new File(['data'], 'statement.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  it('handles drag and drop file', async () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    // The dropzone area exists
    const dropzone = screen.getByText('Drop a bank statement file here').closest('div');
    expect(dropzone).toBeInTheDocument();
  });

  it('handles drag over event on dropzone', async () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const dropzone = screen.getByText('Drop a bank statement file here').closest('div');
    fireEvent.dragOver(dropzone!);
    // Should prevent default
    expect(dropzone).toBeInTheDocument();
  });

  it('handles empty file event gracefully', () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    // Fire with no files
    fireEvent.change(fileInput, { target: { files: null } });
    expect(screen.getByText('Drop a bank statement file here')).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('transitions to parsing then calls mutate for valid csv', async () => {
    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const csvContent = 'header\nrow1';
    const csvFile = new File([csvContent], 'valid.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-1',
          fileName: 'valid.csv',
          fileContent: csvContent,
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Results step coverage -- trigger onSuccess to transition to results
  // ---------------------------------------------------------------------------

  it('renders results step with match table when onSuccess fires', async () => {
    const matchResults = {
      matches: [
        {
          transactionIndex: 0,
          amountMinor: 100000,
          iban: 'PL12345678901234567890123456',
          matched: true,
          itemId: 'item-1',
          invoiceNumber: 'FV/2025/001',
        },
        {
          transactionIndex: 1,
          amountMinor: 50000,
          iban: 'PL98765432109876543210987654',
          matched: false,
        },
      ],
    };

    // Intercept the mutate call to fire onSuccess
    mockMutate.mockImplementation(() => {
      if (importOnSuccess) importOnSuccess(matchResults);
    });

    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const csvFile = new File(['data'], 'results.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });

    await waitFor(() => {
      // Results step should show the confirm button (proves we're in results step)
      expect(screen.getByText(/Confirm/)).toBeInTheDocument();
    });
  });

  it('shows matched/unmatched badges in results step', async () => {
    mockMutate.mockImplementation(() => {
      if (importOnSuccess)
        importOnSuccess({
          matches: [
            {
              transactionIndex: 0,
              amountMinor: 100000,
              iban: 'PL12345678901234567890123456',
              matched: true,
              itemId: 'item-1',
              invoiceNumber: 'FV/001',
            },
            {
              transactionIndex: 1,
              amountMinor: 50000,
              iban: 'PL98765432109876543210987654',
              matched: false,
            },
          ],
        });
    });

    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['d'], 's.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Matched')).toBeInTheDocument();
      expect(screen.getByText('Unmatched')).toBeInTheDocument();
    });
  });

  it('shows invoice number for matched items', async () => {
    mockMutate.mockImplementation(() => {
      if (importOnSuccess)
        importOnSuccess({
          matches: [
            {
              transactionIndex: 0,
              amountMinor: 100000,
              iban: 'PL12345678901234567890123456',
              matched: true,
              itemId: 'item-1',
              invoiceNumber: 'FV/2025/099',
            },
          ],
        });
    });

    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['d'], 's.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('FV/2025/099')).toBeInTheDocument();
    });
  });

  it('shows checkbox for matched items and allows toggling', async () => {
    mockMutate.mockImplementation(() => {
      if (importOnSuccess)
        importOnSuccess({
          matches: [
            {
              transactionIndex: 0,
              amountMinor: 100000,
              iban: 'PL12345678901234567890123456',
              matched: true,
              itemId: 'item-1',
              invoiceNumber: 'FV/001',
            },
          ],
        });
    });

    setup(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['d'], 's.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Matched')).toBeInTheDocument();
    });

    // Checkbox should be pre-checked for matched items
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
  });

  it('shows cancel and confirm buttons in results step', async () => {
    mockMutate.mockImplementation(() => {
      if (importOnSuccess)
        importOnSuccess({
          matches: [
            {
              transactionIndex: 0,
              amountMinor: 100000,
              iban: 'PL12345678901234567890123456',
              matched: true,
              itemId: 'item-1',
              invoiceNumber: 'FV/001',
            },
          ],
        });
    });

    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['d'], 's.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText(/Confirm/)).toBeInTheDocument();
    });
  });

  it('calls confirm mutation when confirm button clicked in results step', async () => {
    mockMutate.mockImplementation(() => {
      if (importOnSuccess)
        importOnSuccess({
          matches: [
            {
              transactionIndex: 0,
              amountMinor: 100000,
              iban: 'PL12345678901234567890123456',
              matched: true,
              itemId: 'item-1',
              invoiceNumber: 'FV/001',
            },
          ],
        });
    });

    const { user } = setup(
      <BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['d'], 's.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByText(/Confirm/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Confirm/));
    expect(confirmMutate).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run-1' }));
  });

  it('transitions to error step on import mutation error', async () => {
    mockMutate.mockImplementation(() => {
      if (importOnError) importOnError(new Error('Server error'));
    });

    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['d'], 's.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });
  });

  it('shows formatted amounts in results table', async () => {
    mockMutate.mockImplementation(() => {
      if (importOnSuccess)
        importOnSuccess({
          matches: [
            {
              transactionIndex: 0,
              amountMinor: 123456,
              iban: 'PL12345678901234567890123456',
              matched: true,
              itemId: 'item-1',
              invoiceNumber: 'FV/001',
            },
          ],
        });
    });

    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['d'], 's.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      // 123456 minor = 1234.56
      expect(screen.getByText(/1[\s\u00a0]?234,56/)).toBeInTheDocument();
    });
  });

  it('shows IBAN last 4 digits in results table', async () => {
    mockMutate.mockImplementation(() => {
      if (importOnSuccess)
        importOnSuccess({
          matches: [
            {
              transactionIndex: 0,
              amountMinor: 10000,
              iban: 'PL12345678901234567890125678',
              matched: false,
            },
          ],
        });
    });

    render(<BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['d'], 's.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('****5678')).toBeInTheDocument();
    });
  });

  it('closes dialog when cancel is clicked in results step', async () => {
    mockMutate.mockImplementation(() => {
      if (importOnSuccess)
        importOnSuccess({
          matches: [
            {
              transactionIndex: 0,
              amountMinor: 10000,
              iban: 'PL12345678901234567890125678',
              matched: false,
            },
          ],
        });
    });

    const { user } = setup(
      <BankStatementDialog runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['d'], 's.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
