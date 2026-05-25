/**
 * BACS Std 18 preview card — ported from
 * apps/web/src/components/payments/bacs/bacs-preview-card.tsx.
 * Swaps:
 *   - next-intl → ../../../i18n/useTranslations
 *   - next/link → Link from ../../../i18n/navigation
 *   - @/trpc/init → useTRPC() from providers/trpc-provider
 */

import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { Download, FileText, Loader2 } from 'lucide-react';

import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useBacsPreview } from '../hooks/use-bacs-preview.js';
import { BacsPreviewPre } from './bacs-preview-pre.js';
import type { ModulusWarning } from './modulus-check-warning-list.js';
import { ModulusCheckWarningList } from './modulus-check-warning-list.js';
import type { TransliterationWarning } from './transliteration-warning-banner.js';
import { TransliterationWarningBanner } from './transliteration-warning-banner.js';

interface BacsPreviewCardProps {
  preview: ReturnType<typeof useBacsPreview>;
  showPii: boolean;
}

export function BacsPreviewCard({ preview, showPii }: BacsPreviewCardProps) {
  const t = useTranslations('Payments.bacs');
  const {
    previewVisible,
    onShowPreview,
    isPreviewFetching,
    previewData,
    previewError,
    submitterNotConfigured,
    onGenerate,
    isGenerating,
  } = preview;

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

  const transliterationWarnings = (previewData?.transliterationWarnings ??
    []) as TransliterationWarning[];
  const modulusWarnings = (previewData?.modulusWarnings ?? []) as ModulusWarning[];
  const hasUnmappable = transliterationWarnings.some(w => w.replaced.length > 0);
  const isPreviewLoading = previewVisible && isPreviewFetching && !previewData;

  return (
    <Card data-testid="bacs-preview-card">
      <CardHeader>
        <CardTitle className="text-xl">{t('previewCardTitle')}</CardTitle>
        <CardDescription>{t('settingsPageSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={onShowPreview}
            disabled={isPreviewFetching && previewVisible}
            data-testid="bacs-preview-button">
            {isPreviewFetching && previewVisible ? (
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
            <Button onClick={onGenerate} disabled={isGenerating} data-testid="bacs-download-button">
              {isGenerating ? (
                <Loader2 aria-hidden="true" className="me-1.5 size-3.5 animate-spin" />
              ) : (
                <Download aria-hidden="true" className="me-1.5 size-3.5" />
              )}
              {t('downloadAction')}
            </Button>
          )}
        </div>

        {previewError ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>{previewError.message}</AlertTitle>
          </Alert>
        ) : null}

        {isPreviewLoading ? (
          <div className="space-y-2" data-testid="bacs-preview-loading">
            <Skeleton className="h-[240px] w-full" />
            <p className="text-xs text-muted-foreground">{t('previewAction')}…</p>
          </div>
        ) : null}

        {previewData ? (
          <div className="space-y-4">
            <TransliterationWarningBanner warnings={transliterationWarnings} />
            <ModulusCheckWarningList warnings={modulusWarnings} />
            {showPii ? <BacsPreviewPre fileText={previewData.fileText} /> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
