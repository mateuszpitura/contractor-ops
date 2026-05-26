import { render, screen } from '@/test/test-utils';

import type { EInvoiceComplianceStatus } from '../einvoice-status-cell';
import { EInvoiceStatusCell } from '../einvoice-status-cell';

const STATUSES: Array<{ status: EInvoiceComplianceStatus; label: string }> = [
  { status: 'notGenerated', label: 'Not generated' },
  { status: 'valid', label: 'Valid' },
  { status: 'warnings', label: 'Warnings' },
  { status: 'invalid', label: 'Invalid' },
  { status: 'transmitted', label: 'Transmitted' },
  { status: 'failed', label: 'Failed' },
];

describe('EInvoiceStatusCell', () => {
  for (const { status, label } of STATUSES) {
    it(`renders ${status} with correct label + link to E-invoice tab`, () => {
      render(<EInvoiceStatusCell status={status} invoiceId="inv_123" />);
      const link = screen.getByRole('link', { name: label });
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toContain('/invoices/inv_123');
      expect(link.getAttribute('href')).toContain('tab=e-invoice');
    });
  }
});
