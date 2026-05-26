import { useEquipmentReturnApproval } from '../hooks/use-equipment-detail-actions.js';
import type { ReturnApprovalBannerProps } from './return-approval-banner.js';
import { ReturnApprovalBannerView } from './return-approval-banner.js';

// Decision: mutation host — useEquipmentReturnApproval exposes approve/reject
// mutations; EquipmentDetailContainer gates banner visibility before mounting.
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
