import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WhtCertificateTemplate } from '../wht-certificate-template';

vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="document">{children}</div>
  ),
  Page: ({ children }: { children: React.ReactNode }) => <div data-testid="page">{children}</div>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Image: ({ src }: { src: string }) => <img src={src} alt="" />,
  StyleSheet: { create: (s: unknown) => s },
}));

const data = {
  certificateNumber: 'WHT-2026-042',
  organizationName: 'Acme Corp',
  organizationTaxId: 'ORG-TAX-123',
  organizationCountry: 'SA',
  contractorName: 'Jane Smith',
  contractorTaxId: 'CTR-TAX-456',
  contractorResidency: 'DE',
  paymentDate: new Date('2026-03-15'),
  grossAmountMinor: 200000,
  whtRate: 15,
  whtAmountMinor: 30000,
  netAmountMinor: 170000,
  currency: 'SAR',
  treatyApplied: true,
  treatyReference: 'SA-DE DTA Article 12',
};

describe('WhtCertificateTemplate', () => {
  it('renders certificate title', () => {
    const { getByText } = render(<WhtCertificateTemplate data={data} />);
    expect(getByText('Withholding Tax Certificate')).toBeInTheDocument();
  });

  it('renders certificate number', () => {
    const { getByText } = render(<WhtCertificateTemplate data={data} />);
    expect(getByText(/WHT-2026-042/)).toBeInTheDocument();
  });

  it('renders organization details', () => {
    const { getByText } = render(<WhtCertificateTemplate data={data} />);
    expect(getByText('Acme Corp')).toBeInTheDocument();
    expect(getByText('ORG-TAX-123')).toBeInTheDocument();
    expect(getByText('SA')).toBeInTheDocument();
  });

  it('renders contractor details', () => {
    const { getByText } = render(<WhtCertificateTemplate data={data} />);
    expect(getByText('Jane Smith')).toBeInTheDocument();
    expect(getByText('CTR-TAX-456')).toBeInTheDocument();
    expect(getByText('DE')).toBeInTheDocument();
  });

  it('renders payment date', () => {
    const { getByText } = render(<WhtCertificateTemplate data={data} />);
    expect(getByText('2026-03-15')).toBeInTheDocument();
  });

  it('renders financial amounts', () => {
    const { getByText } = render(<WhtCertificateTemplate data={data} />);
    expect(getByText('SAR 2000.00')).toBeInTheDocument();
    expect(getByText('SAR 300.00')).toBeInTheDocument();
    expect(getByText('SAR 1700.00')).toBeInTheDocument();
  });

  it('renders WHT rate with treaty label', () => {
    const { getByText } = render(<WhtCertificateTemplate data={data} />);
    expect(getByText('15%')).toBeInTheDocument();
    expect(getByText(/WHT Rate \(Treaty\)/)).toBeInTheDocument();
  });

  it('renders treaty reference when applied', () => {
    const { getByText } = render(<WhtCertificateTemplate data={data} />);
    expect(getByText(/SA-DE DTA Article 12/)).toBeInTheDocument();
  });

  it('hides treaty reference when not applied', () => {
    const noTreaty = { ...data, treatyApplied: false, treatyReference: null };
    const { queryByText } = render(<WhtCertificateTemplate data={noTreaty} />);
    expect(queryByText(/Treaty Applied:/)).not.toBeInTheDocument();
  });

  it('hides tax IDs when null', () => {
    const noTaxIds = { ...data, organizationTaxId: null, contractorTaxId: null };
    const { queryByText } = render(<WhtCertificateTemplate data={noTaxIds} />);
    expect(queryByText('ORG-TAX-123')).not.toBeInTheDocument();
    expect(queryByText('CTR-TAX-456')).not.toBeInTheDocument();
  });
});
