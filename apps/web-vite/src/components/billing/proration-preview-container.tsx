import { useTranslations } from '../../i18n/useTranslations.js';
import { useProrationPreview } from './hooks/use-billing.js';
import {
  ProrationPreview,
  ProrationPreviewError,
  ProrationPreviewSkeleton,
} from './proration-preview.js';

interface ProrationPreviewContainerProps {
  newPriceId: string;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export function ProrationPreviewContainer({
  newPriceId,
  onConfirm,
  onCancel,
  isConfirming,
}: ProrationPreviewContainerProps) {
  const t = useTranslations('Billing.proration');
  const { data, isLoading, isError } = useProrationPreview(newPriceId);

  if (isLoading) return <ProrationPreviewSkeleton />;
  if (isError || !data) return <ProrationPreviewError t={t} onCancel={onCancel} />;

  return (
    <ProrationPreview
      t={t}
      lines={data.lines}
      totalMinor={data.totalMinor}
      onConfirm={onConfirm}
      onCancel={onCancel}
      isConfirming={isConfirming}
    />
  );
}
