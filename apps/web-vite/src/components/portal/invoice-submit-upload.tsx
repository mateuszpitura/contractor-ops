import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { ExternalLink, FileText, UploadCloud, X } from 'lucide-react';
import { useCallback } from 'react';

import type { LooseTranslator } from '../../i18n/typed-keys.js';
import { CreditExhaustedInline } from '../billing/credit-exhausted-inline.js';

export type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | {
      status: 'uploaded';
      documentId: string;
      storageKey: string;
      originalFileName: string;
      fileSizeBytes: number;
    }
  | { status: 'error'; message: string };

export function formatFileSize(bytes: number, tc: LooseTranslator): string {
  if (bytes < 1024) return tc('bytes', { size: bytes });
  if (bytes < 1024 * 1024) return tc('kilobytes', { size: (bytes / 1024).toFixed(1) });
  return tc('megabytes', { size: (bytes / (1024 * 1024)).toFixed(2) });
}

export interface UploadSectionProps {
  upload: UploadState;
  isDragActive: boolean;
  getRootProps: () => Record<string, unknown>;
  getInputProps: () => Record<string, unknown>;
  pdfBlobUrl: string | null;
  removeFile: () => void;
  creditExhausted: boolean;
  onNavigateBilling: () => void;
  t: LooseTranslator;
  tc: LooseTranslator;
  tAria: LooseTranslator;
}

export function UploadSection({
  upload,
  isDragActive,
  getRootProps,
  getInputProps,
  pdfBlobUrl,
  removeFile,
  creditExhausted,
  onNavigateBilling,
  t,
  tc,
  tAria,
}: UploadSectionProps) {
  const openPdfPreview = useCallback(() => {
    if (pdfBlobUrl) window.open(pdfBlobUrl, '_blank', 'noopener,noreferrer');
  }, [pdfBlobUrl]);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">{t('invoicePdf')}</h2>

      {upload.status === 'idle' || upload.status === 'error' ? (
        <div
          {...getRootProps()}
          className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/[0.03]'
              : 'border-border bg-muted/50 hover:border-muted-foreground/30'
          }`}>
          <input {...getInputProps()} />
          <UploadCloud
            className={`mb-3 h-8 w-8 text-muted-foreground transition-transform ${
              isDragActive ? 'scale-110 text-primary' : ''
            }`}
          />
          <p className="text-center text-sm text-muted-foreground">{t('dropText')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('dropSubtext')}</p>
        </div>
      ) : upload.status === 'uploading' ? (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">{t('uploading')}</span>
          </div>
          <Progress value={upload.progress} />
        </div>
      ) : upload.status === 'uploaded' ? (
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{upload.originalFileName}</p>
              <p className="text-[13px] text-muted-foreground">
                {formatFileSize(upload.fileSizeBytes, tc)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pdfBlobUrl ? (
              <Button type="button" variant="ghost" size="sm" onClick={openPdfPreview}>
                <ExternalLink className="me-1 h-3.5 w-3.5" />
                {t('viewPdf')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={removeFile}
              aria-label={tAria('removeFile')}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {upload.status === 'error' ? (
        <p className="text-sm text-destructive">{upload.message}</p>
      ) : null}

      {creditExhausted ? (
        <CreditExhaustedInline onUpgrade={onNavigateBilling} onBuyCredits={onNavigateBilling} />
      ) : null}
    </div>
  );
}
