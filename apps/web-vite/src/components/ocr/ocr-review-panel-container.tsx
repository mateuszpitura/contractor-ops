import type { OcrExtractionResult } from '@contractor-ops/integrations/types/ocr';

import { useOcrExtractionResult } from './hooks/use-ocr-review.js';
import type { ExtractedInvoiceData } from './hooks/use-ocr-review-form.js';
import { useOcrReviewForm } from './hooks/use-ocr-review-form.js';
import { OcrReviewPanel } from './ocr-review-panel.js';

interface OcrReviewPanelContainerProps {
  pdfUrl: string;
  extractionId: string;
  onAccept: (data: ExtractedInvoiceData) => void;
  onDiscard: () => void;
  onRetrigger: () => void;
  isPortal?: boolean;
}

export function OcrReviewPanelContainer({
  pdfUrl,
  extractionId,
  onAccept,
  onDiscard,
  onRetrigger,
  isPortal = false,
}: OcrReviewPanelContainerProps) {
  const { extractionStatus, resultJson, isProcessing, isComplete } = useOcrExtractionResult(
    extractionId,
    isPortal,
  );

  // tRPC returns `resultJson` as a Prisma `JsonValue`; the hook + panel work
  // against the concrete `OcrExtractionResult` shape that produced it.
  const typedResult = resultJson as OcrExtractionResult | null | undefined;

  const form = useOcrReviewForm({
    resultJson: typedResult,
    isComplete,
    onAccept,
  });

  return (
    <OcrReviewPanel
      pdfUrl={pdfUrl}
      onDiscard={onDiscard}
      onRetrigger={onRetrigger}
      extractionStatus={extractionStatus}
      resultJson={typedResult}
      isProcessing={isProcessing}
      form={form}
    />
  );
}
