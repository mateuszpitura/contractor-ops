/**
 * BACS Std 18 preview card — presentational.
 *
 * The container picks the "unconfigured" sibling when the BACS submitter
 * is missing; this view assumes a configured submitter and renders the
 * action bar + conditional content slots (error, loading skeleton, preview
 * payload). Slot content is computed from the hook return.
 */

import { Alert, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
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

import { usePermissions } from '../../../hooks/use-permissions.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { canViewSensitivePii } from '../../../lib/mask-pii.js';
import { useBacsPreview } from '../hooks/use-bacs-preview.js';
import { BacsPreviewCardUnconfigured } from './bacs-preview-card-unconfigured.js';
import { BacsPreviewPre } from './bacs-preview-pre.js';
import type { ModulusWarning } from './modulus-check-warning-list.js';
import { ModulusCheckWarningList } from './modulus-check-warning-list.js';
import type { TransliterationWarning } from './transliteration-warning-banner.js';
import { TransliterationWarningBanner } from './transliteration-warning-banner.js';

export interface BacsPreviewData {
  fileText: string;
  transliterationWarnings?: unknown[];
  modulusWarnings?: unknown[];
}

interface BacsPreviewCardViewProps {
  showPii: boolean;
  previewVisible: boolean;
  isPreviewFetching: boolean;
  isPreviewLoading: boolean;
  previewData: BacsPreviewData | undefined;
  previewError: { message: string } | null;
  transliterationWarnings: TransliterationWarning[];
  modulusWarnings: ModulusWarning[];
  hasUnmappable: boolean;
  onShowPreview: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function BacsPreviewCardView({
  showPii,
  previewVisible,
  isPreviewFetching,
  isPreviewLoading,
  previewData,
  previewError,
  transliterationWarnings,
  modulusWarnings,
  hasUnmappable,
  onShowPreview,
  onGenerate,
  isGenerating,
}: BacsPreviewCardViewProps) {
  const t = useTranslations('Payments.bacs');

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

function toTransliterationWarnings(value: unknown): TransliterationWarning[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (w): w is TransliterationWarning =>
      typeof w === 'object' &&
      w !== null &&
      typeof (w as TransliterationWarning).contractorName === 'string' &&
      Array.isArray((w as TransliterationWarning).replaced),
  );
}

function toModulusWarnings(value: unknown): ModulusWarning[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (w): w is ModulusWarning =>
      typeof w === 'object' &&
      w !== null &&
      typeof (w as ModulusWarning).contractorName === 'string' &&
      typeof (w as ModulusWarning).sortCode === 'string' &&
      Array.isArray((w as ModulusWarning).warnings),
  );
}

interface BacsPreviewCardProps {
  paymentRunId: string;
}

export function BacsPreviewCard({ paymentRunId }: BacsPreviewCardProps) {
  const preview = useBacsPreview(paymentRunId);
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);

  if (preview.submitterNotConfigured) {
    return <BacsPreviewCardUnconfigured />;
  }

  const transliterationWarnings = toTransliterationWarnings(
    preview.previewData?.transliterationWarnings,
  );
  const modulusWarnings = toModulusWarnings(preview.previewData?.modulusWarnings);
  const hasUnmappable = transliterationWarnings.some(w => w.replaced.length > 0);
  const isPreviewLoading =
    preview.previewVisible && preview.isPreviewFetching && !preview.previewData;

  return (
    <BacsPreviewCardView
      showPii={showPii}
      previewVisible={preview.previewVisible}
      isPreviewFetching={preview.isPreviewFetching}
      isPreviewLoading={isPreviewLoading}
      previewData={preview.previewData}
      previewError={preview.previewError}
      transliterationWarnings={transliterationWarnings}
      modulusWarnings={modulusWarnings}
      hasUnmappable={hasUnmappable}
      onShowPreview={preview.onShowPreview}
      onGenerate={preview.onGenerate}
      isGenerating={preview.isGenerating}
    />
  );
}
