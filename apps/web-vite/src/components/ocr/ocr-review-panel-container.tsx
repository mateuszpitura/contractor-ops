import type { OcrExtractionResult } from '@contractor-ops/integrations/types/ocr';

import { useOcrExtractionResult } from './hooks/use-ocr-review.js';
import type { ExtractedInvoiceData } from './hooks/use-ocr-review-form.js';
import { useOcrReviewForm } from './hooks/use-ocr-review-form.js';
import {
  OcrReviewFormBody,
  OcrReviewPanel,
  OcrReviewPanelProcessingBody,
} from './ocr-review-panel.js';

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

  const cardBody = isProcessing ? (
    <OcrReviewPanelProcessingBody />
  ) : (
    <OcrReviewFormBody
      onDiscard={onDiscard}
      onRetrigger={onRetrigger}
      resultJson={typedResult}
      form={form}
    />
  );

  return (
    <OcrReviewPanel
      pdfUrl={pdfUrl}
      extractionStatus={extractionStatus}
      resultJson={typedResult}
      onRetrigger={onRetrigger}
      fieldCount={form.derived.fieldCount}
      totalFields={form.derived.totalFields}
      cardBody={cardBody}
    />
  );
}
