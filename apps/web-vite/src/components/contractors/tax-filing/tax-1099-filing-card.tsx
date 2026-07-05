import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Download, Info, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { AckUploadField } from './ack-upload-field.js';
import { CorrectionDialog } from './correction-dialog.js';
import { useTax1099Batch } from './hooks/use-1099-batch.js';
import { useIrisFiling } from './hooks/use-iris-filing.js';
import { IrisStatusPill } from './iris-status-pill.js';
import { StateFilingOutputSection } from './state-filing-output.js';

export interface Tax1099FilingCardProps {
  taxYear: number;
}

/**
 * Wired IRIS filing card. Branches loading / error / empty / loaded on the
 * validation query; shows the 6-status pill, the ManualDownload action (only
 * when the XML validates), the acknowledgement upload, per-recipient CORRECTED
 * filing, and the per-state output. A `BUNDLE_UNAVAILABLE` status is a muted
 * pending state (validity unproven pre-enablement), never an error.
 */
export function Tax1099FilingCard({ taxYear }: Tax1099FilingCardProps) {
  const t = useTranslations('Tax1099Filing');
  const filing = useIrisFiling(taxYear);
  const batch = useTax1099Batch(taxYear);
  const [correctionForm, setCorrectionForm] = useState<{ id: string; name: string } | null>(null);

  const status = filing.validation?.status ?? null;
  const isRejected = status === 'REJECTED' || status === 'INVALID';
  const isValidationBlocked = status === 'INVALID';

  return (
    <Card className="bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <h3 className="font-display text-lg font-semibold leading-tight">{t('heading')}</h3>
        {status ? <IrisStatusPill status={status} /> : null}
      </CardHeader>
      <CardContent>
        {filing.isPending ? (
          <div className="space-y-3" aria-busy aria-live="polite">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : filing.error ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {t('loadError')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={filing.refetch}>
              {t('reload')}
            </Button>
          </div>
        ) : !filing.validation || filing.validation.recipientCount === 0 ? (
          <div className="space-y-2 py-12 text-center">
            <p className="font-display text-sm font-semibold">{t('empty.heading')}</p>
            <p className="text-sm text-muted-foreground">{t('empty.body')}</p>
          </div>
        ) : (
          <div className="space-y-card-gap">
            {status === 'BUNDLE_UNAVAILABLE' ? (
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{t('bundleUnavailable')}</span>
              </p>
            ) : null}

            {isValidationBlocked ? (
              <div className="space-y-2 rounded-md bg-destructive/10 p-3">
                <p role="alert" className="text-sm text-destructive">
                  {t('validationFailed')}
                </p>
                <ul className="list-disc space-y-1 ps-5 text-xs text-destructive">
                  {filing.validation.errors.slice(0, 20).map(err => (
                    <li key={`${err.code}:${err.message}`}>{err.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void filing.download()}
                disabled={!filing.ready || filing.isDownloading}>
                {filing.isDownloading ? (
                  <Loader2 className="me-2 size-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="me-2 size-4" aria-hidden />
                )}
                {t('download')}
              </Button>
            </div>

            <AckUploadField onUpload={filing.uploadAck} isUploading={filing.isUploadingAck} />
            {filing.ackError ? (
              <p role="alert" className="text-sm text-destructive">
                {t('ackParseFailed')}
              </p>
            ) : null}
            {isRejected && !isValidationBlocked ? (
              <p role="alert" className="text-sm text-destructive">
                {t('rejected')}
              </p>
            ) : null}

            {batch.forms.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                <span className="text-sm text-muted-foreground">{t('correction.prompt')}</span>
                {batch.forms.slice(0, 8).map(form => (
                  <Button
                    key={form.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setCorrectionForm({ id: form.id, name: form.recipient.legalName })
                    }>
                    {form.recipient.legalName}
                  </Button>
                ))}
              </div>
            ) : null}

            <StateFilingOutputSection
              taxYear={taxYear}
              selectedState={filing.selectedState}
              onSelectState={filing.selectState}
              output={filing.stateOutput}
              isPending={filing.isStatePending}
              error={filing.stateError}
            />

            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{t('adviserNote')}</span>
            </p>
          </div>
        )}
      </CardContent>

      <CorrectionDialog
        open={correctionForm !== null}
        onOpenChange={open => {
          if (!open) setCorrectionForm(null);
        }}
        recipientName={correctionForm?.name ?? ''}
        isSubmitting={filing.isCorrecting}
        onConfirm={async reason => {
          if (!correctionForm) return;
          await filing.fileCorrection(correctionForm.id, reason);
          setCorrectionForm(null);
          batch.refetch();
        }}
      />
    </Card>
  );
}
