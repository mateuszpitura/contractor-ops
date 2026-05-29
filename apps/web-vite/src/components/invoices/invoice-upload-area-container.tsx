import { useCallback } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { ExtractedInvoiceData } from '../ocr/ocr-review-panel.js';
import { OcrReviewPanelContainer } from '../ocr/ocr-review-panel-container.js';
import { useInvoiceUpload } from './hooks/use-invoice-upload.js';
import { InvoiceUploadArea } from './invoice-upload-area.js';

interface InvoiceUploadAreaContainerProps {
  onUploadComplete?: () => void;
  onOcrAccept?: (data: ExtractedInvoiceData) => void;
  className?: string;
}

export function InvoiceUploadAreaContainer({
  onUploadComplete,
  onOcrAccept,
  className,
}: InvoiceUploadAreaContainerProps) {
  const t = useTranslations('Invoices.upload');
  const upload = useInvoiceUpload(onUploadComplete, onOcrAccept);

  const { setShowPdfReview, ingestFiles } = upload;
  const togglePdfReview = useCallback(() => {
    setShowPdfReview(prev => !prev);
  }, [setShowPdfReview]);

  const handleIngestFiles = useCallback((files: File[]) => ingestFiles(files, t), [ingestFiles, t]);

  const ocrReviewPanel =
    upload.showPdfReview && upload.extractionId && upload.pdfUrl ? (
      <OcrReviewPanelContainer
        pdfUrl={upload.pdfUrl}
        extractionId={upload.extractionId}
        onAccept={upload.handleOcrAccept}
        onDiscard={upload.handleOcrDiscard}
        onRetrigger={upload.handleOcrRetrigger}
      />
    ) : null;

  return (
    <InvoiceUploadArea
      className={className}
      t={t}
      files={upload.files}
      creditExhausted={upload.creditExhausted}
      isDragActive={upload.isDragActive}
      fileInputRef={upload.fileInputRef}
      onSetDragActive={upload.setIsDragActive}
      onIngestFiles={handleIngestFiles}
      onRetryFile={upload.retryFile}
      hasOcrSession={upload.extractionId != null && upload.pdfUrl != null}
      showPdfReview={upload.showPdfReview}
      onTogglePdfReview={togglePdfReview}
      ocrReviewPanel={ocrReviewPanel}
    />
  );
}
