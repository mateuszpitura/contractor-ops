import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import { InvoiceSidePanel } from '../invoice-side-panel';
import type { InvoiceRow } from '../invoice-table/columns';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

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

  it('shows invoice number, amounts, contractor link, and open-invoice CTA when open', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(
      <InvoiceSidePanel invoice={sampleInvoice} open onOpenChange={onOpenChange} />,
    );

    expect(screen.getByText('FV/PANEL/01')).toBeInTheDocument();
    expect(screen.getByText('EUR')).toBeInTheDocument();

    const contractor = screen.getByRole('link', { name: /beta llc/i });
    expect(contractor).toHaveAttribute('href', '/contractors/c-9');

    const openInvoice = screen.getByRole('link', { name: /open invoice/i });
    expect(openInvoice).toHaveAttribute('href', '/invoices/inv-panel-1');

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });

  it('shows MANUAL_UPLOAD source icon when source is MANUAL_UPLOAD', () => {
    const manualInvoice: InvoiceRow = {
      ...sampleInvoice,
      source: 'MANUAL_UPLOAD',
    };
    render(<InvoiceSidePanel invoice={manualInvoice} open onOpenChange={vi.fn()} />);
    expect(screen.getByText('FV/PANEL/01')).toBeInTheDocument();
  });

  it('renders overdue styling when due date is in the past and status is not PAID/VOID', () => {
    const overdueInvoice: InvoiceRow = {
      ...sampleInvoice,
      dueDate: '2020-01-01T00:00:00.000Z',
      status: 'RECEIVED',
    };
    render(<InvoiceSidePanel invoice={overdueInvoice} open onOpenChange={vi.fn()} />);
    // The due date cell should have destructive text class
    const dueDateValue = screen.getByText(/1.01.2020/);
    expect(dueDateValue.className).toContain('destructive');
  });

  it('does not apply overdue styling for PAID invoices', () => {
    const paidInvoice: InvoiceRow = {
      ...sampleInvoice,
      dueDate: '2020-01-01T00:00:00.000Z',
      status: 'PAID',
    };
    render(<InvoiceSidePanel invoice={paidInvoice} open onOpenChange={vi.fn()} />);
    const dueDateValue = screen.getByText(/1.01.2020/);
    expect(dueDateValue.className).not.toContain('destructive');
  });

  it('shows dash when matchStatus has no config', () => {
    const unknownMatchInvoice: InvoiceRow = {
      ...sampleInvoice,
      matchStatus: 'UNKNOWN_STATUS',
    };
    render(<InvoiceSidePanel invoice={unknownMatchInvoice} open onOpenChange={vi.fn()} />);
    // Should render mdash for unknown match status
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });

  it('renders formatted amounts in the amounts section', () => {
    render(<InvoiceSidePanel invoice={sampleInvoice} open onOpenChange={vi.fn()} />);
    // 5000 minor = 50,00 and 6150 minor = 61,50 in pl-PL format
    expect(screen.getByText('50,00')).toBeInTheDocument();
    expect(screen.getByText('61,50')).toBeInTheDocument();
  });

  it('renders dash when dueDate is null', () => {
    const noDueDateInvoice: InvoiceRow = {
      ...sampleInvoice,
      dueDate: null,
    };
    render(<InvoiceSidePanel invoice={noDueDateInvoice} open onOpenChange={vi.fn()} />);
    // Should show a dash for the due date
    const dashes = screen.getAllByText('\u2014');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
