'use client';

// ---------------------------------------------------------------------------
// Classification outcome page — Phase 58 Plan 05 Task 1.
// ---------------------------------------------------------------------------
// Renders the stored assessment outcome:
//   - GB / IR35 → VerdictBanner (ir35) + 5 Ir35AreaCards
//   - DE / DRV → VerdictBanner (drv) + 4 DrvCategoryBars
// The blocking ClassificationDisclaimerDialog is force-mounted on top until
// `disclaimerAcknowledgedAt` is set (Pitfall 6 — re-opens on every visit).
//
// IMPORTANT: This page must NEVER import from
// `@contractor-ops/classification/profiles/*/rule-set` — every question prompt
// it renders is read from the persisted `assessment.questionsSnapshot`
// (Pitfall 1). The outcome.test.tsx OC-6 test mocks the live rule-set constant
// post-snapshot and asserts rendered prompts are unchanged.

import type {
  Ir35Outcome,
  QuestionsSnapshot,
  ScheinselbstandigkeitOutcome,
} from '@contractor-ops/classification';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { ClassificationDisclaimerDialog } from '@/components/contractors/classification/classification-disclaimer-dialog';
import { DrvCategoryBar } from '@/components/contractors/classification/outcome/drv-category-bar';
import { Ir35AreaCard } from '@/components/contractors/classification/outcome/ir35-area-card';
import { OutcomePrintLayout } from '@/components/contractors/classification/outcome/outcome-print-layout';
import { VerdictBanner } from '@/components/contractors/classification/outcome/verdict-banner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

interface RouteParams extends Record<string, string> {
  id: string;
  engagementId: string;
  assessmentId: string;
}

type SupportedLocale = 'en' | 'pl' | 'de' | 'ar';

const SUPPORTED_COUNTRIES = new Set(['GB', 'DE']);

export default function ClassificationOutcomePage() {
  const params = useParams<RouteParams>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('Classification');
  const format = useFormatter();
  const locale = useLocale() as SupportedLocale;

  // Fetch the specific assessment by id. Tenant scoping is enforced inside
  // the router (see classification.getById — returns null for cross-tenant
  // rows, never NOT_FOUND, to avoid leaking existence).
  const assessmentQuery = useQuery({
    ...trpc.classification.getById.queryOptions({
      assessmentId: params.assessmentId,
    }),
    retry: false,
  });

  const [disclaimerDeferred, setDisclaimerDeferred] = useState(false);

  const handleAcknowledged = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [['classification', 'getById']],
    });
  }, [queryClient]);

  const handleDeferred = useCallback(() => {
    setDisclaimerDeferred(true);
    router.push(`/contractors/${params.id}/engagements/${params.engagementId}`);
  }, [params.engagementId, params.id, router]);

  const handleRerun = useCallback(() => {
    router.push(`/contractors/${params.id}/engagements/${params.engagementId}/classification`);
  }, [params.engagementId, params.id, router]);

  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

  if (assessmentQuery.isPending) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[240px] items-center justify-center gap-2">
        <Loader2
          aria-hidden="true"
          className="h-5 w-5 animate-spin text-muted-foreground motion-reduce:animate-none"
        />
        <span className="sr-only">{t('outcome.loading')}</span>
      </div>
    );
  }

  const assessment = assessmentQuery.data;

  if (!assessment || assessment.id !== params.assessmentId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('outcome.notFound')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('outcome.notFoundBody')}</p>
          <Button render={<Link href={`/contractors/${params.id}/classification`} />}>
            {t('outcome.backToList')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const countryCode = assessment.countryCode?.toUpperCase();
  if (!(countryCode && SUPPORTED_COUNTRIES.has(countryCode))) {
    return (
      <Alert>
        <AlertTitle>{t('emptyState.notSupported')}</AlertTitle>
        <AlertDescription>
          {t('emptyState.notSupportedBody', { countryCode: countryCode || '—' })}
        </AlertDescription>
      </Alert>
    );
  }

  const outcome = assessment.outcome as Ir35Outcome | ScheinselbstandigkeitOutcome | null;
  const snapshot = assessment.questionsSnapshot as QuestionsSnapshot | null;
  const answers = (assessment.answers as Record<string, unknown>) ?? {};

  if (!(outcome && snapshot)) {
    return (
      <Alert>
        <AlertTitle>{t('outcome.notFound')}</AlertTitle>
        <AlertDescription>{t('outcome.notFoundBody')}</AlertDescription>
      </Alert>
    );
  }

  const disclaimerOpen = assessment.disclaimerAcknowledgedAt === null && !disclaimerDeferred;
  const completedDate =
    assessment.completedAt instanceof Date
      ? assessment.completedAt
      : assessment.completedAt
        ? new Date(assessment.completedAt)
        : null;
  const completedDateStr = completedDate ? format.dateTime(completedDate, 'short') : '—';

  return (
    <OutcomePrintLayout
      data-testid="outcome-print-layout"
      header={
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">{t('outcome.printTitle')}</h1>
          <p className="text-xs text-muted-foreground">{t('outcome.printSubtitle')}</p>
          <p className="text-xs text-muted-foreground">
            {t('outcome.ruleSetVersion', { version: assessment.ruleSetVersion })} ·{' '}
            {t('outcome.completedAt', { date: completedDateStr })}
          </p>
        </div>
      }
      footer={
        <p className="text-xs text-muted-foreground">
          {t('outcome.printedOn', { date: format.dateTime(new Date(), 'short') })} ·{' '}
          {t('outcome.printSubtitle')}
        </p>
      }>
      <OutcomeBody
        assessment={{ ...assessment, outcome, questionsSnapshot: snapshot }}
        answers={answers}
        locale={locale}
        completedDateStr={completedDateStr}
      />

      <div className="flex flex-wrap gap-2 outcome-no-print" data-no-print="true">
        <Button onClick={handlePrint}>{t('outcome.print')}</Button>
        <Button variant="outline" onClick={handleRerun}>
          {t('outcome.rerun')}
        </Button>
      </div>

      <ClassificationDisclaimerDialog
        assessmentId={assessment.id}
        countryCode={countryCode as 'GB' | 'DE'}
        open={disclaimerOpen}
        onAcknowledged={handleAcknowledged}
        onDeferred={handleDeferred}
      />
    </OutcomePrintLayout>
  );
}

interface OutcomeBodyProps {
  readonly assessment: {
    readonly countryCode: string;
    readonly outcome: Ir35Outcome | ScheinselbstandigkeitOutcome;
    readonly questionsSnapshot: QuestionsSnapshot;
    readonly ruleSetVersion: string;
  };
  readonly answers: Record<string, unknown>;
  readonly locale: SupportedLocale;
  readonly completedDateStr: string;
}

function OutcomeBody(props: OutcomeBodyProps) {
  const { assessment, answers, locale, completedDateStr } = props;
  const t = useTranslations('Classification');
  const countryCode = assessment.countryCode.toUpperCase();

  const subline = `${t('outcome.ruleSetVersion', { version: assessment.ruleSetVersion })} · ${t(
    'outcome.completedAt',
    { date: completedDateStr },
  )}`;

  if (countryCode === 'GB' && assessment.outcome.kind === 'IR35') {
    const label = t(`outcome.ir35.verdict.${assessment.outcome.verdict}`);
    return (
      <>
        <VerdictBanner kind="ir35" outcome={assessment.outcome} label={label} subline={subline} />
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          data-testid="ir35-area-grid">
          {assessment.outcome.areas.map(area => (
            <Ir35AreaCard
              key={area.area}
              area={area}
              questionsSnapshot={assessment.questionsSnapshot}
              answers={answers}
              locale={locale}
            />
          ))}
        </div>
      </>
    );
  }

  if (countryCode === 'DE' && assessment.outcome.kind === 'SCHEINSELBSTANDIGKEIT') {
    const label = t(`outcome.drv.verdict.${assessment.outcome.verdict}`);
    return (
      <>
        <VerdictBanner
          kind="drv"
          outcome={assessment.outcome}
          label={label}
          subline={`${subline} · ${t('outcome.drv.totalScore', {
            score: assessment.outcome.totalScore.toFixed(1),
            max: '100',
          })}`}
        />
        <div className="flex flex-col gap-3" data-testid="drv-category-stack">
          {assessment.outcome.categories.map(category => (
            <DrvCategoryBar
              key={category.category}
              category={category}
              questionsSnapshot={assessment.questionsSnapshot}
              answers={answers}
              locale={locale}
            />
          ))}
        </div>
      </>
    );
  }

  // Shouldn't happen — country + outcome.kind should always agree. Fall through
  // to an empty defensive render so the page never crashes.
  return null;
}
