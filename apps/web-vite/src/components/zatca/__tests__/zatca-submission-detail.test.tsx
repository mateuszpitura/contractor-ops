/**
 * Web-vite port of apps/web/src/components/zatca/__tests__/zatca-submission-detail.test.tsx.
 *
 * ZatcaSubmissionDetailView is pure presentational; the resubmit mutation
 * lives in `useZatcaSubmissionDetail`. The test passes a shaped
 * `submission` literal and a stub `resubmit` callback.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { useTranslations } from '../../../i18n/useTranslations';

import { ZatcaSubmissionDetailView } from '../zatca-submission-detail';

type ViewProps = React.ComponentProps<typeof ZatcaSubmissionDetailView>;

const baseSubmission: ViewProps['submission'] = {
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

interface Overrides {
  submission?: ViewProps['submission'];
  invoiceId?: string;
  qrCodeBase64?: string;
  resubmit?: () => void;
  isResubmitPending?: boolean;
}

function Harness(props: Overrides) {
  const t = useTranslations('Zatca.submissionDetail');
  return (
    <ZatcaSubmissionDetailView
      submission={props.submission ?? baseSubmission}
      invoiceId={props.invoiceId ?? 'inv-1'}
      qrCodeBase64={props.qrCodeBase64}
      resubmit={props.resubmit ?? vi.fn()}
      isResubmitPending={props.isResubmitPending ?? false}
      t={t}
    />
  );
}

describe('ZatcaSubmissionDetail (web-vite)', () => {
  it('renders the collapsible trigger title', () => {
    render(<Harness />);
    expect(screen.getByText('ZATCA Submission Details')).toBeInTheDocument();
  });

  it('shows core fields when expanded', async () => {
    const { user } = setup(<Harness />);
    await user.click(screen.getByText('ZATCA Submission Details'));
    expect(screen.getByText('uuid-1234-5678-abcd')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows View Signed XML button when expanded', async () => {
    const { user } = setup(<Harness />);
    await user.click(screen.getByText('ZATCA Submission Details'));
    expect(screen.getByText('View Signed XML')).toBeInTheDocument();
  });

  it('does not show Resubmit button for non-rejected submissions', async () => {
    const { user } = setup(<Harness />);
    await user.click(screen.getByText('ZATCA Submission Details'));
    expect(screen.queryByText('Resubmit to ZATCA')).not.toBeInTheDocument();
  });

  it('shows Resubmit button for rejected submissions', async () => {
    const rejected: ViewProps['submission'] = {
      ...baseSubmission,
      zatcaStatus: 'REJECTED',
      rejectedAt: '2026-03-01T10:05:00Z',
      clearedAt: null,
      rejectionReason: 'Invalid hash',
    };
    const { user } = setup(<Harness submission={rejected} />);
    await user.click(screen.getByText('ZATCA Submission Details'));
    expect(screen.getByText('Resubmit to ZATCA')).toBeInTheDocument();
  });

  it('invokes resubmit when Resubmit button is clicked', async () => {
    const rejected: ViewProps['submission'] = {
      ...baseSubmission,
      zatcaStatus: 'REJECTED',
      rejectedAt: '2026-03-01T10:05:00Z',
      clearedAt: null,
      rejectionReason: 'Invalid hash',
    };
    const resubmit = vi.fn();
    const { user } = setup(<Harness submission={rejected} resubmit={resubmit} />);
    await user.click(screen.getByText('ZATCA Submission Details'));
    await user.click(screen.getByText('Resubmit to ZATCA'));
    expect(resubmit).toHaveBeenCalledOnce();
  });

  it('shows rejection reason for rejected submissions', async () => {
    const rejected: ViewProps['submission'] = {
      ...baseSubmission,
      zatcaStatus: 'REJECTED',
      rejectedAt: '2026-03-01T10:05:00Z',
      clearedAt: null,
      rejectionReason: 'Invalid hash',
    };
    const { user } = setup(<Harness submission={rejected} />);
    await user.click(screen.getByText('ZATCA Submission Details'));
    expect(screen.getByText('Rejection Reason')).toBeInTheDocument();
    expect(screen.getByText('Invalid hash')).toBeInTheDocument();
  });

  it('shows hash chain rows when expanded', async () => {
    const { user } = setup(<Harness />);
    await user.click(screen.getByText('ZATCA Submission Details'));
    expect(screen.getByText('Hash Chain')).toBeInTheDocument();
    expect(screen.getByText('Previous Hash:')).toBeInTheDocument();
    expect(screen.getByText('Invoice Hash:')).toBeInTheDocument();
  });

  it('renders QR code image when qrCodeBase64 is provided', async () => {
    const { user } = setup(<Harness qrCodeBase64="dGVzdA==" />);
    await user.click(screen.getByText('ZATCA Submission Details'));
    expect(
      screen.getByAltText(
        'ZATCA QR code containing seller name, VAT number, invoice total, and VAT amount',
      ),
    ).toBeInTheDocument();
  });

  it('does not render QR code when qrCodeBase64 is missing', async () => {
    const { user } = setup(<Harness />);
    await user.click(screen.getByText('ZATCA Submission Details'));
    expect(
      screen.queryByAltText(
        'ZATCA QR code containing seller name, VAT number, invoice total, and VAT amount',
      ),
    ).not.toBeInTheDocument();
  });

  it('exposes copy-UUID button with accessible label', async () => {
    const { user } = setup(<Harness />);
    await user.click(screen.getByText('ZATCA Submission Details'));
    expect(screen.getByLabelText('Copy UUID')).toBeInTheDocument();
  });

  it('disables Resubmit button while isResubmitPending', async () => {
    const rejected: ViewProps['submission'] = {
      ...baseSubmission,
      zatcaStatus: 'REJECTED',
      rejectedAt: '2026-03-01T10:05:00Z',
      clearedAt: null,
      rejectionReason: 'Invalid hash',
    };
    const { user } = setup(<Harness submission={rejected} isResubmitPending />);
    await user.click(screen.getByText('ZATCA Submission Details'));
    expect(screen.getByRole('button', { name: /resubmit to zatca/i })).toBeDisabled();
  });
});
