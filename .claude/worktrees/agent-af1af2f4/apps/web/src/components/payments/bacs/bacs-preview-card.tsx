'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { Download, Eye, Loader2, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useFlag } from '@/components/layout/feature-flag-context';
import { BacsPreviewPre } from '@/components/payments/bacs/bacs-preview-pre';
import { ModulusCheckWarningList } from '@/components/payments/bacs/modulus-check-warning-list';
import { TransliterationWarningBanner } from '@/components/payments/bacs/transliteration-warning-banner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// BACS File Preview Card
//
// Phase 63 Plan 04 (D-06): renders on PaymentRun detail page ONLY when
// format = BACS_STD18 and PAY_BACS_ENABLED is on.
// ---------------------------------------------------------------------------

interface BacsPreviewCardProps {
  paymentRunId: string;
  exportFormat?: string | null;
}

export function BacsPreviewCard({ paymentRunId, exportFormat }: BacsPreviewCardProps) {
  const t = useTranslations('Payments');
  const bacsEnabled = useFlag('payments.bacs-enabled');

  // Only show for BACS format and when feature is enabled
  if (exportFormat !== 'BACS_STD18' || !bacsEnabled) {
    return null;
  }

  return <BacsPreviewCardInner paymentRunId={paymentRunId} />;
}

function BacsPreviewCardInner({ paymentRunId }: { paymentRunId: string }) {
  const t = useTranslations('Payments');

  // Preview query
  const previewQuery = useQuery(
    trpc.bacs.previewExport.queryOptions({ paymentRunId }),
  );

  // Download mutation
  const downloadMutation = useMutation(
    trpc.bacs.generateExport.mutationOptions({
      onSuccess(data) {
        // Open signed URL in new tab
        window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
        toast.success(t('toastBacsDownloaded'));
      },
      onError(error) {
        if (error.message === 'BACS submitter not configured') {
          toast.error(t('submitterNotConfigured'));
        } else {
          toast.error(t('toastBacsDownloadError'));
        }
      },
    }),
  );

  // Check for unmappable characters (any '?' in transliteration warnings)
  const hasUnmappable = previewQuery.data?.transliterationWarnings.some((w) =>
    w.replaced.some((r) => r.includes('?')),
  );

  // Handle submitter not configured error
  if (previewQuery.error?.message === 'BACS submitter not configured') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-5" />
            {t('bacsPreviewTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">{t('submitterNotConfigured')}</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/payments">{t('configureSubmitter')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="size-5" />
          {t('bacsPreviewTitle')}
        </CardTitle>
        <CardDescription>{t('bacsPreviewDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Loading state */}
        {previewQuery.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-[240px] w-full" />
            <p className="text-center text-sm text-muted-foreground">
              {t('generatingPreview')}
            </p>
          </div>
        )}

        {/* Error state (non-submitter errors) */}
        {previewQuery.isError && previewQuery.error.message !== 'BACS submitter not configured' && (
          <div className="py-4 text-center text-sm text-destructive">
            {t('previewError')}
          </div>
        )}

        {/* Preview content */}
        {previewQuery.data && (
          <>
            {/* Warnings */}
            <TransliterationWarningBanner
              warnings={previewQuery.data.transliterationWarnings}
            />
            <ModulusCheckWarningList warnings={previewQuery.data.modulusWarnings} />

            {/* File preview */}
            <BacsPreviewPre fileText={previewQuery.data.fileText} />

            {/* Download button */}
            <div className="flex justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={() => downloadMutation.mutate({ paymentRunId })}
                      disabled={hasUnmappable || downloadMutation.isPending}
                      className="gap-2"
                    >
                      {downloadMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Download className="size-4" />
                      )}
                      {t('downloadBacsFile')}
                    </Button>
                  </span>
                </TooltipTrigger>
                {hasUnmappable && (
                  <TooltipContent>
                    {t('downloadDisabledUnmappable')}
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
