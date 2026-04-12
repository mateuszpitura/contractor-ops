'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
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
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { CreditExhaustedInline } from '@/components/billing/credit-exhausted-inline';
import type { ExtractedInvoiceData } from '@/components/ocr/ocr-review-panel';
import { OcrReviewPanel } from '@/components/ocr/ocr-review-panel';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InvoiceUploadAreaProps {
  onUploadComplete?: () => void;
  onOcrAccept?: (data: ExtractedInvoiceData) => void;
  className?: string;
}

type FileUploadStatus = 'uploading' | 'creating' | 'complete' | 'error';

interface UploadingFile {
  id: string;
  file: File;
  status: FileUploadStatus;
  progress: number;
  documentId?: string;
  storageKey?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { formatFileSize, truncateFilename as truncateName } from '@/lib/format-file-size';

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ACCEPT_PDF = { 'application/pdf': ['.pdf'] };
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * Invoice upload area wrapper.
 * Accepts multiple PDFs via drag and drop, uploads each via presigned URL,
 * then creates an invoice draft per file via trpc.invoice.create.
 * If uploaded file is a PDF, triggers OCR extraction automatically.
 */
export function InvoiceUploadArea({
  onUploadComplete,
  onOcrAccept,
  className,
}: InvoiceUploadAreaProps) {
  const t = useTranslations('Invoices.upload');
  const queryClient = useQueryClient();
  const router = useRouter();
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [creditExhausted, setCreditExhausted] = useState(false);

  // OCR state
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfReview, setShowPdfReview] = useState(false);

  const requestUploadMutation = useMutation(trpc.document.requestUpload.mutationOptions({}));

  const confirmUploadMutation = useMutation(trpc.document.confirmUpload.mutationOptions({}));

  const createInvoiceMutation = useMutation(trpc.invoice.create.mutationOptions({}));

  const ocrTriggerMutation = useMutation(trpc.ocr.trigger.mutationOptions({}));

  const ocrRetriggerMutation = useMutation(trpc.ocr.retrigger.mutationOptions({}));

  const uploadFile = useCallback(
    async (file: File) => {
      const fileId = `${file.name}-${Date.now()}`;

      setFiles(prev => [...prev, { id: fileId, file, status: 'uploading', progress: 0 }]);

      try {
        // Step 1: Request presigned upload URL
        const result = await requestUploadMutation.mutateAsync({
          filename: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
        } as Parameters<typeof requestUploadMutation.mutateAsync>[0]);

        const uploadResult = result as Record<string, unknown>;
        const documentId = uploadResult.documentId as string;
        const uploadUrl = uploadResult.uploadUrl as string;
        const storageKey = (uploadResult.storageKey as string) ?? '';

        setFiles(prev =>
          prev.map(f => (f.id === fileId ? { ...f, documentId, storageKey, progress: 10 } : f)),
        );

        // Step 2: Upload directly to R2 via presigned URL with progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);

          xhr.upload.onprogress = event => {
            if (event.lengthComputable) {
              const percent = Math.round(10 + (event.loaded / event.total) * 70);
              setFiles(prev => prev.map(f => (f.id === fileId ? { ...f, progress: percent } : f)));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.send(file);
        });

        // Step 3: Confirm upload
        setFiles(prev => prev.map(f => (f.id === fileId ? { ...f, progress: 85 } : f)));

        await confirmUploadMutation.mutateAsync({
          documentId,
        } as Parameters<typeof confirmUploadMutation.mutateAsync>[0]);

        // Step 4: Create invoice draft
        setFiles(prev =>
          prev.map(f => (f.id === fileId ? { ...f, status: 'creating', progress: 90 } : f)),
        );

        await createInvoiceMutation.mutateAsync({
          invoiceNumber: file.name.replace(/\.pdf$/i, ''),
          issueDate: new Date().toISOString().split('T')[0]!,
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]!,
          currency: 'PLN',
          subtotalMinor: 0,
          totalMinor: 0,
          amountToPayMinor: 0,
          documentIds: [documentId],
        });

        setFiles(prev =>
          prev.map(f => (f.id === fileId ? { ...f, status: 'complete', progress: 100 } : f)),
        );

        // Step 5: Trigger OCR if file is PDF
        if (isPdfFile(file) && storageKey) {
          try {
            const ocrResult = await ocrTriggerMutation.mutateAsync({
              documentId,
              storageKey,
            });
            setExtractionId(ocrResult.extractionId);
            // Create a blob URL for the PDF preview
            setPdfUrl(URL.createObjectURL(file));
            setShowPdfReview(true);
          } catch (error) {
            if (
              error instanceof TRPCClientError &&
              error.data?.code === 'PRECONDITION_FAILED' &&
              error.message === 'OCR credits exhausted'
            ) {
              setCreditExhausted(true);
            } else {
              // OCR trigger failure is non-blocking
              console.warn('OCR trigger failed, manual entry available');
            }
          }
        }
      } catch {
        setFiles(prev =>
          prev.map(f => (f.id === fileId ? { ...f, status: 'error', progress: 0 } : f)),
        );
      }
    },
    [requestUploadMutation, confirmUploadMutation, createInvoiceMutation, ocrTriggerMutation],
  );

  const retryFile = useCallback(
    (fileId: string) => {
      const fileEntry = files.find(f => f.id === fileId);
      if (!fileEntry) return;
      // Remove failed entry and re-upload
      setFiles(prev => prev.filter(f => f.id !== fileId));
      void uploadFile(fileEntry.file);
    },
    [files, uploadFile],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        void uploadFile(file);
      }

      // Track completion across all files
      const totalFiles = files.length + acceptedFiles.length;
      const checkComplete = () => {
        setFiles(current => {
          const allDone =
            current.length >= totalFiles &&
            current.every(f => f.status === 'complete' || f.status === 'error');
          if (allDone && current.some(f => f.status === 'complete')) {
            const completedCount = current.filter(f => f.status === 'complete').length;
            toast.success(t('complete', { count: completedCount }));
            // Refresh invoice list
            queryClient.invalidateQueries({
              queryKey: trpc.invoice.list.queryKey(),
            });
            queryClient.invalidateQueries({
              queryKey: trpc.invoice.statusCounts.queryKey(),
            });
            onUploadComplete?.();
          }
          return current;
        });
      };

      // Check completion periodically
      const interval = setInterval(checkComplete, 500);
      setTimeout(() => clearInterval(interval), 60000);
    },
    [uploadFile, files.length, t, queryClient, onUploadComplete],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT_PDF,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  });

  // OCR handlers
  const handleOcrAccept = useCallback(
    (data: ExtractedInvoiceData) => {
      onOcrAccept?.(data);
      setShowPdfReview(false);
    },
    [onOcrAccept],
  );

  const handleOcrDiscard = useCallback(() => {
    setExtractionId(null);
    setShowPdfReview(false);
  }, []);

  const handleOcrRetrigger = useCallback(async () => {
    if (!extractionId) return;
    try {
      const result = await ocrRetriggerMutation.mutateAsync({ extractionId });
      setExtractionId(result.extractionId);
    } catch {
      toast.error('Failed to re-run OCR. Please try again.');
    }
  }, [extractionId, ocrRetriggerMutation]);

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      {/* Drop zone header with View PDF toggle */}
      {extractionId && pdfUrl && (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPdfReview(prev => !prev)}>
            {showPdfReview ? (
              <>
                <EyeOff className="me-1.5 size-4" />
                Hide PDF
              </>
            ) : (
              <>
                <Eye className="me-1.5 size-4" />
                View PDF
              </>
            )}
          </Button>
        </div>
      )}

      {/* Drop zone area */}
      <div
        {...getRootProps()}
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/[0.03]'
            : 'border-border bg-muted/50 hover:border-muted-foreground/30'
        }`}>
        <input {...getInputProps()} />
        <UploadCloud
          className={`mb-3 size-8 text-muted-foreground transition-transform ${
            isDragActive ? 'scale-110 text-primary' : ''
          }`}
        />
        <p className="text-center text-sm text-muted-foreground">{t('body')} </p>
        <p className="mt-1 text-xs text-muted-foreground">{t('accepted')}</p>
      </div>

      {/* Credit exhaustion banner */}
      {creditExhausted && (
        <CreditExhaustedInline
          onUpgrade={() => router.push('/settings?tab=billing')}
          onBuyCredits={() => router.push('/settings?tab=billing')}
        />
      )}

      {/* Upload progress list */}
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
              {/* Status icon */}
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
                    onClick={() => retryFile(item.id)}>
                    <RotateCcw className="size-3 me-1" />
                    {t('retry')}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* OCR Review Panel */}
      {showPdfReview && extractionId && pdfUrl && (
        <OcrReviewPanel
          pdfUrl={pdfUrl}
          extractionId={extractionId}
          onAccept={handleOcrAccept}
          onDiscard={handleOcrDiscard}
          onRetrigger={handleOcrRetrigger}
        />
      )}
    </div>
  );
}
