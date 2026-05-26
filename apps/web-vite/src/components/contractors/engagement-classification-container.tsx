/**
 * Engagement classification wizard + outcome — Step 10 batch 3 port.
 *
 * Routes:
 *   …/classification           → wizard entry (draft create/resume)
 *   …/classification/:assessmentId → completed outcome view
 */

import type {
  Ir35Outcome,
  QuestionsSnapshot,
  ScheinselbstandigkeitOutcome,
} from '@contractor-ops/classification';
import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Link, useLocale } from '../../i18n/navigation.js';
import { tDyn } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { ClassificationDisclaimerDialogContainer } from './classification/classification-disclaimer-dialog-container.js';
import { DrvCategoryBar } from './classification/outcome/drv-category-bar.js';
import { Ir35AreaCard } from './classification/outcome/ir35-area-card.js';
import { OutcomePrintLayout } from './classification/outcome/outcome-print-layout.js';
import { VerdictBanner } from './classification/outcome/verdict-banner.js';
import type { WizardCountryCode } from './classification/wizard/classification-wizard-shell.js';
import { ClassificationWizardShellContainer } from './classification/wizard/classification-wizard-shell-container.js';
import {
  parseDriftVersions,
  useClassificationOutcomeView,
  useClassificationWizardEntry,
} from './hooks/use-engagement-classification.js';

type SupportedLocale = 'en' | 'pl' | 'de' | 'ar';

export function EngagementClassificationContainer() {
  const params = useParams<{ id: string; engagementId: string; assessmentId?: string }>();

  if (params.assessmentId) {
    return <ClassificationOutcomeView />;
  }

  return <ClassificationWizardEntry />;
}

function ClassificationWizardEntry() {
  const params = useParams<{ id: string; engagementId: string }>();
  const engagementId = params.engagementId ?? '';
  const {
    t,
    driftError,
    unsupportedCountryError,
    draft,
    countryCode,
    countrySupported,
    initialAnswers,
    initialUpdatedAt,
    handleRecreateDraft,
    recreateDraftMutation,
    draftQuery,
    isLoading,
  } = useClassificationWizardEntry(engagementId);

  if (driftError) {
    const [oldVersion, newVersion] = parseDriftVersions(driftError.message);
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive" role="alert">
          <AlertTitle>{t('error.draftDrift')}</AlertTitle>
          <AlertDescription>
            {t('error.draftDriftBody', {
              oldVersion: oldVersion ?? '?',
              newVersion: newVersion ?? '?',
            })}
          </AlertDescription>
        </Alert>
        <div>
          <Button
            onClick={handleRecreateDraft}
            disabled={recreateDraftMutation.isPending || !draftQuery.data}>
            {t('error.startNew')}
          </Button>
        </div>
      </div>
    );
  }

  if (unsupportedCountryError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('emptyState.notSupported')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('emptyState.notSupportedBody', { countryCode: '—' })}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !draft) {
    return <WizardLoading />;
  }

  if (!countrySupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('emptyState.notSupported')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('emptyState.notSupportedBody', { countryCode: countryCode || '—' })}
          </p>
        </CardContent>
      </Card>
    );
  }

  const initialUpdatedAtValue = initialUpdatedAt;

  return (
    <ClassificationWizardShellContainer
      assessmentId={draft.id}
      contractorAssignmentId={engagementId}
      contractorId={params.id ?? ''}
      countryCode={countryCode as WizardCountryCode}
      initialUpdatedAt={initialUpdatedAtValue}
      initialAnswers={initialAnswers}
    />
  );
}

function ClassificationOutcomeView() {
  const params = useParams<{ id: string; engagementId: string; assessmentId: string }>();
  const assessmentId = params.assessmentId ?? '';
  const contractorId = params.id ?? '';
  const engagementId = params.engagementId ?? '';
  const t = useTranslations('Classification');
  const locale = useLocale() as SupportedLocale;

  const { status, handleAcknowledged, handleDeferredNavigate, handleRerun, handlePrint } =
    useClassificationOutcomeView(assessmentId, contractorId, engagementId);

  if (status.kind === 'loading') {
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

  if (status.kind === 'not-found') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('outcome.notFound')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('outcome.notFoundBody')}</p>
          <Button render={<Link href={`/contractors/${contractorId}/classification`} />}>
            {t('outcome.backToList')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status.kind === 'unsupported-country') {
    return (
      <Alert>
        <AlertTitle>{t('emptyState.notSupported')}</AlertTitle>
        <AlertDescription>
          {t('emptyState.notSupportedBody', { countryCode: status.countryCode })}
        </AlertDescription>
      </Alert>
    );
  }

  if (status.kind === 'missing-outcome') {
    return (
      <Alert>
        <AlertTitle>{t('outcome.notFound')}</AlertTitle>
        <AlertDescription>{t('outcome.notFoundBody')}</AlertDescription>
      </Alert>
    );
  }

  const { assessment, answers, completedDateStr, disclaimerOpen } = status;

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
      footer={<p className="text-xs text-muted-foreground">{t('outcome.printSubtitle')}</p>}>
      <OutcomeBody
        assessment={assessment}
        answers={answers}
        locale={locale}
        completedDateStr={completedDateStr}
      />

      <div className="outcome-no-print flex flex-wrap gap-2" data-no-print="true">
        <Button onClick={handlePrint}>{t('outcome.print')}</Button>
        <Button variant="outline" onClick={handleRerun}>
          {t('outcome.rerun')}
        </Button>
      </div>

      <ClassificationDisclaimerDialogContainer
        assessmentId={assessment.id}
        countryCode={assessment.countryCode}
        open={disclaimerOpen}
        onAcknowledged={handleAcknowledged}
        onDeferred={handleDeferredNavigate}
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
    const label = tDyn(t, 'outcome.ir35.verdict', assessment.outcome.verdict);
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
    const label = tDyn(t, 'outcome.drv.verdict', assessment.outcome.verdict);
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

  return null;
}

function WizardLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[240px] flex-col items-center justify-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground motion-reduce:animate-none" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
