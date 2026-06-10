/**
 * Invoice upload area.
 */

import { DropZoneSurface } from '@contractor-ops/ui/components/origin/drop-zone-surface';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { CheckCircle2, Eye, EyeOff, FileText, Loader2, RotateCcw, XCircle } from 'lucide-react';
import type { ChangeEvent, DragEvent, ReactNode, RefObject } from 'react';
import { memo, useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useRouter } from '../../i18n/navigation.js';
import { formatFileSize, truncateFilename as truncateName } from '../../lib/format-file-size.js';
import { CreditExhaustedInline } from '../billing/credit-exhausted-inline.js';
import type { ExtractedInvoiceData } from '../ocr/ocr-review-panel.js';
import { OcrReviewPanelWired } from '../ocr/ocr-review-panel.js';
import type { UploadingFile } from './hooks/use-invoice-upload.js';
import { useInvoiceUpload } from './hooks/use-invoice-upload.js';

export interface InvoiceUploadAreaViewProps {
  className?: string;
  t: (key: string, values?: Record<string, unknown>) => string;
  files: UploadingFile[];
  creditExhausted: boolean;
  isDragActive: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSetDragActive: (active: boolean) => void;
  onIngestFiles: (files: File[]) => void;
  onRetryFile: (fileId: string) => void;
  hasOcrSession: boolean;
  showPdfReview: boolean;
  onTogglePdfReview: () => void;
  ocrReviewPanel: ReactNode;
}

export function InvoiceUploadAreaView({
  className,
  t,
  files,
  creditExhausted,
  isDragActive,
  fileInputRef,
  onSetDragActive,
  onIngestFiles,
  onRetryFile,
  hasOcrSession,
  showPdfReview,
  onTogglePdfReview,
  ocrReviewPanel,
}: InvoiceUploadAreaViewProps) {
  const router = useRouter();

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      onSetDragActive(false);
      const dropped = Array.from(event.dataTransfer?.files ?? []);
      if (dropped.length > 0) onIngestFiles(dropped);
    },
    [onIngestFiles, onSetDragActive],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      onSetDragActive(true);
    },
    [onSetDragActive],
  );

  const handleDragLeave = useCallback(() => {
    onSetDragActive(false);
  }, [onSetDragActive]);

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(event.target.files ?? []);
      if (picked.length > 0) onIngestFiles(picked);
      event.target.value = '';
    },
    [onIngestFiles],
  );

  const handleZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  const handleZoneKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [fileInputRef],
  );

  const handleNavigateBilling = useCallback(() => {
    router.push('/settings?tab=billing');
  }, [router]);

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      {!!hasOcrSession && (
        <div className="flex items-center justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onTogglePdfReview}>
            {showPdfReview ? (
              <>
                <EyeOff className="me-1.5 size-4" />
                {t('hidePdf')}
              </>
            ) : (
              <>
                <Eye className="me-1.5 size-4" />
                {t('viewPdf')}
              </>
            )}
          </Button>
        </div>
      )}

      <DropZoneSurface
        role="button"
        tabIndex={0}
        aria-label={t('body')}
        onClick={handleZoneClick}
        onKeyDown={handleZoneKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        isDragActive={isDragActive}
        label={t('body')}
        description={t('accepted')}>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={handleFileInput}
        />
      </DropZoneSurface>

      {!!creditExhausted && (
        <CreditExhaustedInline
          onUpgrade={handleNavigateBilling}
          onBuyCredits={handleNavigateBilling}
        />
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(item => (
            <UploadFileRow
              key={item.id}
              item={item}
              retryLabel={t('retry')}
              onRetry={onRetryFile}
            />
          ))}
        </div>
      )}

      {ocrReviewPanel}
    </div>
  );
}

interface UploadFileRowProps {
  item: UploadingFile;
  retryLabel: string;
  onRetry: (fileId: string) => void;
}

// memo: rendered per file in upload queue
const UploadFileRow = memo(function UploadFileRow({
  item,
  retryLabel,
  onRetry,
}: UploadFileRowProps) {
  const handleRetry = useCallback(() => {
    onRetry(item.id);
  }, [onRetry, item.id]);

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <FileText className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{truncateName(item.file.name)}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{formatFileSize(item.file.size)}</span>
          {item.status === 'uploading' || item.status === 'creating' ? (
            <Progress value={item.progress} className="h-1 max-w-[120px] flex-1" />
          ) : null}
        </div>
      </div>
      {(item.status === 'uploading' || item.status === 'creating') && (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
      )}
      {item.status === 'complete' && (
        <CheckCircle2 className="size-4 shrink-0 text-green-600 dark:text-green-400" />
      )}
      {item.status === 'error' && (
        <div className="flex items-center gap-1">
          <XCircle className="size-4 shrink-0 text-destructive" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={handleRetry}>
            <RotateCcw className="size-3 me-1" />
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
});

interface InvoiceUploadAreaProps {
  onUploadComplete?: () => void;
  onOcrAccept?: (data: ExtractedInvoiceData) => void;
  className?: string;
}

export function InvoiceUploadArea({
  onUploadComplete,
  onOcrAccept,
  className,
}: InvoiceUploadAreaProps) {
  const t = useTranslations('Invoices.upload');
  const upload = useInvoiceUpload(onUploadComplete, onOcrAccept);

  const { setShowPdfReview, ingestFiles } = upload;
  const togglePdfReview = useCallback(() => {
    setShowPdfReview(prev => !prev);
  }, [setShowPdfReview]);

  const handleIngestFiles = useCallback(
    (files: File[]) => ingestFiles(files, t),
    [ingestFiles, t],
  );

  const ocrReviewPanel =
    upload.showPdfReview && upload.extractionId && upload.pdfUrl ? (
      <OcrReviewPanelWired
        pdfUrl={upload.pdfUrl}
        extractionId={upload.extractionId}
        onAccept={upload.handleOcrAccept}
        onDiscard={upload.handleOcrDiscard}
        onRetrigger={upload.handleOcrRetrigger}
      />
    ) : null;

  return (
    <InvoiceUploadAreaView
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
