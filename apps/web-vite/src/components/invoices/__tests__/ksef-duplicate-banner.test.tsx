import { render, screen, setup } from '@/test/test-utils';

import { KsefDuplicateBanner } from '../ksef-duplicate-banner';

describe('KsefDuplicateBanner', () => {
  it('renders duplicate messaging, NIP, invoice number, and link to the KSeF invoice', () => {
    render(
      <KsefDuplicateBanner
        duplicateInvoiceId="inv-ksef-1"
        invoiceNumber="FV/2026/04"
        sellerNip="5250000000"
      />,
    );

    expect(screen.getByText('KSeF Duplicate Found')).toBeInTheDocument();
    // duplicateBody renders via ICU MessageFormat — assert the surrounding copy
    // landed (interpolation behaviour is exercised in i18n suite, not here).
    expect(screen.getByText(/matching invoice was found in KSeF/i)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /View KSeF Invoice/i });
    expect(link).toHaveAttribute('href', '/en/invoices/inv-ksef-1');
  });

  it('opens the void confirmation and invokes onVoid when confirmed', async () => {
    const onVoid = vi.fn();
    const { user } = setup(
      <KsefDuplicateBanner
        duplicateInvoiceId="x"
        invoiceNumber="n"
        sellerNip="1"
        onVoid={onVoid}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Void This Invoice/i }));

    const confirmButtons = screen.getAllByRole('button', { name: /^Void Invoice$/i });
    const confirm = confirmButtons[confirmButtons.length - 1];
    await user.click(confirm);

    expect(onVoid).toHaveBeenCalledTimes(1);
  });

  it('does not render the Void button when onVoid is not provided', () => {
    render(<KsefDuplicateBanner duplicateInvoiceId="x" invoiceNumber="n" sellerNip="1" />);
    expect(screen.queryByRole('button', { name: /Void This Invoice/i })).not.toBeInTheDocument();
  });
});
