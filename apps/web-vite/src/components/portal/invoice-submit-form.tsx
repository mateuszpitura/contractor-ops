import type {
  OcrExtractionField,
  OcrExtractionResult,
} from '@contractor-ops/integrations/types/ocr';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useId } from 'react';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useRouter } from '../../i18n/navigation.js';
import type { LooseTranslator } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { formatMoneyAmount } from '../../lib/money.js';
import { ConfidenceBadge } from '../ocr/confidence-badge.js';
import { ExtractionStatusBar } from '../ocr/extraction-status-bar.js';
import { NipValidationBadge } from '../ocr/nip-validation-badge.js';
import { OcrProcessingOverlay } from '../ocr/ocr-processing-overlay.js';
import type {
  PortalActiveContractsQuery,
  PortalInvoiceSubmissionResult,
  PortalInvoiceUploadBundle,
} from './hooks/use-portal-invoice-submit.js';
import {
  usePortalActiveContracts,
  usePortalInvoiceFileUploadWithOcr,
  usePortalInvoiceSubmission,
} from './hooks/use-portal-invoice-submit.js';
import type { UploadState } from './invoice-submit-upload.js';
import { UploadSection } from './invoice-submit-upload.js';

function createInvoiceSubmitSchema(t: LooseTranslator) {
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
  t: LooseTranslator;
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
            value={formatMoneyAmount(
              Math.round(parseFloat(netAmount) * 100),
              selectedContract.currency,
              'en-US',
            )}
          />
        )}
        {!!grossAmount && !!selectedContract && (
          <ReviewRow
            label={t('grossAmount')}
            value={formatMoneyAmount(
              Math.round(parseFloat(grossAmount) * 100),
              selectedContract.currency,
              'en-US',
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

function NipFieldsSection({
  resultJson,
  t,
}: {
  resultJson: OcrExtractionResult;
  t: LooseTranslator;
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

function useOcrPrefill(
  resultJson: OcrExtractionResult | null | undefined,
  ocrPopulated: boolean,
  setOcrPopulated: (v: boolean) => void,
  setValue: (key: string, value: string, opts?: { shouldValidate: boolean }) => void,
  t: LooseTranslator,
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
  t: LooseTranslator;
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
  t: LooseTranslator;
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
          aria-invalid={!!errors.invoiceNumber}
          aria-describedby={errors.invoiceNumber ? `${idPrefix}-invoiceNumber-error` : undefined}
          {...register('invoiceNumber')}
        />
        {!!errors.invoiceNumber && (
          <p id={`${idPrefix}-invoiceNumber-error`} className="text-sm text-destructive">
            {errors.invoiceNumber.message}
          </p>
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
          <Input
            id={`${idPrefix}-issueDate`}
            type="date"
            aria-invalid={!!errors.issueDate}
            aria-describedby={errors.issueDate ? `${idPrefix}-issueDate-error` : undefined}
            {...register('issueDate')}
          />
          {!!errors.issueDate && (
            <p id={`${idPrefix}-issueDate-error`} className="text-sm text-destructive">
              {errors.issueDate.message}
            </p>
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
          <Input
            id={`${idPrefix}-dueDate`}
            type="date"
            aria-invalid={!!errors.dueDate}
            aria-describedby={errors.dueDate ? `${idPrefix}-dueDate-error` : undefined}
            {...register('dueDate')}
          />
          {!!errors.dueDate && (
            <p id={`${idPrefix}-dueDate-error`} className="text-sm text-destructive">
              {errors.dueDate.message}
            </p>
          )}
        </div>
      </div>

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
            aria-invalid={!!errors.netAmount}
            aria-describedby={errors.netAmount ? `${idPrefix}-netAmount-error` : undefined}
            {...register('netAmount')}
          />
          {!!errors.netAmount && (
            <p id={`${idPrefix}-netAmount-error`} className="text-sm text-destructive">
              {errors.netAmount.message}
            </p>
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
            aria-invalid={!!errors.grossAmount}
            aria-describedby={errors.grossAmount ? `${idPrefix}-grossAmount-error` : undefined}
            {...register('grossAmount')}
          />
          {!!errors.grossAmount && (
            <p id={`${idPrefix}-grossAmount-error`} className="text-sm text-destructive">
              {errors.grossAmount.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

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
  t: LooseTranslator;
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

function SubmitInvoiceButton({
  disabled,
  isPending,
  t,
}: {
  disabled: boolean;
  isPending: boolean;
  t: LooseTranslator;
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

function buildContractItems(contracts: ContractOption[] | undefined): ContractItem[] {
  return (contracts ?? []).map(contract => ({
    value: contract.id,
    label: `${contract.title} (${((contract.rateValueMinor ?? 0) / 100).toFixed(0)} ${contract.currency}/${contract.rateType?.toLowerCase()})`,
  }));
}

export function InvoiceSubmitForm({
  uploadBundle,
  contractsQuery,
  submission,
  onNavigateBilling,
  ocrReviewPanel,
}: {
  uploadBundle: PortalInvoiceUploadBundle;
  contractsQuery: PortalActiveContractsQuery;
  submission: PortalInvoiceSubmissionResult;
  onNavigateBilling: () => void;
  ocrReviewPanel?: ReactNode;
}) {
  const id = useId();
  const tAria = useTranslations('Common.aria');
  const t = useTranslations('Portal.submitInvoice');
  const tc = useTranslations('Portal.fileSize');

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
  } = uploadBundle;

  const invoiceSubmitSchema = createInvoiceSubmitSchema(t);

  const { data: contracts, isLoading: contractsLoading } = contractsQuery;

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

  useAutoSelectSingleContract(
    contracts as ContractOption[] | undefined,
    selectedContractId,
    setValue,
  );
  useOcrPrefill(resultJson, ocrPopulated, setOcrPopulated, setValue as never, t);

  const selectedContract = (contracts as ContractOption[] | undefined)?.find(
    c => c.id === selectedContractId,
  );
  const { onSubmit, isPending: isSubmitting } = submission;

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

  const contractItems = buildContractItems(contracts as ContractOption[] | undefined);
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
        onNavigateBilling={onNavigateBilling}
        t={t}
        tc={tc}
        tAria={tAria}
      />

      {ocrReviewPanel ? (
        <>
          <Separator />
          <div className="space-y-4">{ocrReviewPanel}</div>
        </>
      ) : null}

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

export function InvoiceSubmitFormContainer() {
  const t = useTranslations('Portal.submitInvoice');
  const router = useRouter();
  const uploadBundle = usePortalInvoiceFileUploadWithOcr(t);
  const contractsQuery = usePortalActiveContracts();
  const submission = usePortalInvoiceSubmission(t, uploadBundle.upload, {
    contractId: '',
    invoiceNumber: '',
    issueDate: '',
    dueDate: '',
    netAmount: '',
    grossAmount: '',
  });

  const onNavigateBilling = useCallback(() => {
    router.push('/settings?tab=billing');
  }, [router]);

  return (
    <InvoiceSubmitForm
      uploadBundle={uploadBundle}
      contractsQuery={contractsQuery}
      submission={submission}
      onNavigateBilling={onNavigateBilling}
    />
  );
}
