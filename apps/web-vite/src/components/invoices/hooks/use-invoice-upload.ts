import * as Sentry from '@sentry/react';
import { useQueryClient } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ExtractedInvoiceData } from '../../ocr/ocr-review-panel.js';

export type FileUploadStatus = 'uploading' | 'creating' | 'complete' | 'error';

export interface UploadingFile {
  id: string;
  file: File;
  status: FileUploadStatus;
  progress: number;
  documentId?: string;
  storageKey?: string;
  error?: string;
}

export function useInvoiceUpload(
  onUploadComplete?: () => void,
  onOcrAccept?: (data: ExtractedInvoiceData) => void,
) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const t = useTranslations('Invoices.upload');
  const toasts = useCommonToasts();

  const uploadStepConfig = {
    successMessage: toasts.done(),
    errorMessage: t('error'),
    suppressErrorToast: () => true,
  };

  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [creditExhausted, setCreditExhausted] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfReview, setShowPdfReview] = useState(false);

  const pdfUrlRef = useRef<string | null>(null);
  pdfUrlRef.current = pdfUrl;
  useEffect(
    () => () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    },
    [],
  );

  const requestUploadMutation = useResourceMutation(trpc.document.requestUpload.mutationOptions(), {
    ...uploadStepConfig,
    invalidate: [trpc.document.pathFilter()],
  });

  const confirmUploadMutation = useResourceMutation(trpc.document.confirmUpload.mutationOptions(), {
    ...uploadStepConfig,
    invalidate: [trpc.document.pathFilter()],
  });

  const createInvoiceMutation = useResourceMutation(trpc.invoice.create.mutationOptions(), {
    ...uploadStepConfig,
    invalidate: [trpc.invoice.pathFilter()],
  });

  const ocrTriggerMutation = useResourceMutation(trpc.ocr.trigger.mutationOptions(), {
    ...uploadStepConfig,
    invalidate: [trpc.ocr.pathFilter()],
  });

  const ocrRetriggerMutation = useResourceMutation(trpc.ocr.retrigger.mutationOptions(), {
    ...uploadStepConfig,
    invalidate: [trpc.ocr.pathFilter()],
  });

  const triggerOcrForPdf = useCallback(
    async (file: File, documentId: string, storageKey: string) => {
      try {
        const ocrResult = await ocrTriggerMutation.mutateAsync({ documentId, storageKey });
        setExtractionId(ocrResult.extractionId);
        setPdfUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(file);
        });
        setShowPdfReview(true);
      } catch (error) {
        if (
          error instanceof TRPCClientError &&
          error.data?.code === 'PRECONDITION_FAILED' &&
          error.message === 'OCR credits exhausted'
        ) {
          setCreditExhausted(true);
        } else {
          Sentry.captureException(error, { tags: { feature: 'invoice-upload' } });
        }
      }
    },
    [ocrTriggerMutation],
  );

  const handleOcrAccept = useCallback(
    (data: ExtractedInvoiceData) => {
      onOcrAccept?.(data);
      setShowPdfReview(false);
    },
    [onOcrAccept],
  );

  const handleOcrDiscard = useCallback(() => {
    setPdfUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setExtractionId(null);
    setShowPdfReview(false);
  }, []);

  const handleOcrRetrigger = useCallback(async () => {
    if (!extractionId) return;
    try {
      const result = await ocrRetriggerMutation.mutateAsync({ extractionId });
      setExtractionId(result.extractionId);
    } catch {
      toast.error(t('ocrRetriggerError'));
    }
  }, [extractionId, ocrRetriggerMutation, t]);

  const uploadFile = useCallback(
    async (file: File) => {
      const fileId = `${file.name}-${Date.now()}`;
      setFiles(prev => [...prev, { id: fileId, file, status: 'uploading', progress: 0 }]);

      try {
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
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed with status ${xhr.status}`));
          };
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.send(file);
        });

        setFiles(prev => prev.map(f => (f.id === fileId ? { ...f, progress: 85 } : f)));

        await confirmUploadMutation.mutateAsync({
          documentId,
        } as Parameters<typeof confirmUploadMutation.mutateAsync>[0]);

        setFiles(prev =>
          prev.map(f => (f.id === fileId ? { ...f, status: 'creating', progress: 90 } : f)),
        );

        await createInvoiceMutation.mutateAsync({
          invoiceNumber: file.name.replace(/\.pdf$/i, ''),
          issueDate: new Date().toISOString().split('T')[0] ?? '',
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0] ?? '',
          currency: 'PLN',
          subtotalMinor: 0,
          totalMinor: 0,
          amountToPayMinor: 0,
          documentIds: [documentId],
        });

        setFiles(prev =>
          prev.map(f => (f.id === fileId ? { ...f, status: 'complete', progress: 100 } : f)),
        );

        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (isPdf && storageKey) {
          await triggerOcrForPdf(file, documentId, storageKey);
        }
      } catch {
        setFiles(prev =>
          prev.map(f => (f.id === fileId ? { ...f, status: 'error', progress: 0 } : f)),
        );
      }
    },
    [requestUploadMutation, confirmUploadMutation, createInvoiceMutation, triggerOcrForPdf],
  );

  const retryFile = useCallback(
    (fileId: string) => {
      const fileEntry = files.find(f => f.id === fileId);
      if (!fileEntry) return;
      setPdfUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setExtractionId(null);
      setShowPdfReview(false);
      setFiles(prev => prev.filter(f => f.id !== fileId));
      void uploadFile(fileEntry.file);
    },
    [files, uploadFile],
  );

  const ingestFiles = useCallback(
    (incoming: File[], t: (key: string, values?: Record<string, unknown>) => string) => {
      const accepted = incoming.filter(file => {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
          toast.error(t('rejectedTypeToast'));
          return false;
        }
        if (file.size > 25 * 1024 * 1024) {
          toast.error(t('rejectedSizeToast'));
          return false;
        }
        return true;
      });

      for (const file of accepted) {
        void uploadFile(file);
      }

      if (accepted.length === 0) return;

      const totalFiles = files.length + accepted.length;
      const checkComplete = () => {
        setFiles(current => {
          const allDone =
            current.length >= totalFiles &&
            current.every(f => f.status === 'complete' || f.status === 'error');
          if (allDone && current.some(f => f.status === 'complete')) {
            const completedCount = current.filter(f => f.status === 'complete').length;
            toast.success(t('complete', { count: completedCount }));
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

      const interval = setInterval(checkComplete, 500);
      setTimeout(() => clearInterval(interval), 60000);
    },
    [
      files.length,
      onUploadComplete,
      queryClient,
      trpc.invoice.list,
      trpc.invoice.statusCounts,
      uploadFile,
    ],
  );

  return {
    files,
    creditExhausted,
    isDragActive,
    setIsDragActive,
    fileInputRef,
    ingestFiles,
    retryFile,
    extractionId,
    pdfUrl,
    showPdfReview,
    setShowPdfReview,
    handleOcrAccept,
    handleOcrDiscard,
    handleOcrRetrigger,
  } as const;
}
