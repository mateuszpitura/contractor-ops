/**
 * Phase 77 D-01/D-02 — presentational impact-preview panel. Per-IdP card showing
 * what deprovisioning will affect, a freshness label, and a Refresh button.
 * Props-in / JSX-out; the container owns loading/failure routing.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { RefreshCw } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

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
