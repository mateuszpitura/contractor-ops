/**
 * StepReview.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { DialogBody, DialogFooter } from '@contractor-ops/ui/components/shadcn/dialog';
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
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { Loader2 } from 'lucide-react';
import type * as React from 'react';
import { useCallback } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { formatMinorUnits } from '../../../lib/money.js';
import { usePaymentRunStepReview } from '../hooks/use-payment-run-step-review.js';
import { PaymentBlockModal } from '../payment-block-modal.js';

interface StepReviewViewProps {
  selectedInvoiceIds: string[];
  groupByCurrency: boolean;
  onBack: () => void;
  onComplete: (result: {
    runId: string;
    runNumber: string;
    fileBase64: string;
    fileName: string;
    invoiceCount: number;
    totalMinor: number;
    currency: string;
    exportFormat: string;
  }) => void;
  review: ReturnType<typeof usePaymentRunStepReview>;
}

export function StepReviewView({ onBack, review }: StepReviewViewProps) {
  const t = useTranslations('Payments');

  const {
    name,
    setName,
    notes,
    setNotes,
    exportFormat,
    setExportFormat,
    isLocking,
    groupedByCurrency,
    currencies,
    hasPLN,
    hasEUR,
    handleLockAndExport,
  } = review;

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value),
    [setName],
  );
  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value),
    [setNotes],
  );
  const handleExportFormatChange = useCallback(
    (v: string | null) => setExportFormat(v ?? 'CSV'),
    [setExportFormat],
  );

  return (
    <>
      <DialogBody className="flex flex-col gap-4">
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('step2.nameLabel')}</Label>
            <Input
              placeholder={t('step2.namePlaceholder')}
              value={name}
              onChange={handleNameChange}
              maxLength={100}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('step2.descriptionLabel')}</Label>
            <Textarea
              placeholder={t('step2.descriptionPlaceholder')}
              value={notes}
              onChange={handleNotesChange}
              maxLength={500}
              className="h-16 text-sm resize-none"
            />
          </div>
        </div>

        <Separator />

        <div className="flex flex-col">
          {currencies.map(curr => {
            const group = groupedByCurrency[curr];
            if (!group) return null;
            return (
              <div key={curr} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {curr} &mdash; {t('step2.invoices', { count: group.invoices.length })}
                  </span>
                  <span className="text-[20px] font-semibold tabular-nums">
                    {formatMinorUnits(group.totalMinor, null, 'pl-PL')} {curr}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.invoices.slice(0, 10).map(inv => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between py-1 px-2 text-xs">
                      <span className="font-medium">{inv.invoiceNumber}</span>
                      <span className="text-muted-foreground">{inv.contractor?.legalName}</span>
                      <span className="font-mono tabular-nums">
                        {formatMinorUnits(inv.amountToPayMinor, null, 'pl-PL')}
                      </span>
                    </div>
                  ))}
                  {group.invoices.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      +{group.invoices.length - 10} more
                    </p>
                  )}
                </div>
                {currencies.length > 1 && <Separator className="mt-3" />}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t-2 pt-3">
          <span className="text-sm font-medium">{t('step2.grandTotal')}</span>
          <div className="text-end">
            {currencies.map(curr => (
              <p key={curr} className="text-[20px] font-semibold tabular-nums">
                {formatMinorUnits(groupedByCurrency[curr]?.totalMinor ?? 0, null, 'pl-PL')} {curr}
              </p>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label className="text-xs">{t('step2.exportFormatLabel')}</Label>
          <Select value={exportFormat} onValueChange={handleExportFormatChange}>
            <SelectTrigger className="w-full h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CSV">{t('step2.formatCsv')}</SelectItem>
              {hasPLN ? <SelectItem value="BANK_FILE">{t('step2.formatElixir')}</SelectItem> : null}
              {hasEUR ? <SelectItem value="SEPA_XML">{t('step2.formatSepa')}</SelectItem> : null}
            </SelectContent>
          </Select>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button variant="ghost" onClick={onBack} disabled={isLocking}>
          {t('step2.back')}
        </Button>
        <Button onClick={handleLockAndExport} disabled={isLocking}>
          {isLocking ? (
            <>
              <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
              {t('step2.locking')}
            </>
          ) : (
            t('step2.lockAndExport')
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

interface StepReviewProps {
  selectedInvoiceIds: string[];
  groupByCurrency: boolean;
  onBack: () => void;
  onComplete: (result: {
    runId: string;
    runNumber: string;
    fileBase64: string;
    fileName: string;
    invoiceCount: number;
    totalMinor: number;
    currency: string;
    exportFormat: string;
  }) => void;
}

// Decision: mutation host — usePaymentRunStepReview owns create +
// lock-and-export mutations and the isLocking guard. selectedInvoiceIds
// forwarded by NewPaymentRunDialog; no variant flag.
export function StepReview(props: StepReviewProps) {
  const review = usePaymentRunStepReview({
    selectedInvoiceIds: props.selectedInvoiceIds,
    groupByCurrency: props.groupByCurrency,
    onComplete: props.onComplete,
  });
  return (
    <>
      <StepReviewView {...props} review={review} />
      <PaymentBlockModal
        open={review.paymentBlock.open}
        onClose={review.dismissPaymentBlock}
        contractorReasons={review.paymentBlock.reasons}
      />
    </>
  );
}
