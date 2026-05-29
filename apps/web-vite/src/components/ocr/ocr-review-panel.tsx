/**
 * Presentational OCR review panel — props-only. All state, populate-effect,
 * cascade animation and accept handler live in `hooks/use-ocr-review-form`;
 * extraction polling lives in `hooks/use-ocr-review`. Composed by
 * `ocr-review-panel-container.tsx`, which also decides between the form
 * card body and the processing overlay (variant pick).
 */

import type { OcrExtractionResult } from '@contractor-ops/integrations/types/ocr';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { RefreshCw, Trash2 } from 'lucide-react';
import type { ChangeEvent, ReactNode } from 'react';
import { lazy, Suspense, useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { ConfidenceFieldWrapper } from './confidence-field-wrapper.js';
import { ExtractionStatusBar } from './extraction-status-bar.js';
import type {
  ExtractedInvoiceData,
  LineItemFormData,
  OcrReviewFormDerived,
  OcrReviewFormSetters,
  OcrReviewFormState,
} from './hooks/use-ocr-review-form.js';
import { OCR_CURRENCIES } from './hooks/use-ocr-review-form.js';
import { LineItemsTable } from './line-items-table.js';
import { NipValidationBadge } from './nip-validation-badge.js';
import { OcrProcessingOverlay } from './ocr-processing-overlay.js';

const PdfViewer = lazy(() => import('./pdf-viewer.js').then(mod => ({ default: mod.PdfViewer })));

export type { ExtractedInvoiceData, LineItemFormData };

interface OcrReviewPanelProps {
  pdfUrl: string;
  extractionStatus: string;
  resultJson: OcrExtractionResult | null | undefined;
  onRetrigger: () => void;
  fieldCount: number;
  totalFields: number;
  cardBody: ReactNode;
}

function getFieldConfidence(
  fields: Record<string, { confidence: number }> | undefined,
  key: string,
): number {
  return fields?.[key]?.confidence ?? 0;
}

export function OcrReviewPanel({
  pdfUrl,
  extractionStatus,
  resultJson,
  onRetrigger,
  fieldCount,
  totalFields,
  cardBody,
}: OcrReviewPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <ExtractionStatusBar
        status={extractionStatus as 'PENDING' | 'PROCESSING' | 'EXTRACTED' | 'PARTIAL' | 'FAILED'}
        fieldCount={fieldCount}
        totalFields={totalFields}
        errorMessage={resultJson?.errorMessage}
        onRetry={onRetrigger}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-8">
        <div className="max-h-[300px] overflow-auto md:max-h-none">
          <Suspense fallback={<Skeleton className="sticky top-20 h-[400px] w-full rounded-lg" />}>
            <PdfViewer url={pdfUrl} className="sticky top-20 min-h-[240px] md:min-h-[400px]" />
          </Suspense>
        </div>

        <Card className="relative bg-background">{cardBody}</Card>
      </div>
    </div>
  );
}

export function OcrReviewPanelProcessingBody() {
  return <OcrProcessingOverlay />;
}

interface StringInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
}

function StringInput({ value, onValueChange, placeholder, type, step }: StringInputProps) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onValueChange(e.target.value),
    [onValueChange],
  );
  return (
    <Input
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      type={type}
      step={step}
    />
  );
}

interface StringSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: readonly string[];
}

function StringSelect({ value, onValueChange, placeholder, options }: StringSelectProps) {
  const handleValueChange = useCallback(
    (val: string | null) => {
      if (val) onValueChange(val);
    },
    [onValueChange],
  );
  return (
    <Select value={value} onValueChange={handleValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface OcrReviewFormBodyProps {
  onDiscard: () => void;
  onRetrigger: () => void;
  resultJson: OcrExtractionResult | null | undefined;
  form: {
    state: OcrReviewFormState;
    setters: OcrReviewFormSetters;
    derived: OcrReviewFormDerived;
  };
}

export function OcrReviewFormBody({
  onDiscard,
  onRetrigger,
  resultJson,
  form,
}: OcrReviewFormBodyProps) {
  const t = useTranslations('OcrReview');
  const { state, setters, derived } = form;

  return (
    <CardContent className="flex flex-col gap-6 p-6">
      <div>
        <h3 className="mb-4 text-xl font-semibold">{t('heading')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <ConfidenceFieldWrapper
              confidence={getFieldConfidence(resultJson?.fields, 'invoiceNumber')}
              label={t('fields.invoiceNumber')}>
              <StringInput
                value={state.invoiceNumber}
                onValueChange={setters.setInvoiceNumber}
                placeholder={t('fields.invoiceNumberPlaceholder')}
              />
            </ConfidenceFieldWrapper>
          </div>
          <div>
            <ConfidenceFieldWrapper
              confidence={getFieldConfidence(resultJson?.fields, 'issueDate')}
              label={t('fields.issueDate')}>
              <StringInput
                type="date"
                value={state.issueDate}
                onValueChange={setters.setIssueDate}
              />
            </ConfidenceFieldWrapper>
          </div>
          <div>
            <ConfidenceFieldWrapper
              confidence={getFieldConfidence(resultJson?.fields, 'dueDate')}
              label={t('fields.dueDate')}>
              <StringInput type="date" value={state.dueDate} onValueChange={setters.setDueDate} />
            </ConfidenceFieldWrapper>
          </div>
          <div>
            <ConfidenceFieldWrapper
              confidence={getFieldConfidence(resultJson?.fields, 'currency')}
              label={t('fields.currency')}>
              <StringSelect
                value={state.currency}
                onValueChange={setters.setCurrency}
                placeholder={t('fields.currencyPlaceholder')}
                options={OCR_CURRENCIES}
              />
            </ConfidenceFieldWrapper>
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <ConfidenceFieldWrapper
            confidence={getFieldConfidence(resultJson?.fields, 'sellerNip')}
            label={t('fields.sellerNip')}>
            <div className="flex items-center gap-2">
              <StringInput
                value={state.sellerTaxId}
                onValueChange={setters.setSellerTaxId}
                placeholder={t('fields.nipPlaceholder')}
              />
              <NipValidationBadge nip={state.sellerTaxId} />
            </div>
          </ConfidenceFieldWrapper>
        </div>
        <div>
          <ConfidenceFieldWrapper
            confidence={getFieldConfidence(resultJson?.fields, 'buyerNip')}
            label={t('fields.buyerNip')}>
            <div className="flex items-center gap-2">
              <StringInput
                value={state.buyerTaxId}
                onValueChange={setters.setBuyerTaxId}
                placeholder={t('fields.nipPlaceholder')}
              />
              <NipValidationBadge nip={state.buyerTaxId} />
            </div>
          </ConfidenceFieldWrapper>
        </div>
        <div>
          <ConfidenceFieldWrapper
            confidence={getFieldConfidence(resultJson?.fields, 'sellerName')}
            label={t('fields.sellerName')}>
            <StringInput
              value={state.sellerName}
              onValueChange={setters.setSellerName}
              placeholder={t('fields.companyNamePlaceholder')}
            />
          </ConfidenceFieldWrapper>
        </div>
        <div>
          <ConfidenceFieldWrapper
            confidence={getFieldConfidence(resultJson?.fields, 'buyerName')}
            label={t('fields.buyerName')}>
            <StringInput
              value={state.buyerName}
              onValueChange={setters.setBuyerName}
              placeholder={t('fields.companyNamePlaceholder')}
            />
          </ConfidenceFieldWrapper>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <ConfidenceFieldWrapper
            confidence={getFieldConfidence(resultJson?.fields, 'totalNet')}
            label={t('fields.netAmount')}>
            <StringInput
              type="number"
              step="0.01"
              value={state.subtotalMinor}
              onValueChange={setters.setSubtotalMinor}
              placeholder={t('fields.amountPlaceholder')}
            />
          </ConfidenceFieldWrapper>
        </div>
        <div>
          <ConfidenceFieldWrapper
            confidence={getFieldConfidence(resultJson?.fields, 'totalTax')}
            label={t('fields.vatAmount')}>
            <StringInput
              type="number"
              step="0.01"
              value={state.vatAmountMinor}
              onValueChange={setters.setVatAmountMinor}
              placeholder={t('fields.amountPlaceholder')}
            />
          </ConfidenceFieldWrapper>
        </div>
        <div>
          <ConfidenceFieldWrapper
            confidence={getFieldConfidence(resultJson?.fields, 'totalGross')}
            label={t('fields.totalGross')}>
            <StringInput
              type="number"
              step="0.01"
              value={state.totalMinor}
              onValueChange={setters.setTotalMinor}
              placeholder={t('fields.amountPlaceholder')}
            />
          </ConfidenceFieldWrapper>
        </div>
      </div>

      <Separator />

      <div>
        <ConfidenceFieldWrapper
          confidence={getFieldConfidence(resultJson?.fields, 'bankAccount')}
          label={t('fields.sellerBankAccount')}>
          <StringInput
            value={state.sellerBankAccount}
            onValueChange={setters.setSellerBankAccount}
            placeholder={t('fields.bankAccountPlaceholder')}
          />
        </ConfidenceFieldWrapper>
      </div>

      <Separator />

      <LineItemsTable items={state.lineItems} onChange={setters.setLineItems} />

      <Separator />

      <div className="sticky bottom-0 flex flex-col gap-3 border-t bg-background pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger render={<Button type="button" variant="outline" />}>
              {t('discard.cta')}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('discard.title')}</AlertDialogTitle>
                <AlertDialogDescription>{t('discard.description')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('discard.keep')}</AlertDialogCancel>
                <AlertDialogAction onClick={onDiscard}>
                  <Trash2 className="me-1.5 size-4" />
                  {t('discard.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger render={<Button type="button" variant="ghost" />}>
              {t('rerun.cta')}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('rerun.title')}</AlertDialogTitle>
                <AlertDialogDescription>{t('rerun.description')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('rerun.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={onRetrigger}>
                  <RefreshCw className="me-1.5 size-4" />
                  {t('rerun.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <Button type="button" onClick={derived.handleAccept}>
          {t('acceptSave')}
        </Button>
      </div>
    </CardContent>
  );
}
