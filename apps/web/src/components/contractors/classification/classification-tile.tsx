'use client';

// ---------------------------------------------------------------------------
// Per-engagement Classification tile — Phase 58 Plan 05 Task 2.
// ---------------------------------------------------------------------------
// Surfaces the latest classification state for a single engagement inside the
// contractor-profile CountryComplianceSection. Displays:
//   - Loading skeleton while the query resolves
//   - Empty state + CTA when no completed assessment exists
//   - Verdict pill (semantic triad — colour + icon + text) + completedAt
//     relative date + "View details" + "Re-run assessment" when present.

import type { Ir35Outcome, ScheinselbstandigkeitOutcome } from '@contractor-ops/classification';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { CircleCheck, ShieldAlert, ShieldQuestion, ShieldX } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Bdi } from '@/components/ui/bdi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

import { ClassificationEngagementCta } from './classification-engagement-cta';

export interface ClassificationTileEngagement {
  readonly id: string;
  readonly name: string;
  readonly contractorId: string;
  readonly countryCode: 'GB' | 'DE';
}

export interface ClassificationTileProps {
  readonly engagement: ClassificationTileEngagement;
}

type Tone = 'success' | 'warning' | 'destructive' | 'neutral';

function toneForOutcome(outcome: Ir35Outcome | ScheinselbstandigkeitOutcome): {
  tone: Tone;
  Icon: LucideIcon;
} {
  if (outcome.kind === 'IR35') {
    switch (outcome.verdict) {
      case 'outside':
        return { tone: 'success', Icon: CircleCheck };
      case 'inside':
        return { tone: 'destructive', Icon: ShieldX };
      case 'indeterminate':
        return { tone: 'warning', Icon: ShieldQuestion };
    }
  }
  switch (outcome.verdict) {
    case 'green':
      return { tone: 'success', Icon: CircleCheck };
    case 'amber':
      return { tone: 'warning', Icon: ShieldAlert };
    case 'red':
      return { tone: 'destructive', Icon: ShieldX };
  }
}

const TONE_CLASSES: Record<Tone, string> = {
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
  neutral: 'border-border bg-muted text-foreground',
};

export function ClassificationTile(props: ClassificationTileProps) {
  const { engagement } = props;
  const t = useTranslations('Classification');
  const format = useFormatter();

  const latestQuery = useQuery({
    ...trpc.classification.getLatest.queryOptions({
      contractorAssignmentId: engagement.id,
    }),
    retry: false,
  });

  const relativeCompleted = useMemo(() => {
    const raw = latestQuery.data?.completedAt;
    if (!raw) return null;
    const completedAt = raw instanceof Date ? raw : new Date(raw);
    return format.relativeTime(completedAt, Date.now());
  }, [format, latestQuery.data?.completedAt]);

  if (latestQuery.isPending) {
    return (
      <Card data-testid="classification-tile" aria-busy="true" className="flex flex-col gap-3 p-4">
        <div data-testid="classification-tile-skeleton" className="flex flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-24" />
        </div>
      </Card>
    );
  }

  const latest = latestQuery.data;

  if (!latest?.outcome) {
    return (
      <Card data-testid="classification-tile" className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            <Bdi>{engagement.name}</Bdi>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t('emptyState.noAssessment')}</p>
          <ClassificationEngagementCta
            contractorId={engagement.contractorId}
            engagementId={engagement.id}
            size="sm"
          />
        </CardContent>
      </Card>
    );
  }

  const outcome = latest.outcome as unknown as Ir35Outcome | ScheinselbstandigkeitOutcome;
  const { tone, Icon } = toneForOutcome(outcome);
  const verdictLabel =
    outcome.kind === 'IR35'
      ? t(`outcome.ir35.verdict.${outcome.verdict}`)
      : t(`outcome.drv.verdict.${outcome.verdict}`);

  return (
    <Card data-testid="classification-tile" className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold">
          <span className="truncate">
            <Bdi>{engagement.name}</Bdi>
          </span>
          <Badge
            variant="outline"
            className={TONE_CLASSES[tone]}
            data-tone={tone}
            data-testid="classification-tile-verdict">
            <Icon aria-hidden="true" className="me-1 size-3.5" />
            {verdictLabel}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {relativeCompleted ? (
            <span data-testid="classification-tile-completed-at">{relativeCompleted}</span>
          ) : null}
          <span>{t('tile.ruleSetVersion', { version: latest.ruleSetVersion })}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            data-testid="classification-tile-view-details"
            render={
              <Link
                href={`/contractors/${engagement.contractorId}/engagements/${engagement.id}/classification/${latest.id}`}
              />
            }>
            {t('tile.viewDetails')}
          </Button>
          <ClassificationEngagementCta
            contractorId={engagement.contractorId}
            engagementId={engagement.id}
            variant="ghost"
            size="sm"
            label={t('tile.rerun')}
            dataTestId="classification-tile-rerun"
          />
        </div>
      </CardContent>
    </Card>
  );
}
