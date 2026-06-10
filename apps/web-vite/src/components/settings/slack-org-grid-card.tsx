/**
 * Presentational Slack Org-Grid connection card. A second Slack card (next to
 * the workspace Slack section) for the deprovisioning org-grid connection.
 * Connect is greyed out + a docs link when the org is not on Enterprise Grid.
 * Props-in / JSX-out.
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
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ExternalLink, ShieldCheck } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useSlackOrgGridCard } from './hooks/use-slack-org-grid-card.js';

const ENTERPRISE_GRID_DOCS =
  'https://slack.com/help/articles/360000281563-Manage-members-on-Enterprise-Grid';

export interface SlackOrgGridCardViewProps {
  isConnected: boolean;
  notOnEnterpriseGrid: boolean;
  connectDisabled: boolean;
  onConnect: () => void;
}

export function SlackOrgGridCardView({
  isConnected,
  notOnEnterpriseGrid,
  connectDisabled,
  onConnect,
}: SlackOrgGridCardViewProps) {
  const t = useTranslations('Idp.slackOrgGrid');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" aria-hidden="true" />
          {t('title')}
          {isConnected ? <Badge variant="default">{t('connected')}</Badge> : null}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {notOnEnterpriseGrid ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t('requiresEnterpriseGrid')}{' '}
            <a
              href={ENTERPRISE_GRID_DOCS}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline">
              {t('learnMore')}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </p>
        ) : null}
        {isConnected ? null : (
          <Button type="button" onClick={onConnect} disabled={connectDisabled}>
            {t('connect')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function SlackOrgGridCard() {
  const state = useSlackOrgGridCard();

  if (state.isLoading) {
    return <Skeleton className="h-36 w-full" data-testid="slack-org-grid-skeleton" />;
  }

  return (
    <SlackOrgGridCardView
      isConnected={state.isConnected}
      notOnEnterpriseGrid={state.notOnEnterpriseGrid}
      connectDisabled={state.connectDisabled}
      onConnect={state.onConnect}
    />
  );
}
