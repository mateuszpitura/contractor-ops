// apps/web/src/components/payments/bacs/bacs-preview-card.tsx
//
// Phase 63 · Plan 04 · D-06 — BACS Std 18 preview Card on PaymentRun detail.
//
// Renders ONLY when:
//   - the run's auto-detected format is BACS_STD18 (caller decides)
//   - PAY_BACS_ENABLED feature flag is on (host page checks)
//
// Shows two CTAs:
//   - "Preview BACS file" -> trpc.bacs.previewExport (query)
//   - "Download BACS file" -> trpc.bacs.generateExport (mutation, signed URL)
//
// Download is disabled when ANY transliteration `?` warnings exist (per
// threat model): the file would be rejected by BACS, so we block client-side
// in addition to the server-side guard inside the router.

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { Download, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { trpc } from '@/trpc/init';

import { BacsPreviewPre } from './bacs-preview-pre';
import type { ModulusWarning } from './modulus-check-warning-list';
import { ModulusCheckWarningList } from './modulus-check-warning-list';
import type { TransliterationWarning } from './transliteration-warning-banner';
import { TransliterationWarningBanner } from './transliteration-warning-banner';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BacsPreviewCardProps {
  paymentRunId: string;
}

export function BacsPreviewCard({ paymentRunId }: BacsPreviewCardProps) {
  const t = useTranslations('Payments.bacs');
  const [previewVisible, setPreviewVisible] = useState(false);

  const previewQuery = useQuery({
    ...trpc.bacs.previewExport.queryOptions({ paymentRunId }),
    enabled: previewVisible,
    retry: false,
  });
  const queryClient = useQueryClient();

  const generateMutation = useMutation(
    trpc.bacs.generateExport.mutationOptions({
      onSuccess: data => {
        // Open the signed URL in a new tab; the browser handles the download
        // via the `Content-Disposition: attachment` header set in R2.
        if (typeof window !== 'undefined') {
          window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
        }
        toast.success(`${t('downloadAction')} — ${data.filename}`);
        queryClient.invalidateQueries(trpc.bacs.pathFilter());
      },
      onError: err => {
        // Surface the server-side error message — common cases are
        // "BACS submitter not configured" and unmappable-character refusal.
        toast.error(err?.message || t('generateFailure'));
      },
    }),
  );

  // ---------------------------------------------------------------------------
  // Submitter-not-configured branch
  // ---------------------------------------------------------------------------
  // tRPC surfaces server PRECONDITION_FAILED as TRPCClientError with the
  // typed `code` field. We deep-link the user to /settings/payments/.
  const previewError = previewQuery.error;
  const submitterNotConfigured =
    previewError instanceof TRPCClientError &&
    previewError.data?.code === 'PRECONDITION_FAILED' &&
    typeof previewError.message === 'string' &&
    /not configured/i.test(previewError.message);

  if (submitterNotConfigured) {
    return (
      <Card data-testid="bacs-preview-card-unconfigured">
        <CardHeader>
          <CardTitle className="text-xl">{t('previewCardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="border-amber-300/50 bg-amber-500/5">
            <AlertTitle className="text-amber-700 dark:text-amber-400">
              {t('submitterNotConfigured')}
            </AlertTitle>
            <AlertDescription className="mt-2">
              <Link
                href="/settings/payments"
                className="text-primary underline underline-offset-4 hover:no-underline">
                {t('settingsPageTitle')} →
              </Link>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const data = previewQuery.data;
  const transliterationWarnings = (data?.transliterationWarnings ?? []) as TransliterationWarning[];
  const modulusWarnings = (data?.modulusWarnings ?? []) as ModulusWarning[];
  // `transliterateToBacs` records the ORIGINAL unmappable Unicode character in
  // `replaced` (never the literal '?'). Any entry signals an unmappable
  // substitution occurred; the file would be rejected by BACS.
  const hasUnmappable = transliterationWarnings.some(w => w.replaced.length > 0);

  return (
    <Card data-testid="bacs-preview-card">
      <CardHeader>
        <CardTitle className="text-xl">{t('previewCardTitle')}</CardTitle>
        <CardDescription>{t('settingsPageSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setPreviewVisible(true)}
            disabled={previewQuery.isFetching && previewVisible}
            data-testid="bacs-preview-button">
            {previewQuery.isFetching && previewVisible ? (
              <Loader2 aria-hidden="true" className="me-1.5 size-3.5 animate-spin" />
            ) : (
              <FileText aria-hidden="true" className="me-1.5 size-3.5" />
            )}
            {t('previewAction')}
          </Button>

          {hasUnmappable ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-block" data-testid="bacs-download-button-disabled">
                    <Button disabled aria-disabled="true">
                      <Download aria-hidden="true" className="me-1.5 size-3.5" />
                      {t('downloadAction')}
                    </Button>
                  </span>
                }
              />
              <TooltipContent>
                {t('unmappableError', { count: transliterationWarnings.length })}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              onClick={() => generateMutation.mutate({ paymentRunId })}
              disabled={generateMutation.isPending}
              data-testid="bacs-download-button">
              {generateMutation.isPending ? (
                <Loader2 aria-hidden="true" className="me-1.5 size-3.5 animate-spin" />
              ) : (
                <Download aria-hidden="true" className="me-1.5 size-3.5" />
              )}
              {t('downloadAction')}
            </Button>
          )}
        </div>

        {/* Generic error (other than submitter-not-configured) */}
        {previewQuery.error && !submitterNotConfigured && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>{previewQuery.error.message}</AlertTitle>
          </Alert>
        )}

        {/* Loading state */}
        {previewVisible && previewQuery.isFetching && !data && (
          <div className="space-y-2" data-testid="bacs-preview-loading">
            <Skeleton className="h-[240px] w-full" />
            <p className="text-xs text-muted-foreground">{t('previewAction')}…</p>
          </div>
        )}

        {/* Warning banners + preview block */}
        {data && (
          <div className="space-y-4">
            <TransliterationWarningBanner warnings={transliterationWarnings} />
            <ModulusCheckWarningList warnings={modulusWarnings} />
            <BacsPreviewPre fileText={data.fileText} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
