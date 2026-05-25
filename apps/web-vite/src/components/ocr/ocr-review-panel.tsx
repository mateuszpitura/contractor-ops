/**
 * Presentational OCR review panel — props-only. All state, populate-effect,
 * cascade animation and accept handler live in `hooks/use-ocr-review-form`;
 * extraction polling lives in `hooks/use-ocr-review`. Composed by
 * `ocr-review-panel-container.tsx`.
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
import { lazy, Suspense } from 'react';

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
  onDiscard: () => void;
  onRetrigger: () => void;
  extractionStatus: string;
  resultJson: OcrExtractionResult | null | undefined;
  isProcessing: boolean;
  form: {
    state: OcrReviewFormState;
    setters: OcrReviewFormSetters;
    derived: OcrReviewFormDerived;
  };
}

function getFieldConfidence(
  fields: Record<string, { confidence: number }> | undefined,
  key: string,
): number {
  return fields?.[key]?.confidence ?? 0;
}

export function OcrReviewPanel({
  pdfUrl,
  onDiscard,
  onRetrigger,
  extractionStatus,
  resultJson,
  isProcessing,
  form,
}: OcrReviewPanelProps) {
  const t = useTranslations('OcrReview');
  const { state, setters, derived } = form;

  return (
    <div className="flex flex-col gap-4">
      <ExtractionStatusBar
        status={extractionStatus as 'PENDING' | 'PROCESSING' | 'EXTRACTED' | 'PARTIAL' | 'FAILED'}
        fieldCount={derived.fieldCount}
        totalFields={derived.totalFields}
        errorMessage={resultJson?.errorMessage}
        onRetry={onRetrigger}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-8">
        <div className="max-h-[300px] overflow-auto md:max-h-none">
          <Suspense fallback={<Skeleton className="sticky top-20 h-[400px] w-full rounded-lg" />}>
            <PdfViewer url={pdfUrl} className="sticky top-20 min-h-[240px] md:min-h-[400px]" />
          </Suspense>
        </div>

        <Card className="relative bg-background">
          {!!isProcessing && <OcrProcessingOverlay />}

          {!isProcessing && (
            <CardContent className="flex flex-col gap-6 p-6">
              <div>
                <h3 className="mb-4 text-xl font-semibold">{t('heading')}</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <ConfidenceFieldWrapper
                      confidence={getFieldConfidence(resultJson?.fields, 'invoiceNumber')}
                      label={t('fields.invoiceNumber')}>
                      <Input
                        value={state.invoiceNumber}
                        // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                        onChange={e => setters.setInvoiceNumber(e.target.value)}
                        placeholder={t('fields.invoiceNumberPlaceholder')}
                      />
                    </ConfidenceFieldWrapper>
                  </div>
                  <div>
                    <ConfidenceFieldWrapper
                      confidence={getFieldConfidence(resultJson?.fields, 'issueDate')}
                      label={t('fields.issueDate')}>
                      <Input
                        type="date"
                        value={state.issueDate}
                        // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                        onChange={e => setters.setIssueDate(e.target.value)}
                      />
                    </ConfidenceFieldWrapper>
                  </div>
                  <div>
                    <ConfidenceFieldWrapper
                      confidence={getFieldConfidence(resultJson?.fields, 'dueDate')}
                      label={t('fields.dueDate')}>
                      <Input
                        type="date"
                        value={state.dueDate}
                        // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                        onChange={e => setters.setDueDate(e.target.value)}
                      />
                    </ConfidenceFieldWrapper>
                  </div>
                  <div>
                    <ConfidenceFieldWrapper
                      confidence={getFieldConfidence(resultJson?.fields, 'currency')}
                      label={t('fields.currency')}>
                      <Select
                        value={state.currency}
                        // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                        onValueChange={val => {
                          if (val) setters.setCurrency(val);
                        }}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('fields.currencyPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {OCR_CURRENCIES.map(c => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <Input
                        value={state.sellerTaxId}
                        // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                        onChange={e => setters.setSellerTaxId(e.target.value)}
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
                      <Input
                        value={state.buyerTaxId}
                        // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                        onChange={e => setters.setBuyerTaxId(e.target.value)}
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
                    <Input
                      value={state.sellerName}
                      // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                      onChange={e => setters.setSellerName(e.target.value)}
                      placeholder={t('fields.companyNamePlaceholder')}
                    />
                  </ConfidenceFieldWrapper>
                </div>
                <div>
                  <ConfidenceFieldWrapper
                    confidence={getFieldConfidence(resultJson?.fields, 'buyerName')}
                    label={t('fields.buyerName')}>
                    <Input
                      value={state.buyerName}
                      // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                      onChange={e => setters.setBuyerName(e.target.value)}
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
                    <Input
                      type="number"
                      step="0.01"
                      value={state.subtotalMinor}
                      // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                      onChange={e => setters.setSubtotalMinor(e.target.value)}
                      placeholder={t('fields.amountPlaceholder')}
                    />
                  </ConfidenceFieldWrapper>
                </div>
                <div>
                  <ConfidenceFieldWrapper
                    confidence={getFieldConfidence(resultJson?.fields, 'totalTax')}
                    label={t('fields.vatAmount')}>
                    <Input
                      type="number"
                      step="0.01"
                      value={state.vatAmountMinor}
                      // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                      onChange={e => setters.setVatAmountMinor(e.target.value)}
                      placeholder={t('fields.amountPlaceholder')}
                    />
                  </ConfidenceFieldWrapper>
                </div>
                <div>
                  <ConfidenceFieldWrapper
                    confidence={getFieldConfidence(resultJson?.fields, 'totalGross')}
                    label={t('fields.totalGross')}>
                    <Input
                      type="number"
                      step="0.01"
                      value={state.totalMinor}
                      // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                      onChange={e => setters.setTotalMinor(e.target.value)}
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
                  <Input
                    value={state.sellerBankAccount}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                    onChange={e => setters.setSellerBankAccount(e.target.value)}
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
          )}
        </Card>
      </div>
    </div>
  );
}
