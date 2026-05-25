import { useZatcaSubmissionDetail } from './hooks/use-zatca-submission-detail.js';
import type { ZatcaSubmissionDetailViewProps } from './zatca-submission-detail.js';
import { ZatcaSubmissionDetailView } from './zatca-submission-detail.js';

export type ZatcaSubmissionDetailProps = Pick<
  ZatcaSubmissionDetailViewProps,
  'submission' | 'invoiceId' | 'qrCodeBase64'
>;

/**
 * Decision: passthrough is intentional here.
 *
 * The submission record (status, hashes, QR, rejection reason) is
 * passed in by the invoice-detail parent, not fetched in this hook.
 * The hook only exposes the `resubmit` mutation + `isResubmitPending`
 * for the REJECTED → Resubmit button. There is no isLoading / isError
 * / isEmpty path here and no variant flag the view branches on — the
 * sub-sections (hash chain, QR, rejection reason, resubmit button)
 * key off the caller-supplied submission fields. Splitting would not
 * lift any decision out of the view.
 */
export function ZatcaSubmissionDetail(props: ZatcaSubmissionDetailProps) {
  const hook = useZatcaSubmissionDetail(props.invoiceId);
  return <ZatcaSubmissionDetailView {...props} {...hook} />;
}
