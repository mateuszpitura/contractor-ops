import { useZatcaSubmissionDetail } from './hooks/use-zatca-submission-detail.js';
import type { ZatcaSubmissionDetailViewProps } from './zatca-submission-detail.js';
import { ZatcaSubmissionDetailView } from './zatca-submission-detail.js';

export type ZatcaSubmissionDetailProps = Pick<
  ZatcaSubmissionDetailViewProps,
  'submission' | 'invoiceId' | 'qrCodeBase64'
>;

// Decision: mutation host — useZatcaSubmissionDetail exposes only the
// resubmit mutation + isResubmitPending for the REJECTED button; submission
// record is passed in by the invoice-detail parent. No variant flag exists.
export function ZatcaSubmissionDetail(props: ZatcaSubmissionDetailProps) {
  const hook = useZatcaSubmissionDetail(props.invoiceId);
  return <ZatcaSubmissionDetailView {...props} {...hook} />;
}
