/**
 * Container/component split — `InvoicesTabView` takes the
 * `useContractorTabInvoices` hook return as props. The view embeds an
 * upload-area container (tRPC-bound) and the invoice column factory; both
 * are mocked so the test exercises the view shell in isolation.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (typeof v === 'string' ? v : ''),
    formatTime: () => '',
    formatDateTime: () => '',
  }),
}));

vi.mock('../../../../invoices/invoice-upload-area.js', () => ({
  InvoiceUploadArea: () => <div data-testid="upload-area" />,
}));

vi.mock('../../../../invoices/invoice-table/columns.js', () => ({
  getColumns: () => [
    {
      id: 'invoiceNumber',
      accessorKey: 'invoiceNumber',
      header: 'Invoice',
      cell: ({ row }: { row: { original: { invoiceNumber?: string } } }) =>
        row.original.invoiceNumber ?? '',
    },
    {
      id: 'totalMinor',
      accessorKey: 'totalMinor',
      header: 'Total',
      cell: ({ row }: { row: { original: { totalMinor?: number } } }) =>
        String(row.original.totalMinor ?? ''),
    },
  ],
}));

import { render, screen, setup } from '../../../../../test/test-utils.js';
import type { InvoiceRow } from '../../../../invoices/invoice-table/columns.js';
import { InvoicesTabEmpty, InvoicesTabView } from '../invoices-tab.js';

type ViewProps = Parameters<typeof InvoicesTabView>[0];

interface Overrides {
  data?: InvoiceRow[];
  totalRows?: number;
  totalPages?: number;
  isLoading?: boolean;
  page?: number;
  uploadOpen?: boolean;
  setUploadOpen?: ViewProps['setUploadOpen'];
  setPage?: ViewProps['setPage'];
  handleUploadComplete?: ViewProps['handleUploadComplete'];
}

function buildProps(override: Overrides = {}): ViewProps {
  return {
    contractorId: 'c1',
    uploadOpen: override.uploadOpen ?? false,
    setUploadOpen: override.setUploadOpen ?? vi.fn(),
    page: override.page ?? 1,
    setPage: override.setPage ?? vi.fn(),
    data: override.data ?? [],
    totalRows: override.totalRows ?? 0,
    totalPages: override.totalPages ?? 1,
    isLoading: override.isLoading ?? false,
    handleUploadComplete: override.handleUploadComplete ?? vi.fn(),
  };
}

const sampleInvoice = (over: Partial<InvoiceRow> = {}): InvoiceRow =>
  ({
    id: 'inv-1',
    invoiceNumber: 'FV/001',
    issueDate: '2026-01-01',
    dueDate: '2026-02-01',
    subtotalMinor: 10000,
    totalMinor: 12300,
    currency: 'PLN',
    status: 'RECEIVED',
    matchStatus: 'UNMATCHED',
    source: 'MANUAL_UPLOAD',
    contractor: null,
    ...over,
  }) as unknown as InvoiceRow;

describe('InvoicesTabView', () => {
  it('renders empty state with at least one button when no invoices', () => {
    render(
      <InvoicesTabEmpty
        uploadOpen={false}
        setUploadOpen={vi.fn()}
        handleUploadComplete={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('renders empty-state heading and upload CTA', () => {
    render(
      <InvoicesTabEmpty
        uploadOpen={false}
        setUploadOpen={vi.fn()}
        handleUploadComplete={vi.fn()}
      />,
    );
    expect(screen.getByText(/no invoices/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
  });

  it('renders skeleton rows while loading', () => {
    const { container } = render(<InvoicesTabView {...buildProps({ isLoading: true })} />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it('opens the upload dialog when the empty-state upload CTA is clicked', async () => {
    let isOpen = false;
    const setUploadOpen = vi.fn((v: boolean | ((p: boolean) => boolean)) => {
      isOpen = typeof v === 'function' ? v(isOpen) : v;
    });
    const { user, rerender } = setup(
      <InvoicesTabEmpty
        uploadOpen={isOpen}
        setUploadOpen={setUploadOpen}
        handleUploadComplete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /upload/i }));
    expect(setUploadOpen).toHaveBeenCalledWith(true);

    rerender(
      <InvoicesTabEmpty
        uploadOpen={true}
        setUploadOpen={setUploadOpen}
        handleUploadComplete={vi.fn()}
      />,
    );
    expect(screen.getByTestId('upload-area')).toBeInTheDocument();
  });

  it('renders the populated table shell when invoices exist', () => {
    render(<InvoicesTabView {...buildProps({ data: [sampleInvoice()], totalRows: 1 })} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
  });

  it('renders the section heading in the populated state', () => {
    render(<InvoicesTabView {...buildProps({ data: [sampleInvoice()], totalRows: 1 })} />);
    expect(screen.getByText(/Invoices/)).toBeInTheDocument();
  });

  it('does not render pagination when totalPages == 1', () => {
    render(<InvoicesTabView {...buildProps({ data: [sampleInvoice()], totalRows: 1 })} />);
    expect(screen.queryByText(/Page 1 of 1/i)).not.toBeInTheDocument();
  });

  it('renders pagination when data exceeds page size', () => {
    const rows = Array.from({ length: 26 }, (_, i) =>
      sampleInvoice({ id: `inv-${i}`, invoiceNumber: `FV/${i}` }),
    );
    const { container } = render(
      <InvoicesTabView
        {...buildProps({ data: rows, totalRows: 60, totalPages: 3, page: 1 })}
      />,
    );
    expect(
      container.querySelector('[data-slot="pagination"]') ??
        container.querySelector('button[aria-label*="page" i]') ??
        container.querySelector('nav'),
    ).not.toBeNull();
  });
});
