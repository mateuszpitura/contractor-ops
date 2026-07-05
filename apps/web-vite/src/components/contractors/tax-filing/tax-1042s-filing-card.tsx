import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Download, Info, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { AckUploadField } from './ack-upload-field.js';
import { CorrectionDialog } from './correction-dialog.js';
import { defaultFilingTaxYear, useForm1042sBatch } from './hooks/use-1042s-batch.js';
import { useForm1042sFiling } from './hooks/use-1042s-filing.js';
import { IrisStatusPill } from './iris-status-pill.js';

export interface Tax1042SFilingCardProps {
  taxYear?: number;
}

/**
 * Wired 1042-S IRIS filing card. Branches loading / error / empty / loaded on the
 * validation query; reuses the shared 6-status pill + ack-upload field, exposes the
 * ManualDownload action (only when the Pub 1187 XML validates), the
 * acknowledgement upload, and per-recipient CORRECTED filing. A
 * `BUNDLE_UNAVAILABLE` status is a muted pending state (the 1042-S XSD is a human
 * IRS SOR download), never an error. Review-before-file: generating the batch and
 * filing are separate, deliberate actions — there is no auto-file control.
 */
export function Tax1042SFilingCard({ taxYear }: Tax1042SFilingCardProps) {
  const year = taxYear ?? defaultFilingTaxYear();
  const t = useTranslations('Tax1042SFiling');
  const filing = useForm1042sFiling(year);
  const batch = useForm1042sBatch(year);
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
              <p role="alert" aria-live="assertive" className="text-sm text-destructive">
                {t('rejected')}
              </p>
            ) : null}

            {batch.rows.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                <span className="text-sm text-muted-foreground">{t('correction.prompt')}</span>
                {batch.rows.slice(0, 8).map(row => (
                  <Button
                    key={row.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCorrectionForm({ id: row.id, name: row.recipientName })}>
                    {row.recipientName}
                  </Button>
                ))}
              </div>
            ) : null}

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
        namespace="Tax1042SFiling"
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
