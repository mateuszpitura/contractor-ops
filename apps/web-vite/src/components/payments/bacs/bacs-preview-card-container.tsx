import { usePermissions } from '../../../hooks/use-permissions.js';
import { canViewSensitivePii } from '../../../lib/mask-pii.js';
import { useBacsPreview } from '../hooks/use-bacs-preview.js';
import { BacsPreviewCard } from './bacs-preview-card.js';
import { BacsPreviewCardUnconfigured } from './bacs-preview-card-unconfigured.js';
import type { ModulusWarning } from './modulus-check-warning-list.js';
import type { TransliterationWarning } from './transliteration-warning-banner.js';

interface BacsPreviewCardContainerProps {
  paymentRunId: string;
}

export function BacsPreviewCardContainer({ paymentRunId }: BacsPreviewCardContainerProps) {
  const preview = useBacsPreview(paymentRunId);
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);

  if (preview.submitterNotConfigured) {
    return <BacsPreviewCardUnconfigured />;
  }

  const transliterationWarnings = (preview.previewData?.transliterationWarnings ??
    []) as TransliterationWarning[];
  const modulusWarnings = (preview.previewData?.modulusWarnings ?? []) as ModulusWarning[];
  const hasUnmappable = transliterationWarnings.some(w => w.replaced.length > 0);
  const isPreviewLoading =
    preview.previewVisible && preview.isPreviewFetching && !preview.previewData;

  return (
    <BacsPreviewCard
      showPii={showPii}
      previewVisible={preview.previewVisible}
      isPreviewFetching={preview.isPreviewFetching}
      isPreviewLoading={isPreviewLoading}
      previewData={preview.previewData}
      previewError={preview.previewError}
      transliterationWarnings={transliterationWarnings}
      modulusWarnings={modulusWarnings}
      hasUnmappable={hasUnmappable}
      onShowPreview={preview.onShowPreview}
      onGenerate={preview.onGenerate}
      isGenerating={preview.isGenerating}
    />
  );
}
