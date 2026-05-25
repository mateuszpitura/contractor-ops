import { usePermissions } from '../../../hooks/use-permissions.js';
import { canViewSensitivePii } from '../../../lib/mask-pii.js';
import { useBacsPreview } from '../hooks/use-bacs-preview.js';
import { BacsPreviewCard } from './bacs-preview-card.js';

interface BacsPreviewCardContainerProps {
  paymentRunId: string;
}

export function BacsPreviewCardContainer({ paymentRunId }: BacsPreviewCardContainerProps) {
  const preview = useBacsPreview(paymentRunId);
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);
  return <BacsPreviewCard preview={preview} showPii={showPii} />;
}
