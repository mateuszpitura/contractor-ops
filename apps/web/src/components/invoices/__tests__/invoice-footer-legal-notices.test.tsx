import { render, screen } from '@/test/test-utils';
import { InvoiceFooterLegalNotices } from '../invoice-footer-legal-notices';

vi.mock('@contractor-ops/validators', () => ({
  TAX_KLEINUNTERNEHMER_NOTICE: 'KU Notice: exempt under Section 19 UStG',
  TAX_STEUERSCHULDNERSCHAFT: 'Steuerschuldnerschaft des Leistungsempfängers',
  TAX_UK_REVERSE_CHARGE_NOTICE: 'Reverse charge: Customer to pay the VAT to HMRC',
}));

describe('InvoiceFooterLegalNotices', () => {
  it('returns null when no special conditions apply', () => {
    const { container } = render(
      <InvoiceFooterLegalNotices
        isReverseCharge={false}
        isKleinunternehmer={false}
        orgCountry="DE"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders Kleinunternehmer notice for DE org', () => {
    render(
      <InvoiceFooterLegalNotices isReverseCharge={false} isKleinunternehmer orgCountry="DE" />,
    );
    const notice = screen.getByTestId('invoice-footer-legal-notice');
    expect(notice).toHaveAttribute('data-notice', 'kleinunternehmer');
    expect(notice).toHaveTextContent('KU Notice: exempt under Section 19 UStG');
    expect(notice).toHaveAttribute('lang', 'de');
  });

  it('Kleinunternehmer supersedes reverse charge for DE', () => {
    render(<InvoiceFooterLegalNotices isReverseCharge isKleinunternehmer orgCountry="DE" />);
    const notice = screen.getByTestId('invoice-footer-legal-notice');
    expect(notice).toHaveAttribute('data-notice', 'kleinunternehmer');
  });

  it('renders DE reverse charge notice', () => {
    render(
      <InvoiceFooterLegalNotices isReverseCharge isKleinunternehmer={false} orgCountry="DE" />,
    );
    const notice = screen.getByTestId('invoice-footer-legal-notice');
    expect(notice).toHaveAttribute('data-notice', 'de-reverse-charge');
    expect(notice).toHaveTextContent('Steuerschuldnerschaft des Leistungsempfängers');
  });

  it('renders UK reverse charge notice', () => {
    render(
      <InvoiceFooterLegalNotices isReverseCharge isKleinunternehmer={false} orgCountry="GB" />,
    );
    const notice = screen.getByTestId('invoice-footer-legal-notice');
    expect(notice).toHaveAttribute('data-notice', 'uk-reverse-charge');
    expect(notice).toHaveTextContent('Reverse charge: Customer to pay the VAT to HMRC');
    expect(notice).toHaveAttribute('lang', 'en');
  });

  it('returns null for unsupported country with reverse charge', () => {
    const { container } = render(
      <InvoiceFooterLegalNotices isReverseCharge isKleinunternehmer={false} orgCountry="US" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when orgCountry is null', () => {
    const { container } = render(
      <InvoiceFooterLegalNotices isReverseCharge isKleinunternehmer orgCountry={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
