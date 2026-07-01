// US worker-classification result — wired section (data-layer compliant).
//
// Reads through `useUsClassification` (the sole tRPC boundary) and branches the
// four required states. The loaded surface reads as decision-support, never a
// legal verdict: a sticky advisory banner, a blocking disclaimer that must be
// acknowledged before the outcome is shown, an amber (never red) AB5 watchlist
// flag, an info-blue §530 relief flag, and an adviser-verify note frame the
// scored federal common-law factors. The verdict pill itself mirrors the v5.0
// classification tone mapping. Overriding the outcome is reason-required and
// audit-logged server-side.

import { outcomeSchema } from '@contractor-ops/classification';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Bdi } from '@contractor-ops/ui/components/shadcn/bdi';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { SOFTWARE_NOT_LEGAL_ADVICE_EN } from '@contractor-ops/validators';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CircleCheck,
  PencilLine,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { useFormatter } from '../../../i18n/useFormatter.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { ClassificationAdvisoryBanner } from '../../classification/advisory-banner.js';
import { AnimateIn } from '../../shared/animate-in.js';
import { Ab5WatchlistFlag } from './ab5-watchlist-flag.js';
import { ClassificationEngagementCta } from './classification-engagement-cta.js';
import { ClassificationOverrideDialog } from './classification-override-dialog.js';
import { useClassificationDisclaimerAck } from './hooks/use-classification-disclaimer.js';
import { useUsClassification } from './hooks/use-us-classification.js';
import { LegalReferenceCollapsible } from './wizard/legal-reference-collapsible.js';

export interface UsClassificationEngagement {
  readonly id: string;
  readonly name: string;
  readonly contractorId: string;
}

export interface UsClassificationResultProps {
  readonly engagement: UsClassificationEngagement;
}

type Tone = 'success' | 'warning' | 'destructive';

const VERDICT_META: Record<
  'employee' | 'independent-contractor' | 'indeterminate',
  { tone: Tone; Icon: LucideIcon }
> = {
  'independent-contractor': { tone: 'success', Icon: CircleCheck },
  indeterminate: { tone: 'warning', Icon: ShieldQuestion },
  employee: { tone: 'destructive', Icon: ShieldX },
};

const TONE_CLASSES: Record<Tone, string> = {
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
};

const FEDERAL_CATEGORIES = ['behavioral', 'financial', 'relationship'] as const;

// -----------------------------------------------------------------------------
// State branches
// -----------------------------------------------------------------------------

function UsClassificationResultSkeleton() {
  const t = useTranslations('UsClassification');
  return (
    <Card aria-busy="true" aria-live="polite" data-testid="us-classification-result">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </CardContent>
    </Card>
  );
}

function UsClassificationResultEmpty({ engagement }: UsClassificationResultProps) {
  const t = useTranslations('UsClassification');
  return (
    <Card data-testid="us-classification-result">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <h3 className="font-display text-lg font-semibold leading-tight">{t('empty.heading')}</h3>
        <p className="max-w-prose text-sm text-muted-foreground">{t('empty.body')}</p>
        <ClassificationEngagementCta
          contractorId={engagement.contractorId}
          engagementId={engagement.id}
          label={t('empty.cta')}
        />
      </CardContent>
    </Card>
  );
}

function UsClassificationResultError({ onReload }: { onReload: () => void }) {
  const t = useTranslations('UsClassification');
  return (
    <Card data-testid="us-classification-result">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <p role="alert" className="text-sm text-destructive">
          {t('error.load')}
        </p>
        <Button type="button" variant="outline" onClick={onReload}>
          {t('error.reload')}
        </Button>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Blocking disclaimer gate — must be acknowledged before the outcome is shown.
// -----------------------------------------------------------------------------

function UsDisclaimerGate({
  assessmentId,
  onAcknowledged,
}: {
  assessmentId: string;
  onAcknowledged: () => void;
}) {
  const t = useTranslations('UsClassification');
  const titleId = useId();
  const descId = useId();
  const checkboxId = useId();
  const [checked, setChecked] = useState(false);
  const { acknowledge, isPending } = useClassificationDisclaimerAck(assessmentId, onAcknowledged);

  // Any attempted close from escape / outside interaction is swallowed: the
  // dialog stays open until the explicit confirm button is clicked.
  const handleOpenChange = useCallback(
    (_next: boolean, eventDetails: { preventDefault?: () => void; reason?: string }) => {
      eventDetails.preventDefault?.();
    },
    [],
  );
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);
  const handleCheckedChange = useCallback(
    (c: boolean | 'indeterminate') => setChecked(c === true),
    [],
  );
  const handleConfirm = useCallback(() => {
    if (!checked || isPending) return;
    acknowledge();
  }, [checked, isPending, acknowledge]);

  return (
    <AlertDialog open onOpenChange={handleOpenChange}>
      <AlertDialogContent
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="max-w-lg"
        onKeyDown={handleKeyDown}>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-warning/10 text-warning">
            <AlertTriangle aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle id={titleId}>{t('disclaimer.title')}</AlertDialogTitle>
          <AlertDialogDescription id={descId}>
            {SOFTWARE_NOT_LEGAL_ADVICE_EN}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
          <Checkbox id={checkboxId} checked={checked} onCheckedChange={handleCheckedChange} />
          <Label htmlFor={checkboxId} className="cursor-pointer text-sm font-normal leading-snug">
            {t('disclaimer.acknowledgement')}
          </Label>
        </div>

        <AlertDialogAction onClick={handleConfirm} disabled={!checked || isPending}>
          {isPending ? t('disclaimer.acknowledging') : t('disclaimer.confirm')}
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// -----------------------------------------------------------------------------
// Loaded outcome
// -----------------------------------------------------------------------------

interface LoadedOutcome {
  ruleSetVersion: string;
  verdict: 'employee' | 'independent-contractor' | 'indeterminate';
  federalFactors: ReadonlyArray<{
    category: 'behavioral' | 'financial' | 'relationship';
    employeeSignals: number;
    contractorSignals: number;
  }>;
  ab5Flag: boolean;
  section530ReliefEligible: boolean;
  computedAt: string;
}

function Section530Flag() {
  const t = useTranslations('UsClassification');
  const label = t('section530.label');
  const tooltip = t('section530.tooltip');
  const badge = (
    <Badge variant="info" data-testid="section530-flag" aria-label={`${label}. ${tooltip}`}>
      <ShieldCheck className="size-3" aria-hidden="true" />
      <span>{label}</span>
    </Badge>
  );
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={badge as ReactElement} />
        <TooltipContent aria-label={tooltip} className="max-w-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function UsOutcomeContent({
  engagement,
  outcome,
  override,
  overridePending,
  overrideError,
}: {
  engagement: UsClassificationEngagement;
  outcome: LoadedOutcome;
  override: (input: {
    overrideVerdict: LoadedOutcome['verdict'];
    reason: string;
  }) => Promise<unknown>;
  overridePending: boolean;
  overrideError?: string;
}) {
  const t = useTranslations('UsClassification');
  const format = useFormatter();
  const [overrideOpen, setOverrideOpen] = useState(false);

  const meta = VERDICT_META[outcome.verdict];
  const { Icon } = meta;
  const verdictLabel = t(`verdict.${outcome.verdict}`);
  const liveMessage = outcome.ab5Flag
    ? t('live.verdictWithAb5', { verdict: verdictLabel })
    : t('live.verdict', { verdict: verdictLabel });

  const factorByCategory = useMemo(() => {
    const map = new Map<string, LoadedOutcome['federalFactors'][number]>();
    for (const factor of outcome.federalFactors) map.set(factor.category, factor);
    return map;
  }, [outcome.federalFactors]);

  const handleOverrideSubmit = useCallback(
    async (input: { overrideVerdict: LoadedOutcome['verdict']; reason: string }) => {
      await override(input);
      setOverrideOpen(false);
    },
    [override],
  );
  const handleOpenOverride = useCallback(() => setOverrideOpen(true), []);

  return (
    <>
      <span className="sr-only" aria-live="polite" role="status">
        {liveMessage}
      </span>

      <AnimateIn delay={0}>
        <Card data-testid="us-classification-result">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
              <span className="truncate">
                <Bdi>{engagement.name}</Bdi>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={TONE_CLASSES[meta.tone]}
                  data-tone={meta.tone}
                  data-testid="us-classification-verdict">
                  <Icon aria-hidden="true" className="me-1 size-3.5" />
                  {verdictLabel}
                </Badge>
                {outcome.ab5Flag ? <Ab5WatchlistFlag /> : null}
                {outcome.section530ReliefEligible ? <Section530Flag /> : null}
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              {t('ruleSetVersion', { version: outcome.ruleSetVersion })} ·{' '}
              {t('computedOn', { date: format.dateTime(outcome.computedAt, 'medium') })}
            </p>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('factors.heading')}
              </h4>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {FEDERAL_CATEGORIES.map(category => {
                  const factor = factorByCategory.get(category);
                  return (
                    <div key={category} className="rounded-md border bg-background p-3">
                      <dt className="text-xs font-medium text-muted-foreground">
                        {t(`factors.${category}`)}
                      </dt>
                      <dd className="mt-1 flex items-baseline gap-2 text-sm">
                        <span className="font-mono">{factor?.employeeSignals ?? 0}</span>
                        <span className="text-xs text-muted-foreground">
                          {t('factors.employeeSignals')}
                        </span>
                        <span aria-hidden="true" className="text-muted-foreground">
                          /
                        </span>
                        <span className="font-mono">{factor?.contractorSignals ?? 0}</span>
                        <span className="text-xs text-muted-foreground">
                          {t('factors.contractorSignals')}
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>

            <div className="flex flex-col gap-2">
              <LegalReferenceCollapsible citation={t('citations.federal')} kind="case-law" />
              {outcome.ab5Flag ? (
                <LegalReferenceCollapsible citation={t('citations.ab5')} kind="case-law" />
              ) : null}
              {outcome.section530ReliefEligible ? (
                <LegalReferenceCollapsible citation={t('citations.section530')} kind="case-law" />
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">{t('adviserVerify')}</p>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenOverride}
                data-testid="us-classification-override-trigger">
                <PencilLine aria-hidden="true" className="me-1 size-3.5" />
                {t('override.trigger')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </AnimateIn>

      <ClassificationOverrideDialog
        engagementName={engagement.name}
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        onSubmit={handleOverrideSubmit}
        pending={overridePending}
        serverError={overrideError}
      />
    </>
  );
}

// -----------------------------------------------------------------------------
// Loaded view — mounts the banner + disclaimer gate, then the outcome.
// -----------------------------------------------------------------------------

function UsClassificationResultView({
  engagement,
  assessmentId,
  disclaimerAcknowledgedAt,
  outcome,
  override,
  overridePending,
  overrideError,
}: {
  engagement: UsClassificationEngagement;
  assessmentId: string;
  disclaimerAcknowledgedAt: Date | string | null;
  outcome: LoadedOutcome;
  override: (input: {
    overrideVerdict: LoadedOutcome['verdict'];
    reason: string;
  }) => Promise<unknown>;
  overridePending: boolean;
  overrideError?: string;
}) {
  const [locallyAcked, setLocallyAcked] = useState(false);
  const acknowledged = disclaimerAcknowledgedAt != null || locallyAcked;
  const handleAcknowledged = useCallback(() => setLocallyAcked(true), []);

  useEffect(() => {
    if (disclaimerAcknowledgedAt != null) setLocallyAcked(true);
  }, [disclaimerAcknowledgedAt]);

  return (
    <div className="flex flex-col gap-4">
      <ClassificationAdvisoryBanner jurisdiction="US" />
      {acknowledged ? (
        <UsOutcomeContent
          engagement={engagement}
          outcome={outcome}
          override={override}
          overridePending={overridePending}
          overrideError={overrideError}
        />
      ) : (
        <UsDisclaimerGate assessmentId={assessmentId} onAcknowledged={handleAcknowledged} />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Container — the state machine.
// -----------------------------------------------------------------------------

export function UsClassificationResult({ engagement }: UsClassificationResultProps) {
  const { latest, isPending, isError, refetch, override, overrideMutation } = useUsClassification(
    engagement.id,
  );
  const handleReload = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (isPending) return <UsClassificationResultSkeleton />;
  if (isError) return <UsClassificationResultError onReload={handleReload} />;
  if (!latest?.outcome) return <UsClassificationResultEmpty engagement={engagement} />;

  const parsed = outcomeSchema.safeParse(latest.outcome);
  if (!parsed.success || parsed.data.kind !== 'US_CLASSIFICATION') {
    return <UsClassificationResultEmpty engagement={engagement} />;
  }

  return (
    <UsClassificationResultView
      engagement={engagement}
      assessmentId={latest.id}
      disclaimerAcknowledgedAt={latest.disclaimerAcknowledgedAt}
      outcome={parsed.data}
      override={override}
      overridePending={overrideMutation.isPending}
      overrideError={overrideMutation.error?.message}
    />
  );
}
