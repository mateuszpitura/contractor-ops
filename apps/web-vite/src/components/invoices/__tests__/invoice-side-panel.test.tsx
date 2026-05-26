import { render, screen } from '@/test/test-utils';
import { InvoiceSidePanel } from '../invoice-side-panel';
import type { InvoiceRow } from '../invoice-table/columns';

const sampleInvoice: InvoiceRow = {
  id: 'inv-panel-1',
  invoiceNumber: 'FV/PANEL/01',
  issueDate: '2026-02-01T00:00:00.000Z',
  dueDate: '2030-12-31T00:00:00.000Z',
  subtotalMinor: 5000,
  totalMinor: 6150,
  currency: 'EUR',
  status: 'APPROVED',
  matchStatus: 'MATCHED',
  source: 'EMAIL_INTAKE',
  contractor: { id: 'c-9', legalName: 'Beta LLC' },
};

describe('InvoiceSidePanel', () => {
  it('renders nothing when invoice is null', () => {
    const { container } = render(<InvoiceSidePanel invoice={null} open onOpenChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders invoice number, currency, and the open-invoice CTA when open', () => {
    render(<InvoiceSidePanel invoice={sampleInvoice} open onOpenChange={vi.fn()} />);

    expect(screen.getByText('FV/PANEL/01')).toBeInTheDocument();
    expect(screen.getByText('EUR')).toBeInTheDocument();

    const contractor = screen.getByRole('link', { name: /beta llc/i });
    expect(contractor).toHaveAttribute('href', '/en/contractors/c-9');

    // The Button render={Link} composes an <a role="button"> — query by name
    // rather than by role so we tolerate the role override.
    const openInvoice = screen.getByRole('button', { name: /open invoice/i });
    expect(openInvoice).toHaveAttribute('href', '/en/invoices/inv-panel-1');
  });

  it('renders formatted minor-unit amounts (pl-PL formatting)', () => {
    render(<InvoiceSidePanel invoice={sampleInvoice} open onOpenChange={vi.fn()} />);
    // 5000 minor -> "50,00"; 6150 minor -> "61,50"
    expect(screen.getByText('50,00')).toBeInTheDocument();
    expect(screen.getByText('61,50')).toBeInTheDocument();
  });

  it('shows dash when matchStatus has no config', () => {
    const unknown: InvoiceRow = { ...sampleInvoice, matchStatus: 'UNKNOWN_STATUS' };
    render(<InvoiceSidePanel invoice={unknown} open onOpenChange={vi.fn()} />);
    // mdash appears (matching section falls back)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('renders dash when dueDate is null', () => {
    const noDue: InvoiceRow = { ...sampleInvoice, dueDate: null };
    render(<InvoiceSidePanel invoice={noDue} open onOpenChange={vi.fn()} />);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});
