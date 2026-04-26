import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { EInvoiceComplianceStatus } from '@/components/invoices/einvoice-status-cell';
import { EInvoiceStatusCell } from '@/components/invoices/einvoice-status-cell';
import { deriveComplianceStatus } from '@/components/invoices/invoice-table/columns';
import { render, screen } from '@/test/test-utils';

// Stub next-intl navigation so tests don't pull next/navigation at runtime.
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/invoices',
}));

// ---------------------------------------------------------------------------
// Light integration tests for the invoices-list compliance surface. Full
// table rendering is covered by the existing InvoiceDataTable tests; here
// we assert per-row compliance derivation + cell rendering.
// ---------------------------------------------------------------------------

describe('Invoices list — compliance column integration', () => {
  it('derives `notGenerated` when eInvoiceLifecycle is null', () => {
    expect(deriveComplianceStatus(null)).toBe('notGenerated');
  });

  it('derives `failed` when transmissionStatus is FAILED', () => {
    expect(
      deriveComplianceStatus({
        validationStatus: 'VALID',
        transmissionStatus: 'FAILED',
      }),
    ).toBe('failed');
  });

  it('derives `transmitted` when transmission succeeded even if validation was WARNINGS', () => {
    expect(
      deriveComplianceStatus({
        validationStatus: 'WARNINGS',
        transmissionStatus: 'DELIVERED',
      }),
    ).toBe('transmitted');
  });

  it('falls back to validation status when transmission is idle', () => {
    expect(
      deriveComplianceStatus({
        validationStatus: 'INVALID',
        transmissionStatus: 'NOT_SENT',
      }),
    ).toBe('invalid');
    expect(
      deriveComplianceStatus({
        validationStatus: 'WARNINGS',
        transmissionStatus: 'NOT_SENT',
      }),
    ).toBe('warnings');
    expect(
      deriveComplianceStatus({
        validationStatus: 'VALID',
        transmissionStatus: 'NOT_SENT',
      }),
    ).toBe('valid');
  });

  it('renders a status cell with link to ?tab=e-invoice for a given invoice id', () => {
    const status: EInvoiceComplianceStatus = 'warnings';
    render(<EInvoiceStatusCell status={status} invoiceId="inv_abc" />);
    const link = screen.getByRole('link', { name: 'Warnings' });
    expect(link.getAttribute('href')).toContain('/invoices/inv_abc');
    expect(link.getAttribute('href')).toContain('tab=e-invoice');
  });
});
