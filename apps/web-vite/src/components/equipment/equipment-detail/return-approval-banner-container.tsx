import { useEquipmentReturnApproval } from '../hooks/use-equipment-detail-actions.js';
import type { ReturnApprovalBannerProps } from './return-approval-banner.js';
import { ReturnApprovalBannerView } from './return-approval-banner.js';

// Decisive: mutation host. Owns the approve/reject return-request mutation
// pair via `useEquipmentReturnApproval`. View is a single banner render path
// driven by the `returnRequest` prop; no hook-returned variant flag exists
// to lift (the parent already gates banner visibility before mounting us).
export function ReturnApprovalBannerContainer(props: ReturnApprovalBannerProps) {
  const { approveMutation, rejectMutation } = useEquipmentReturnApproval();
  return (
    <ReturnApprovalBannerView
      {...props}
      approveMutation={approveMutation}
      rejectMutation={rejectMutation}
    />
  );
}
