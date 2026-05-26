/**
 * Invoice upload area. Step 11 codemod port from
 * apps/web/src/components/invoices/invoice-upload-area.tsx:
 *   - `next-intl`                          → `../../i18n/useTranslations.js`
 *   - `@/i18n/navigation`                   → `../../i18n/navigation.js`
 *   - Data layer → `hooks/use-invoice-upload.ts` + `invoice-upload-area-container.tsx`
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  RotateCcw,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import type { ChangeEvent, DragEvent, ReactNode, RefObject } from 'react';
import { useCallback } from 'react';

import { useRouter } from '../../i18n/navigation.js';
import { formatFileSize, truncateFilename as truncateName } from '../../lib/format-file-size.js';
import { CreditExhaustedInline } from '../billing/credit-exhausted-inline.js';
import type { UploadingFile } from './hooks/use-invoice-upload.js';

interface InvoiceUploadAreaProps {
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

export function InvoiceUploadArea({
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
}: InvoiceUploadAreaProps) {
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

      <div
        role="button"
        tabIndex={0}
        aria-label={t('body')}
        onClick={handleZoneClick}
        onKeyDown={handleZoneKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          isDragActive
            ? 'border-primary bg-primary/[0.03]'
            : 'border-border bg-muted/50 hover:border-muted-foreground/30'
        }`}>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={handleFileInput}
        />
        <UploadCloud
          className={`mb-3 size-8 text-muted-foreground transition-transform ${
            isDragActive ? 'scale-110 text-primary' : ''
          }`}
        />
        <p className="text-center text-sm text-muted-foreground">{t('body')} </p>
        <p className="mt-1 text-xs text-muted-foreground">{t('accepted')}</p>
      </div>

      {!!creditExhausted && (
        <CreditExhaustedInline
          onUpgrade={() => router.push('/settings?tab=billing')}
          onBuyCredits={() => router.push('/settings?tab=billing')}
        />
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(item => (
            <div key={item.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <FileText className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{truncateName(item.file.name)}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(item.file.size)}
                  </span>
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
                    onClick={() => onRetryFile(item.id)}>
                    <RotateCcw className="size-3 me-1" />
                    {t('retry')}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {ocrReviewPanel}
    </div>
  );
}
