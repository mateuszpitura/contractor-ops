import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { WhtCertificatePreviewDialog } from '../wht-certificate-preview-dialog';

vi.mock('@/lib/format-currency', () => ({
  formatMinorUnits: (minor: number) => (minor / 100).toFixed(2),
}));

const certificate = {
  certificateNumber: 'WHT-2026-001',
  orgName: 'Acme Corp',
  contractorName: 'John Doe',
  contractorTaxId: 'TX-12345',
  contractorCountry: 'DE',
  paymentDate: '2026-04-01',
  currency: 'EUR',
  grossAmountMinor: 100000,
  whtRate: 15,
  whtAmountMinor: 15000,
  netAmountMinor: 85000,
  treatyApplied: true,
  treatyReference: 'DE-SA DTA Art. 12',
};

describe('WhtCertificatePreviewDialog', () => {
  it('renders nothing when certificate is null', () => {
    const { container } = render(
      <WhtCertificatePreviewDialog open={true} onClose={vi.fn()} certificate={null} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders dialog title and certificate number', () => {
    render(<WhtCertificatePreviewDialog open={true} onClose={vi.fn()} certificate={certificate} />);
    expect(screen.getByText('WHT Certificate Preview')).toBeInTheDocument();
    expect(screen.getByText(/WHT-2026-001/)).toBeInTheDocument();
  });

  it('renders organization and contractor info', () => {
    render(<WhtCertificatePreviewDialog open={true} onClose={vi.fn()} certificate={certificate} />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('TX-12345')).toBeInTheDocument();
  });

  it('renders financial details', () => {
    render(<WhtCertificatePreviewDialog open={true} onClose={vi.fn()} certificate={certificate} />);
    expect(screen.getByText('15%')).toBeInTheDocument();
  });

  it('renders treaty reference when applied', () => {
    render(<WhtCertificatePreviewDialog open={true} onClose={vi.fn()} certificate={certificate} />);
    expect(screen.getByText(/DE-SA DTA Art\. 12/)).toBeInTheDocument();
  });

  it('hides treaty reference when not applied', () => {
    const noTreaty = { ...certificate, treatyApplied: false, treatyReference: null };
    render(<WhtCertificatePreviewDialog open={true} onClose={vi.fn()} certificate={noTreaty} />);
    expect(screen.queryByText(/Treaty:/)).not.toBeInTheDocument();
  });

  it('renders Close and Download PDF buttons', () => {
    render(<WhtCertificatePreviewDialog open={true} onClose={vi.fn()} certificate={certificate} />);
    expect(screen.getByRole('button', { name: /^Close$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', async () => {
    const onClose = vi.fn();
    const { user } = setup(
      <WhtCertificatePreviewDialog open={true} onClose={onClose} certificate={certificate} />,
    );
    await user.click(screen.getByRole('button', { name: /^Close$/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onDownload when Download PDF button is clicked', async () => {
    const onDownload = vi.fn();
    const { user } = setup(
      <WhtCertificatePreviewDialog
        open={true}
        onClose={vi.fn()}
        certificate={certificate}
        onDownload={onDownload}
      />,
    );
    await user.click(screen.getByRole('button', { name: /download pdf/i }));
    expect(onDownload).toHaveBeenCalled();
  });
});
