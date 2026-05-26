import { render, screen, setup } from '@/test/test-utils';

import { DuplicateWarning } from '../duplicate-warning';

describe('DuplicateWarning', () => {
  it('renders duplicate heading and invoice number link', () => {
    render(
      <DuplicateWarning
        duplicateInvoiceId="inv-0"
        invoiceNumber="FV/01/2025"
        onDismiss={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', { name: /possible duplicate detected/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view original/i })).toHaveAttribute(
      'href',
      '/en/invoices/inv-0',
    );
  });

  it('omits the view-original link when duplicateInvoiceId is null', () => {
    render(
      <DuplicateWarning duplicateInvoiceId={null} invoiceNumber="FV/01/2025" onDismiss={vi.fn()} />,
    );
    expect(screen.queryByRole('link', { name: /view original/i })).not.toBeInTheDocument();
  });

  it('invokes onDismiss when the "not a duplicate" button is clicked', async () => {
    const onDismiss = vi.fn();
    const { user } = setup(
      <DuplicateWarning duplicateInvoiceId={null} invoiceNumber="X" onDismiss={onDismiss} />,
    );
    await user.click(screen.getByRole('button', { name: /not a duplicate/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('disables the dismiss button when isPending is true', () => {
    render(
      <DuplicateWarning
        duplicateInvoiceId={null}
        invoiceNumber="X"
        isPending
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /not a duplicate/i })).toBeDisabled();
  });
});
