import type { OcrExtractionResult } from '@contractor-ops/integrations/types/ocr';
import * as Sentry from '@sentry/react';
import { useQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useRouter } from '../../../i18n/navigation.js';
import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { usePortalTRPC, useTRPC } from '../../../providers/trpc-provider.js';
import type { UploadState } from '../invoice-submit-upload.js';

export function usePortalActiveContracts() {
  const portalTrpc = usePortalTRPC();
  return useQuery(portalTrpc.portal.getActiveContracts.queryOptions());
}

export type PortalActiveContractsQuery = ReturnType<typeof usePortalActiveContracts>;
export type PortalInvoiceUploadBundle = ReturnType<typeof usePortalInvoiceFileUploadWithOcr>;
export type PortalInvoiceSubmissionResult = ReturnType<typeof usePortalInvoiceSubmission>;

export function usePortalInvoiceFileUploadWithOcr(t: LooseTranslator) {
  const [upload, setUpload] = useState<UploadState>({ status: 'idle' });
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [ocrPopulated, setOcrPopulated] = useState(false);
  const [creditExhausted, setCreditExhausted] = useState(false);
  const portalTrpc = usePortalTRPC();
  const trpc = useTRPC();

  const getUploadUrl = useResourceMutation(portalTrpc.portal.getUploadUrl.mutationOptions(), {
    successMessage: t('toast.uploadReady'),
  });

  const ocrTriggerMutation = useResourceMutation(trpc.ocr.portalTrigger.mutationOptions(), {
    successMessage: t('toast.scanComplete'),
    suppressErrorToast: error =>
      error instanceof TRPCClientError &&
      error.data?.code === 'PRECONDITION_FAILED' &&
      error.message === 'OCR credits exhausted',
  });

  const ocrQuery = useQuery({
    ...trpc.ocr.portalGetResult.queryOptions({ extractionId: extractionId ?? '' }),
    enabled: !!extractionId,
    refetchInterval: query => {
      const status = (query.state.data as { status?: string } | undefined)?.status;
      return status === 'PROCESSING' || status === 'PENDING' ? 2000 : false;
    },
  });

  const uploadedDocumentId = upload.status === 'uploaded' ? upload.documentId : null;
  const recoveryQuery = useQuery({
    ...trpc.ocr.portalGetByDocument.queryOptions({ documentId: uploadedDocumentId ?? '' }),
    enabled: !!uploadedDocumentId && !extractionId,
  });

  useEffect(() => {
    if (extractionId) return;
    const recovered = recoveryQuery.data as { id?: string } | undefined;
    if (recovered?.id) {
      setExtractionId(recovered.id);
    }
  }, [extractionId, recoveryQuery.data]);

  const extraction = ocrQuery.data as
    | { status: string; resultJson: OcrExtractionResult | null }
    | undefined;
  const extractionStatus = extraction?.status ?? (extractionId ? 'PENDING' : null);
  const resultJson = extraction?.resultJson as OcrExtractionResult | null | undefined;
  const isOcrProcessing = extractionStatus === 'PROCESSING' || extractionStatus === 'PENDING';

  const fieldCount = resultJson
    ? Object.values(resultJson.fields).filter(f => f.value != null).length
    : 0;
  const totalFields = resultJson ? Object.keys(resultJson.fields).length : 0;

  const resetOcrState = useCallback(() => {
    setExtractionId(null);
    setOcrPopulated(false);
    setCreditExhausted(false);
    setPdfBlobUrl(null);
  }, []);

  const removeFile = useCallback(() => {
    setUpload({ status: 'idle' });
    resetOcrState();
  }, [resetOcrState]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUpload({ status: 'uploading', progress: 0 });
      resetOcrState();

      try {
        const { uploadUrl, documentId, storageKey } = await getUploadUrl.mutateAsync({
          filename: file.name,
          contentType: 'application/pdf',
        });

        setUpload({ status: 'uploading', progress: 20 });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', 'application/pdf');
          xhr.upload.onprogress = event => {
            if (event.lengthComputable) {
              setUpload({
                status: 'uploading',
                progress: Math.round(20 + (event.loaded / event.total) * 70),
              });
            }
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`Upload failed with status ${xhr.status}`));
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.send(file);
        });

        setUpload({
          status: 'uploaded',
          documentId,
          storageKey,
          originalFileName: file.name,
          fileSizeBytes: file.size,
        });

        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          try {
            const ocrResult = await ocrTriggerMutation.mutateAsync({ documentId, storageKey });
            setExtractionId(ocrResult.extractionId);
            setPdfBlobUrl(URL.createObjectURL(file));
          } catch (error) {
            if (
              error instanceof TRPCClientError &&
              error.data?.code === 'PRECONDITION_FAILED' &&
              error.message === 'OCR credits exhausted'
            ) {
              setCreditExhausted(true);
            } else {
              Sentry.captureException(error, { tags: { feature: 'portal-invoice-submit' } });
            }
          }
        }
      } catch {
        setUpload({ status: 'error', message: t('errors.uploadFailed') });
        toast.error(t('errors.uploadFailed'));
      }
    },
    [getUploadUrl, ocrTriggerMutation, t, resetOcrState],
  );

  return {
    upload,
    extractionStatus,
    resultJson,
    isOcrProcessing,
    fieldCount,
    totalFields,
    ocrPopulated,
    setOcrPopulated,
    creditExhausted,
    pdfBlobUrl,
    removeFile,
    onDrop,
  } as const;
}

export function usePortalInvoiceSubmission(
  t: LooseTranslator,
  upload: UploadState,
  valuesType: {
    contractId: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    netAmount: string;
    grossAmount: string;
  },
) {
  const router = useRouter();
  const portalTrpc = usePortalTRPC();

  const submitInvoice = useResourceMutation(portalTrpc.portal.submitInvoice.mutationOptions(), {
    successMessage: t('toast.invoiceSubmitted'),
  });

  const onSubmit = useCallback(
    async (values: typeof valuesType) => {
      if (upload.status !== 'uploaded') {
        toast.error(t('errors.uploadFirst'));
        return;
      }

      try {
        const result = await submitInvoice.mutateAsync({
          contractId: values.contractId,
          invoiceNumber: values.invoiceNumber,
          issueDate: new Date(values.issueDate),
          dueDate: new Date(values.dueDate),
          netAmountMinor: Math.round(parseFloat(values.netAmount) * 100),
          grossAmountMinor: Math.round(parseFloat(values.grossAmount) * 100),
          documentId: upload.documentId,
          originalFileName: upload.originalFileName,
          fileSizeBytes: upload.fileSizeBytes,
        });

        router.push(
          `/portal/invoices/submit/success?invoiceId=${result.invoiceId}&invoiceNumber=${encodeURIComponent(result.invoiceNumber)}`,
        );
        // safe-swallow: the error is surfaced to the user via useResourceMutation's toast.
      } catch {
        // toast emitted by useResourceMutation
      }
    },
    [router, submitInvoice, t, upload],
  );

  return { onSubmit, isPending: submitInvoice.isPending } as const;
}
