import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Download, Info, Loader2, Mail } from 'lucide-react';
import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useEdeliveryConsent } from './hooks/use-edelivery-consent.js';
import { StepEdeliveryConsent } from './step-edelivery-consent.js';

export interface Copy1042SDownloadProps {
  taxYear: number;
  /** The recipient's own foreign TIN last-4 (masked display only). A full FTIN never reaches the DOM. */
  ftinLast4?: string | null;
}

/**
 * Portal Form 1042-S recipient copy (Copy B) download, gated on the SAME stored
 * IRS electronic-delivery consent as the 1099-NEC Copy-B. Without consent,
 * the affirmative consent step is shown and the download is NOT offered
 * (paper-copy messaging). With consent, the recipient downloads their own 1042-S;
 * the foreign TIN is shown last-4 only. Withdraw uses an explicit confirm. The
 * recipient is always scoped server-side to `ctx.contractorId` (IDOR guard).
 */
export function Copy1042SDownload({ taxYear, ftinLast4 }: Copy1042SDownloadProps) {
  const t = useTranslations('Tax1042SConsent');
  const consent = useEdeliveryConsent(taxYear);
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);

  const handleDownload = async () => {
    const result = await consent.downloadForm1042S();
    if (result.signedUrl) {
      window.open(result.signedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card className="bg-card">
      <CardHeader className="space-y-1">
        <h2 className="font-display text-lg font-semibold leading-tight">{t('heading')}</h2>
        {ftinLast4 ? (
          <p className="font-mono text-xs text-muted-foreground">
            {t('tinMask', { last4: ftinLast4 })}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-card-gap">
        {consent.isPending ? (
          <div className="space-y-3" aria-busy aria-live="polite">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : consent.error ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {t('loadError')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={consent.refetch}>
              {t('reload')}
            </Button>
          </div>
        ) : consent.consented ? (
          <div className="space-y-card-gap">
            <Button
              type="button"
              onClick={() => void handleDownload()}
              disabled={consent.isDownloading1042S}>
              {consent.isDownloading1042S ? (
                <Loader2 className="me-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="me-2 size-4" aria-hidden />
              )}
              {t('download')}
            </Button>
            {consent.download1042SError ? (
              <p role="alert" className="text-sm text-destructive">
                {t('downloadError')}
              </p>
            ) : null}

            {confirmingWithdraw ? (
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm">{t('withdrawConfirm')}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={consent.isWithdrawing}
                    onClick={async () => {
                      await consent.withdraw();
                      setConfirmingWithdraw(false);
                    }}>
                    {consent.isWithdrawing ? (
                      <Loader2 className="me-2 size-4 animate-spin" aria-hidden />
                    ) : null}
                    {t('withdrawConfirmYes')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingWithdraw(false)}>
                    {t('withdrawConfirmNo')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingWithdraw(true)}>
                {t('withdraw')}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-card-gap">
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{t('noConsent')}</span>
            </p>
            <StepEdeliveryConsent
              onAffirm={consent.recordConsent}
              isSubmitting={consent.isRecording}
              namespace="Tax1042SConsent"
            />
          </div>
        )}

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{t('adviserNote')}</span>
        </p>
      </CardContent>
    </Card>
  );
}
