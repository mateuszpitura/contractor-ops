import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';

const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseQueryClient = vi.hoisted(() => vi.fn(() => ({ invalidateQueries: vi.fn() })));

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useMutation: mockUseMutation, useQueryClient: mockUseQueryClient };
});

vi.mock('next/image', () => ({
  default: ({ alt, ...props }: { alt: string; [k: string]: unknown }) => (
    <img alt={alt} {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />
  ),
}));

import { ZatcaSubmissionDetail } from '../zatca-submission-detail';

const baseSubmission = {
  id: 'sub-1',
  icv: 42,
  zatcaUuid: 'uuid-1234-5678-abcd',
  zatcaStatus: 'CLEARED',
  submittedAt: '2026-03-01T10:00:00Z',
  clearedAt: '2026-03-01T10:05:00Z',
  reportedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  createdAt: '2026-03-01T09:00:00Z',
  invoiceHash: 'abc123def456',
  previousHash: '000111222333',
};

describe('ZatcaSubmissionDetail', () => {
  beforeEach(() => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it('renders collapsible trigger with title', () => {
    render(<ZatcaSubmissionDetail submission={baseSubmission} invoiceId="inv-1" />);
    expect(screen.getByText('ZATCA Submission Details')).toBeInTheDocument();
  });

  it('shows submission details when expanded', async () => {
    const { user } = setup(<ZatcaSubmissionDetail submission={baseSubmission} invoiceId="inv-1" />);
    await user.click(screen.getByText('ZATCA Submission Details'));

    expect(screen.getByText('uuid-1234-5678-abcd')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('ZATCA Cleared')).toBeInTheDocument();
  });

  it('shows View Signed XML button when expanded', async () => {
    const { user } = setup(<ZatcaSubmissionDetail submission={baseSubmission} invoiceId="inv-1" />);
    await user.click(screen.getByText('ZATCA Submission Details'));

    expect(screen.getByText('View Signed XML')).toBeInTheDocument();
  });

  it('does not show Resubmit button for non-rejected submissions', async () => {
    const { user } = setup(<ZatcaSubmissionDetail submission={baseSubmission} invoiceId="inv-1" />);
    await user.click(screen.getByText('ZATCA Submission Details'));

    expect(screen.queryByText('Resubmit to ZATCA')).not.toBeInTheDocument();
  });

  it('shows Resubmit button for rejected submissions', async () => {
    const rejected = {
      ...baseSubmission,
      zatcaStatus: 'REJECTED',
      rejectedAt: '2026-03-01T10:05:00Z',
      clearedAt: null,
      rejectionReason: 'Invalid hash',
    };
    const { user } = setup(<ZatcaSubmissionDetail submission={rejected} invoiceId="inv-1" />);
    await user.click(screen.getByText('ZATCA Submission Details'));

    expect(screen.getByText('Resubmit to ZATCA')).toBeInTheDocument();
  });

  it('shows rejection reason for rejected submissions', async () => {
    const rejected = {
      ...baseSubmission,
      zatcaStatus: 'REJECTED',
      rejectedAt: '2026-03-01T10:05:00Z',
      clearedAt: null,
      rejectionReason: 'Invalid hash',
    };
    const { user } = setup(<ZatcaSubmissionDetail submission={rejected} invoiceId="inv-1" />);
    await user.click(screen.getByText('ZATCA Submission Details'));

    expect(screen.getByText('Rejection Reason')).toBeInTheDocument();
    expect(screen.getByText('Invalid hash')).toBeInTheDocument();
  });

  it('shows hash chain when expanded', async () => {
    const { user } = setup(<ZatcaSubmissionDetail submission={baseSubmission} invoiceId="inv-1" />);
    await user.click(screen.getByText('ZATCA Submission Details'));

    expect(screen.getByText('Hash Chain')).toBeInTheDocument();
    expect(screen.getByText('Previous Hash:')).toBeInTheDocument();
    expect(screen.getByText('Invoice Hash:')).toBeInTheDocument();
  });

  it('renders QR code image when provided', async () => {
    const { user } = setup(
      <ZatcaSubmissionDetail
        submission={baseSubmission}
        invoiceId="inv-1"
        qrCodeBase64="dGVzdA=="
      />,
    );
    await user.click(screen.getByText('ZATCA Submission Details'));

    expect(
      screen.getByAltText(
        'ZATCA QR code containing seller name, VAT number, invoice total, and VAT amount',
      ),
    ).toBeInTheDocument();
  });

  it('does not render QR code when not provided', async () => {
    const { user } = setup(<ZatcaSubmissionDetail submission={baseSubmission} invoiceId="inv-1" />);
    await user.click(screen.getByText('ZATCA Submission Details'));

    expect(
      screen.queryByAltText(
        'ZATCA QR code containing seller name, VAT number, invoice total, and VAT amount',
      ),
    ).not.toBeInTheDocument();
  });

  it('shows copy UUID button with aria-label', async () => {
    const { user } = setup(<ZatcaSubmissionDetail submission={baseSubmission} invoiceId="inv-1" />);
    await user.click(screen.getByText('ZATCA Submission Details'));

    expect(screen.getByLabelText('Copy UUID')).toBeInTheDocument();
  });
});
