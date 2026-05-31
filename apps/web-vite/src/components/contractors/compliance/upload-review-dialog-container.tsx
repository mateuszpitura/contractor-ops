import { useUploadReview } from './hooks/use-upload-review.js';
import { UploadReviewDialog } from './upload-review-dialog.js';

export interface UploadReviewDialogContainerProps {
  itemId: string;
  documentId: string;
  defaultExpiresAt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Wires the approve/reject mutations to the admin upload-review dialog (D-08). */
export function UploadReviewDialogContainer({
  itemId,
  documentId,
  defaultExpiresAt,
  open,
  onOpenChange,
}: UploadReviewDialogContainerProps) {
  const { approve, reject, isPending } = useUploadReview(() => onOpenChange(false));

  return (
    <UploadReviewDialog
      open={open}
      onOpenChange={onOpenChange}
      isPending={isPending}
      defaultExpiresAt={defaultExpiresAt}
      onApprove={({ expiresAt }) => approve({ itemId, documentId, expiresAt })}
      onReject={({ reasonCategory, freeText }) =>
        reject({ itemId, documentId, reasonCategory, freeText })
      }
    />
  );
}
