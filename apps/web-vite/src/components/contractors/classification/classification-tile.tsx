// Per-engagement Classification tile.

import type { OutcomeSchemaType } from '@contractor-ops/classification';
import { outcomeSchema } from '@contractor-ops/classification';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Bdi } from '@contractor-ops/ui/components/shadcn/bdi';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { LucideIcon } from 'lucide-react';
import { CircleCheck, ShieldAlert, ShieldQuestion, ShieldX } from 'lucide-react';
import { useMemo } from 'react';

import { Link } from '../../../i18n/navigation.js';
import { tDyn } from '../../../i18n/typed-keys.js';
import { useFormatter } from '../../../i18n/useFormatter.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { ClassificationEngagementCta } from './classification-engagement-cta.js';
import { useClassificationTile } from './hooks/use-classification-tile.js';

export interface ClassificationTileEngagement {
  readonly id: string;
  readonly name: string;
  readonly contractorId: string;
  readonly countryCode: 'GB' | 'DE';
}

type ClassificationLatestAssessment =
  | {
      id: string;
      completedAt: Date | string | null;
      ruleSetVersion: string;
      outcome: unknown;
    }
  | null
  | undefined;

export interface ClassificationTileViewProps {
  readonly engagement: ClassificationTileEngagement;
  /** Truthy with a complete outcome — guarded by container variant pick. */
  readonly latest: NonNullable<ClassificationLatestAssessment> & { outcome: unknown };
}

export interface ClassificationTileEmptyProps {
  readonly engagement: ClassificationTileEngagement;
}

type Tone = 'success' | 'warning' | 'destructive' | 'neutral';

function toneForOutcome(outcome: OutcomeSchemaType): {
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

export function ClassificationTileSkeleton() {
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

export function ClassificationTileEmpty(props: ClassificationTileEmptyProps) {
  const { engagement } = props;
  const t = useTranslations('Classification');
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

export function ClassificationTileView(props: ClassificationTileViewProps) {
  const { engagement, latest } = props;
  const t = useTranslations('Classification');
  const format = useFormatter();

  const relativeCompleted = useMemo(() => {
    const raw = latest.completedAt;
    if (!raw) return null;
    const completedAt = raw instanceof Date ? raw : new Date(raw);
    return format.relativeTime(completedAt, Date.now());
  }, [format, latest.completedAt]);

  const latestData = latest;
  const parsedOutcome = outcomeSchema.safeParse(latestData.outcome);
  if (!parsedOutcome.success) {
    return <ClassificationTileEmpty engagement={engagement} />;
  }
  const outcome = parsedOutcome.data;
  const { tone, Icon } = toneForOutcome(outcome);
  const verdictLabel =
    outcome.kind === 'IR35'
      ? tDyn(t, 'outcome.ir35.verdict', outcome.verdict)
      : tDyn(t, 'outcome.drv.verdict', outcome.verdict);

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
          <span>{t('tile.ruleSetVersion', { version: latestData.ruleSetVersion })}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            data-testid="classification-tile-view-details"
            render={
              <Link
                href={`/contractors/${engagement.contractorId}/engagements/${engagement.id}/classification/${latestData.id}`}
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

export interface ClassificationTileContainerProps {
  readonly engagement: ClassificationTileEngagement;
}

export function ClassificationTileContainer(props: ClassificationTileContainerProps) {
  const { latest, isPending } = useClassificationTile(props.engagement.id);

  if (isPending) return <ClassificationTileSkeleton />;
  if (!latest?.outcome) return <ClassificationTileEmpty engagement={props.engagement} />;

  return <ClassificationTileView engagement={props.engagement} latest={latest} />;
}

/** @deprecated Use ClassificationTile */
export { ClassificationTileContainer as ClassificationTile };
