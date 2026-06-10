/**
 * Presentational impact-preview panel. Per-IdP card showing what deprovisioning
 * will affect, a freshness label, and a Refresh button. Props-in / JSX-out;
 * the container owns loading/failure routing.
 */

import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { GoogleWorkspaceReconnectBanner } from '../integrations/google-workspace-reconnect-banner.js';
import type { ImpactProvider } from './hooks/use-impact-preview.js';
import { useImpactPreview } from './hooks/use-impact-preview.js';

// Mirrors the integrations ImpactPreview discriminated union (read-only shape).
type GwsPreview = {
  provider: 'GOOGLE_WORKSPACE';
  commonMetrics: {
    externalUserId: string;
    externalUserDisplayName: string;
    accountStatus: string;
    sessionCount: number | null;
  };
  customMetrics: {
    oauthGrants: Array<{ appName: string; scopes: string[] }>;
    isSuperAdmin: boolean;
    drivesOwnedCount: number | null;
  };
  fetchedAt: string;
};
type SlackPreview = {
  provider: 'SLACK';
  commonMetrics: {
    externalUserId: string;
    externalUserDisplayName: string;
    accountStatus: string;
    sessionCount: number | null;
  };
  customMetrics: {
    channelsMemberCount: number | null;
    ownedChannelCount: number | null;
    installedAppCount: number | null;
    isWorkspaceAdmin: boolean;
    isOrgOwner: boolean;
    error?: 'NOT_ON_ENTERPRISE_GRID' | null;
  };
  fetchedAt: string;
};
export type ImpactPreviewData = GwsPreview | SlackPreview;

export interface ImpactPreviewPanelProps {
  preview: ImpactPreviewData;
  lastRefreshedMinutesAgo: number | null;
  onRefresh: () => void;
  refreshing?: boolean;
}

function dash(n: number | null): string {
  return n === null ? '—' : String(n);
}

export function ImpactPreviewPanel({
  preview,
  lastRefreshedMinutesAgo,
  onRefresh,
  refreshing,
}: ImpactPreviewPanelProps) {
  const t = useTranslations('Idp.preview');

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{t(`provider.${preview.provider}`)}</CardTitle>
          <CardDescription>
            {preview.commonMetrics.externalUserDisplayName}
            {' · '}
            <Badge variant="outline">
              {t(`accountStatus.${preview.commonMetrics.accountStatus}`)}
            </Badge>
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label={t('refresh')}>
          <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {preview.provider === 'GOOGLE_WORKSPACE' ? (
          <ul className="space-y-1">
            <li>{t('gws.suspend', { email: preview.commonMetrics.externalUserId })}</li>
            <li>
              {t('gws.revokeGrants', {
                count: preview.customMetrics.oauthGrants.length,
                apps: preview.customMetrics.oauthGrants.map(g => g.appName).join(', ') || '—',
              })}
            </li>
            <li>{t('gws.signOut', { count: dash(preview.commonMetrics.sessionCount) })}</li>
            {preview.customMetrics.isSuperAdmin ? (
              <li className="text-destructive">{t('gws.superAdmin')}</li>
            ) : null}
          </ul>
        ) : preview.customMetrics.error === 'NOT_ON_ENTERPRISE_GRID' ? (
          <p role="status" className="text-muted-foreground">
            {t('slack.notOnEnterpriseGrid')}
          </p>
        ) : (
          <ul className="space-y-1">
            <li>
              {t('slack.channels', { count: dash(preview.customMetrics.channelsMemberCount) })}
            </li>
            <li>{t('slack.apps', { count: dash(preview.customMetrics.installedAppCount) })}</li>
            {preview.customMetrics.isWorkspaceAdmin ? <li>{t('slack.workspaceAdmin')}</li> : null}
            {preview.customMetrics.isOrgOwner ? (
              <li className="text-destructive">{t('slack.orgOwner')}</li>
            ) : null}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {lastRefreshedMinutesAgo === null
            ? t('freshness.justNow')
            : t('freshness.minutesAgo', { count: lastRefreshedMinutesAgo })}
        </p>
      </CardContent>
    </Card>
  );
}

function minutesAgo(at: Date | null): number | null {
  if (!at) return null;
  return Math.max(0, Math.floor((Date.now() - at.getTime()) / 60_000));
}

export interface ImpactPreviewPanelWiredProps {
  assignmentId: string;
  provider: ImpactProvider;
  onProceedWithoutPreview?: () => void;
}

export function ImpactPreviewPanelWired({
  assignmentId,
  provider,
  onProceedWithoutPreview,
}: ImpactPreviewPanelWiredProps) {
  const t = useTranslations('Idp.preview');
  const state = useImpactPreview(assignmentId, provider);

  if (state.isLoading) {
    return <Skeleton className="h-40 w-full" data-testid="impact-preview-skeleton" />;
  }

  if (state.failure?.kind === 'reconnect_required') {
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
