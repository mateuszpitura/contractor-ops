/**
 * Phase 77 D-02/D-03 — impact-preview container. Decides: Skeleton (loading),
 * reconnect banner (401), admin-choice banner (fetch failure), or the preview
 * panel. The hook is the sole tRPC boundary.
 */

import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertTriangle } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { GoogleWorkspaceReconnectBanner } from '../integrations/google-workspace-reconnect-banner.js';
import type { ImpactProvider } from './hooks/use-impact-preview.js';
import { useImpactPreview } from './hooks/use-impact-preview.js';
import type { ImpactPreviewData } from './impact-preview-panel.js';
import { ImpactPreviewPanel } from './impact-preview-panel.js';

export interface ImpactPreviewPanelContainerProps {
  assignmentId: string;
  provider: ImpactProvider;
  /** Called when the admin chooses to proceed without a preview (D-03). */
  onProceedWithoutPreview?: () => void;
}

function minutesAgo(at: Date | null): number | null {
  if (!at) return null;
  return Math.max(0, Math.floor((Date.now() - at.getTime()) / 60_000));
}

export function ImpactPreviewPanelContainer({
  assignmentId,
  provider,
  onProceedWithoutPreview,
}: ImpactPreviewPanelContainerProps) {
  const t = useTranslations('Idp.preview');
  const state = useImpactPreview(assignmentId, provider);

  if (state.isLoading) {
    return <Skeleton className="h-40 w-full" data-testid="impact-preview-skeleton" />;
  }

  if (state.failure?.kind === 'reconnect_required') {
    // 401 → route to the existing reconnect banner (forced visible via null caps).
    return <GoogleWorkspaceReconnectBanner scopeCapabilities={null} />;
  }

  if (state.failure?.kind === 'admin_choice' || state.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTriangle className="size-4" aria-hidden="true" />
        <AlertTitle>{t('failure.title')}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{t('failure.body', { reason: state.failure?.reason ?? '' })}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={state.onRetry}>
              {t('failure.retry')}
            </Button>
            {onProceedWithoutPreview ? (
              <Button type="button" size="sm" onClick={onProceedWithoutPreview}>
                {t('failure.proceed')}
              </Button>
            ) : null}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (!state.preview) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t('empty')}
      </p>
    );
  }

  return (
    <ImpactPreviewPanel
      preview={state.preview as ImpactPreviewData}
      lastRefreshedMinutesAgo={minutesAgo(state.lastRefreshedAt)}
      onRefresh={state.refresh}
    />
  );
}
