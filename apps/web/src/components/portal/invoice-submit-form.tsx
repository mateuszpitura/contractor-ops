'use client';

import type {
  OcrExtractionField,
  OcrExtractionResult,
} from '@contractor-ops/integrations/types/ocr';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Sentry from '@sentry/nextjs';
import { useMutation, useQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { ExternalLink, FileText, Info, Loader2, UploadCloud, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { CreditExhaustedInline } from '@/components/billing/credit-exhausted-inline';
import { ConfidenceBadge } from '@/components/ocr/confidence-badge';
import { ExtractionStatusBar } from '@/components/ocr/extraction-status-bar';
import { NipValidationBadge } from '@/components/ocr/nip-validation-badge';
import { OcrProcessingOverlay } from '@/components/ocr/ocr-processing-overlay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { portalTrpc, trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function createInvoiceSubmitSchema(t: (key: string) => string) {
  return z
    .object({
      contractId: z.string().min(1, t('errors.selectContract')),
      invoiceNumber: z.string().min(1, t('errors.invoiceNumberRequired')).max(100),
      issueDate: z.string().min(1, t('errors.issueDateRequired')),
      dueDate: z.string().min(1, t('errors.dueDateRequired')),
      netAmount: z
        .string()
        .min(1, t('errors.netAmountRequired'))
        .refine(v => !Number.isNaN(Number(v)) && Number(v) > 0, t('errors.mustBePositive')),
      grossAmount: z
        .string()
        .min(1, t('errors.grossAmountRequired'))
        .refine(v => !Number.isNaN(Number(v)) && Number(v) > 0, t('errors.mustBePositive')),
    })
    .refine(
      data => {
        if (data.issueDate && data.dueDate) {
          return new Date(data.dueDate) >= new Date(data.issueDate);
        }
        return true;
      },
      {
        message: t('errors.dueDateAfterIssue'),
        path: ['dueDate'],
      },
    );
}

type InvoiceSubmitValues = z.infer<ReturnType<typeof createInvoiceSubmitSchema>>;

// ---------------------------------------------------------------------------
// Upload state
// ---------------------------------------------------------------------------

type UploadState =
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(
  bytes: number,
  tc: (key: string, values?: Record<string, string | number | Date>) => string,
): string {
  if (bytes < 1024) return tc('bytes', { size: bytes });
  if (bytes < 1024 * 1024) return tc('kilobytes', { size: (bytes / 1024).toFixed(1) });
  return tc('megabytes', { size: (bytes / (1024 * 1024)).toFixed(1) });
}

function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

function getFieldValue(
  fields: Record<string, OcrExtractionField> | undefined,
  key: string,
): string {
  const field = fields?.[key];
  if (!field || field.value == null) return '';
  return String(field.value);
}

function getFieldConfidence(
  fields: Record<string, OcrExtractionField> | undefined,
  key: string,
): number {
  return fields?.[key]?.confidence ?? 0;
}

function getNumericFieldMinor(
  fields: Record<string, OcrExtractionField> | undefined,
  key: string,
): number {
  const field = fields?.[key];
  if (!field || field.value == null) return 0;
  const num = typeof field.value === 'number' ? field.value : parseFloat(field.value);
  return Number.isNaN(num) ? 0 : num;
}

// ---------------------------------------------------------------------------
// Upload section sub-component
// ---------------------------------------------------------------------------

function UploadSection({
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
}: {
  upload: UploadState;
  isDragActive: boolean;
  getRootProps: () => Record<string, unknown>;
  getInputProps: () => Record<string, unknown>;
  pdfBlobUrl: string | null;
  removeFile: () => void;
  creditExhausted: boolean;
  onNavigateBilling: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  tc: (key: string, values?: Record<string, string | number | Date>) => string;
  tAria: (key: string) => string;
}) {
  const openPdfPreview = useCallback(() => {
    if (pdfBlobUrl) window.open(pdfBlobUrl, '_blank');
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
            {!!pdfBlobUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={openPdfPreview}>
                <ExternalLink className="me-1 h-3.5 w-3.5" />
                {t('viewPdf')}
              </Button>
            )}
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

      {upload.status === 'error' && <p className="text-sm text-destructive">{upload.message}</p>}

      {!!creditExhausted && (
        <CreditExhaustedInline onUpgrade={onNavigateBilling} onBuyCredits={onNavigateBilling} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review summary sub-component
// ---------------------------------------------------------------------------

function ReviewRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={`text-sm ${bold ? 'font-medium' : ''}`}>{value}</span>
    </div>
  );
}

function ReviewSummary({
  invoiceNumber,
  selectedContract,
  issueDate,
  dueDate,
  netAmount,
  grossAmount,
  upload,
  t,
}: {
  invoiceNumber: string;
  selectedContract: { title: string; currency: string } | null | undefined;
  issueDate: string;
  dueDate: string;
  netAmount: string;
  grossAmount: string;
  upload: UploadState;
  t: (key: string) => string;
}) {
  if (!(invoiceNumber || selectedContract) && upload.status !== 'uploaded') return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('review')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!!selectedContract && <ReviewRow label={t('contract')} value={selectedContract.title} />}
        {!!invoiceNumber && <ReviewRow label={t('invoiceNumber')} value={invoiceNumber} />}
        {!!issueDate && <ReviewRow label={t('issueDate')} value={issueDate} />}
        {!!dueDate && <ReviewRow label={t('dueDate')} value={dueDate} />}
        {!!netAmount && !!selectedContract && (
          <ReviewRow
            label={t('netAmount')}
            value={formatAmount(Math.round(parseFloat(netAmount) * 100), selectedContract.currency)}
          />
        )}
        {!!grossAmount && !!selectedContract && (
          <ReviewRow
            label={t('grossAmount')}
            value={formatAmount(
              Math.round(parseFloat(grossAmount) * 100),
              selectedContract.currency,
            )}
            bold
          />
        )}
        {upload.status === 'uploaded' && (
          <ReviewRow label={t('uploadedFile')} value={upload.originalFileName} />
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// OCR-aware label (renders confidence badge when OCR data exists)
// ---------------------------------------------------------------------------

function OcrLabel({
  htmlFor,
  label,
  ocrPopulated,
  fields,
  fieldKey,
}: {
  htmlFor?: string;
  label: string;
  ocrPopulated: boolean;
  fields: Record<string, OcrExtractionField> | undefined;
  fieldKey: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor} className="text-[13px]">
        {label}
      </Label>
      {!!ocrPopulated && !!fields?.[fieldKey] && (
        <ConfidenceBadge confidence={getFieldConfidence(fields, fieldKey)} showPercentage={false} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NIP fields sub-component (OCR-extracted seller/buyer NIP)
// ---------------------------------------------------------------------------

function NipFieldsSection({
  resultJson,
  t,
}: {
  resultJson: OcrExtractionResult;
  t: (key: string) => string;
}) {
  if (!resultJson.fields?.sellerNip) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-[13px]">{t('sellerNip')}</Label>
          <ConfidenceBadge
            confidence={getFieldConfidence(resultJson.fields, 'sellerNip')}
            showPercentage={false}
          />
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={getFieldValue(resultJson.fields, 'sellerNip')}
            readOnly
            className="bg-muted/50"
          />
          <NipValidationBadge nip={getFieldValue(resultJson.fields, 'sellerNip')} />
        </div>
      </div>
      {!!resultJson.fields.buyerNip && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-[13px]">{t('buyerNip')}</Label>
            <ConfidenceBadge
              confidence={getFieldConfidence(resultJson.fields, 'buyerNip')}
              showPercentage={false}
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={getFieldValue(resultJson.fields, 'buyerNip')}
              readOnly
              className="bg-muted/50"
            />
            <NipValidationBadge nip={getFieldValue(resultJson.fields, 'buyerNip')} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload + OCR hook (reduces main component complexity)
// ---------------------------------------------------------------------------

function useFileUploadWithOcr(t: (key: string) => string) {
  const [upload, setUpload] = useState<UploadState>({ status: 'idle' });
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [ocrPopulated, setOcrPopulated] = useState(false);
  const [creditExhausted, setCreditExhausted] = useState(false);

  const getUploadUrl = useMutation(portalTrpc.portal.getUploadUrl.mutationOptions());
  const ocrTriggerMutation = useMutation(trpc.ocr.portalTrigger.mutationOptions({}));

  const ocrQuery = useQuery({
    ...trpc.ocr.portalGetResult.queryOptions({ extractionId: extractionId ?? '' }),
    enabled: !!extractionId,
    refetchInterval: query => {
      const status = query.state.data?.status;
      return status === 'PROCESSING' || status === 'PENDING' ? 2000 : false;
    },
  });

  const extraction = ocrQuery.data;
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
  };
}

// ---------------------------------------------------------------------------
// OCR pre-fill hook
// ---------------------------------------------------------------------------

function useOcrPrefill(
  resultJson: OcrExtractionResult | null | undefined,
  ocrPopulated: boolean,
  setOcrPopulated: (v: boolean) => void,
  setValue: (key: string, value: string, opts?: { shouldValidate: boolean }) => void,
  t: (key: string) => string,
) {
  useEffect(() => {
    if (!resultJson || ocrPopulated) return;
    if (resultJson.status !== 'EXTRACTED' && resultJson.status !== 'PARTIAL') return;

    const fields = resultJson.fields;
    const prefillField = (formKey: string, ocrKey: string) => {
      const val = getFieldValue(fields, ocrKey);
      if (val) setValue(formKey, val, { shouldValidate: true });
    };

    prefillField('invoiceNumber', 'invoiceNumber');
    prefillField('issueDate', 'issueDate');
    prefillField('dueDate', 'dueDate');

    const netMinor = getNumericFieldMinor(fields, 'totalNet');
    if (netMinor > 0) setValue('netAmount', (netMinor / 100).toFixed(2), { shouldValidate: true });

    const grossMinor = getNumericFieldMinor(fields, 'totalGross');
    if (grossMinor > 0)
      setValue('grossAmount', (grossMinor / 100).toFixed(2), { shouldValidate: true });

    setOcrPopulated(true);
    toast.success(t('ocrExtracted'));
  }, [resultJson, ocrPopulated, setValue, t, setOcrPopulated]);

  useEffect(() => {
    if (resultJson?.status === 'FAILED') {
      toast.error(t('ocrFailed'));
    }
  }, [resultJson?.status, t]);
}

// ---------------------------------------------------------------------------
// Contract auto-selection hook
// ---------------------------------------------------------------------------

type ContractOption = {
  id: string;
  title: string;
  rateValueMinor: number | null;
  currency: string;
  rateType: string | null;
  billingModel: string | null;
};

function useAutoSelectSingleContract(
  contracts: ContractOption[] | undefined,
  selectedContractId: string,
  setValue: (key: 'contractId', value: string, opts?: { shouldValidate: boolean }) => void,
) {
  useEffect(() => {
    if (!contracts || contracts.length !== 1 || selectedContractId) return;
    const onlyContract = contracts[0];
    if (onlyContract) {
      setValue('contractId', onlyContract.id, { shouldValidate: true });
    }
  }, [contracts, selectedContractId, setValue]);
}

// ---------------------------------------------------------------------------
// Invoice submission hook (tRPC mutation + success/error handling)
// ---------------------------------------------------------------------------

function useInvoiceSubmission(t: (key: string) => string, upload: UploadState) {
  const router = useRouter();
  const submitInvoice = useMutation(portalTrpc.portal.submitInvoice.mutationOptions());

  const onSubmit = useCallback(
    async (values: InvoiceSubmitValues) => {
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
          // F-SEC-01: `storageKey` is intentionally not sent. The server
          // recovers the trusted storage path from the consumed `PendingUpload`
          // row keyed by `documentId`; trusting a client-supplied path here
          // would re-open the cross-tenant IDOR closed by F-SEC-01.
          originalFileName: upload.originalFileName,
          fileSizeBytes: upload.fileSizeBytes,
        });

        router.push(
          `/portal/invoices/submit/success?invoiceId=${result.invoiceId}&invoiceNumber=${encodeURIComponent(result.invoiceNumber)}`,
        );
      } catch {
        toast.error(t('errors.submitFailed'));
      }
    },
    [router, submitInvoice, t, upload],
  );

  return { onSubmit, isPending: submitInvoice.isPending };
}

// ---------------------------------------------------------------------------
// Contract selection sub-component
// ---------------------------------------------------------------------------

type ContractItem = { value: string; label: string };

function ContractSelectionSection({
  contractsLoading,
  contractItems,
  selectedContractId,
  selectedContract,
  onContractChange,
  errorMessage,
  t,
}: {
  contractsLoading: boolean;
  contractItems: ContractItem[];
  selectedContractId: string;
  selectedContract: ContractOption | null | undefined;
  onContractChange: (val: string | null) => void;
  errorMessage: string | undefined;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">{t('contract')}</h2>
      <div className="space-y-2">
        <Label htmlFor="contractId" className="text-[13px]">
          {t('selectContract')}
        </Label>
        {contractsLoading ? (
          <div className="h-8 animate-pulse rounded-lg bg-muted" />
        ) : (
          <Select value={selectedContractId} onValueChange={onContractChange} items={contractItems}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('contractPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {contractItems.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!!errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        {!!selectedContract && (
          <p className="text-[13px] text-muted-foreground">
            {t('expectedAmount', {
              amount: ((selectedContract.rateValueMinor ?? 0) / 100).toFixed(0),
              currency: selectedContract.currency,
              model: selectedContract.billingModel?.toLowerCase() ?? '',
            })}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invoice metadata fields sub-component
// ---------------------------------------------------------------------------

type InvoiceFieldErrors = {
  invoiceNumber?: { message?: string };
  issueDate?: { message?: string };
  dueDate?: { message?: string };
  netAmount?: { message?: string };
  grossAmount?: { message?: string };
};

function InvoiceMetadataSection({
  idPrefix,
  register,
  errors,
  ocrPopulated,
  resultJson,
  isOcrProcessing,
  selectedContract,
  t,
}: {
  idPrefix: string;
  register: ReturnType<typeof useForm<InvoiceSubmitValues>>['register'];
  errors: InvoiceFieldErrors;
  ocrPopulated: boolean;
  resultJson: OcrExtractionResult | null | undefined;
  isOcrProcessing: boolean;
  selectedContract: ContractOption | null | undefined;
  t: (key: string) => string;
}) {
  const fields = resultJson?.fields;
  const netLabel = `${t('netAmount')}${selectedContract ? ` (${selectedContract.currency})` : ''}`;
  const grossLabel = `${t('grossAmount')}${selectedContract ? ` (${selectedContract.currency})` : ''}`;

  return (
    <div className="relative space-y-4">
      {!!isOcrProcessing && <OcrProcessingOverlay />}

      <h2 className="text-sm font-semibold">{t('details')}</h2>

      <div className="space-y-2">
        <OcrLabel
          htmlFor={`${idPrefix}-invoiceNumber`}
          label={t('invoiceNumber')}
          ocrPopulated={ocrPopulated}
          fields={fields}
          fieldKey="invoiceNumber"
        />
        <Input
          id={`${idPrefix}-invoiceNumber`}
          type="text"
          placeholder={t('invoicePlaceholder')}
          {...register('invoiceNumber')}
        />
        {!!errors.invoiceNumber && (
          <p className="text-sm text-destructive">{errors.invoiceNumber.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <OcrLabel
            htmlFor={`${idPrefix}-issueDate`}
            label={t('issueDate')}
            ocrPopulated={ocrPopulated}
            fields={fields}
            fieldKey="issueDate"
          />
          <Input id={`${idPrefix}-issueDate`} type="date" {...register('issueDate')} />
          {!!errors.issueDate && (
            <p className="text-sm text-destructive">{errors.issueDate.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <OcrLabel
            htmlFor={`${idPrefix}-dueDate`}
            label={t('dueDate')}
            ocrPopulated={ocrPopulated}
            fields={fields}
            fieldKey="dueDate"
          />
          <Input id={`${idPrefix}-dueDate`} type="date" {...register('dueDate')} />
          {!!errors.dueDate && <p className="text-sm text-destructive">{errors.dueDate.message}</p>}
        </div>
      </div>

      {/* NIP fields shown when extraction provides them */}
      {!!ocrPopulated && !!resultJson && <NipFieldsSection resultJson={resultJson} t={t} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <OcrLabel
            htmlFor={`${idPrefix}-netAmount`}
            label={netLabel}
            ocrPopulated={ocrPopulated}
            fields={fields}
            fieldKey="totalNet"
          />
          <Input
            id={`${idPrefix}-netAmount`}
            type="number"
            step="0.01"
            min="0.01"
            placeholder={t('amountPlaceholder')}
            {...register('netAmount')}
          />
          {!!errors.netAmount && (
            <p className="text-sm text-destructive">{errors.netAmount.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <OcrLabel
            htmlFor={`${idPrefix}-grossAmount`}
            label={grossLabel}
            ocrPopulated={ocrPopulated}
            fields={fields}
            fieldKey="totalGross"
          />
          <Input
            id={`${idPrefix}-grossAmount`}
            type="number"
            step="0.01"
            min="0.01"
            placeholder={t('amountPlaceholder')}
            {...register('grossAmount')}
          />
          {!!errors.grossAmount && (
            <p className="text-sm text-destructive">{errors.grossAmount.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OCR status banner (extraction status bar + pre-fill notice)
// ---------------------------------------------------------------------------

function OcrStatusBanner({
  extractionStatus,
  fieldCount,
  totalFields,
  resultJson,
  ocrPopulated,
  t,
}: {
  extractionStatus: string | null;
  fieldCount: number;
  totalFields: number;
  resultJson: OcrExtractionResult | null | undefined;
  ocrPopulated: boolean;
  t: (key: string) => string;
}) {
  const showStatusBar = !!extractionStatus && extractionStatus !== 'PENDING';

  return (
    <>
      {!!showStatusBar && (
        <ExtractionStatusBar
          status={extractionStatus as 'PROCESSING' | 'EXTRACTED' | 'PARTIAL' | 'FAILED'}
          fieldCount={fieldCount}
          totalFields={totalFields}
          errorMessage={resultJson?.errorMessage}
        />
      )}
      {!!ocrPopulated && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-200">{t('ocrPrefillBanner')}</p>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Submit button sub-component
// ---------------------------------------------------------------------------

function SubmitInvoiceButton({
  disabled,
  isPending,
  t,
}: {
  disabled: boolean;
  isPending: boolean;
  t: (key: string) => string;
}) {
  return (
    <Button type="submit" className="w-full md:w-auto" disabled={disabled}>
      {isPending ? (
        <>
          <Loader2 className="me-2 h-4 w-4 animate-spin" />
          {t('submitting')}
        </>
      ) : (
        t('submit')
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function buildContractItems(contracts: ContractOption[] | undefined): ContractItem[] {
  return (contracts ?? []).map(contract => ({
    value: contract.id,
    label: `${contract.title} (${((contract.rateValueMinor ?? 0) / 100).toFixed(0)} ${contract.currency}/${contract.rateType?.toLowerCase()})`,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceSubmitForm() {
  const id = useId();
  const tAria = useTranslations('Common.aria');
  const t = useTranslations('Portal.submitInvoice');
  const tc = useTranslations('Portal.fileSize');
  const router = useRouter();

  const {
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
  } = useFileUploadWithOcr(t);

  const invoiceSubmitSchema = createInvoiceSubmitSchema(t);

  // Fetch active contracts
  const { data: contracts, isLoading: contractsLoading } = useQuery(
    portalTrpc.portal.getActiveContracts.queryOptions(),
  );

  // Form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<InvoiceSubmitValues>({
    resolver: zodResolver(invoiceSubmitSchema),
    defaultValues: {
      contractId: '',
      invoiceNumber: '',
      issueDate: '',
      dueDate: '',
      netAmount: '',
      grossAmount: '',
    },
    mode: 'onBlur',
  });

  const selectedContractId = watch('contractId');
  const invoiceNumber = watch('invoiceNumber');
  const issueDate = watch('issueDate');
  const dueDate = watch('dueDate');
  const netAmount = watch('netAmount');
  const grossAmount = watch('grossAmount');

  useAutoSelectSingleContract(contracts, selectedContractId, setValue);
  useOcrPrefill(resultJson, ocrPopulated, setOcrPopulated, setValue as never, t);

  const selectedContract = contracts?.find(c => c.id === selectedContractId);
  const { onSubmit, isPending: isSubmitting } = useInvoiceSubmission(t, upload);

  const navigateToBilling = useCallback(() => {
    router.push('/settings?tab=billing');
  }, [router]);

  const handleContractChange = useCallback(
    (val: string | null) => {
      setValue('contractId', val ?? '', { shouldValidate: true });
    },
    [setValue],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    multiple: false,
    disabled: upload.status === 'uploading',
  });

  const contractItems = buildContractItems(contracts);
  const canSubmit = isValid && upload.status === 'uploaded' && !isSubmitting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <ContractSelectionSection
        contractsLoading={contractsLoading}
        contractItems={contractItems}
        selectedContractId={selectedContractId}
        selectedContract={selectedContract}
        onContractChange={handleContractChange}
        errorMessage={errors.contractId?.message}
        t={t}
      />

      <Separator />

      <UploadSection
        upload={upload}
        isDragActive={isDragActive}
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        pdfBlobUrl={pdfBlobUrl}
        removeFile={removeFile}
        creditExhausted={creditExhausted}
        onNavigateBilling={navigateToBilling}
        t={t}
        tc={tc}
        tAria={tAria}
      />

      <Separator />

      <OcrStatusBanner
        extractionStatus={extractionStatus}
        fieldCount={fieldCount}
        totalFields={totalFields}
        resultJson={resultJson}
        ocrPopulated={ocrPopulated}
        t={t}
      />

      <InvoiceMetadataSection
        idPrefix={id}
        register={register}
        errors={errors}
        ocrPopulated={ocrPopulated}
        resultJson={resultJson}
        isOcrProcessing={isOcrProcessing}
        selectedContract={selectedContract}
        t={t}
      />

      <Separator />

      <ReviewSummary
        invoiceNumber={invoiceNumber}
        selectedContract={selectedContract}
        issueDate={issueDate}
        dueDate={dueDate}
        netAmount={netAmount}
        grossAmount={grossAmount}
        upload={upload}
        t={t}
      />

      <SubmitInvoiceButton disabled={!canSubmit} isPending={isSubmitting} t={t} />
    </form>
  );
}
