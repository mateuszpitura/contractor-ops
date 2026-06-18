// ---------------------------------------------------------------------------
// IR35 per-area card
// ---------------------------------------------------------------------------
// Renders one card per Ir35AreaResult. Exposes top-3 driving questions + an
// expandable Collapsible containing the full question inventory for this area.
// All question prompts are read from the frozen questionsSnapshot passed
// through props — never from the live rule-set constant (answers must reflect
// what was asked at assessment time).

import type {
  Ir35Area,
  Ir35AreaResult,
  Ir35AreaVerdict,
  QuestionsSnapshot,
  RuleSetQuestion,
} from '@contractor-ops/classification';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import { ChevronDown } from 'lucide-react';
import { tDyn, tDynLoose } from '../../../../i18n/typed-keys.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';

type Locale = 'en' | 'pl' | 'de' | 'ar';

export interface Ir35AreaCardProps {
  readonly area: Ir35AreaResult;
  readonly questionsSnapshot: QuestionsSnapshot;
  readonly answers: Record<string, unknown>;
  readonly locale: Locale;
}

const AREA_STEP_KEY: Record<Ir35Area, string> = {
  substitution: 'substitution',
  control: 'control',
  'financial-risk': 'financialRisk',
  'part-and-parcel': 'partAndParcel',
  moo: 'moo',
};

const VERDICT_TONE: Record<Ir35AreaVerdict, 'success' | 'destructive' | 'warning' | 'neutral'> = {
  'strong-outside': 'success',
  'leaning-outside': 'success',
  neutral: 'neutral',
  'leaning-inside': 'warning',
  'strong-inside': 'destructive',
};

function TonePill({
  tone,
  children,
}: {
  tone: 'success' | 'destructive' | 'warning' | 'neutral';
  children: React.ReactNode;
}) {
  const classes: Record<typeof tone, string> = {
    success: 'bg-success/10 text-success border-success/30',
    destructive: 'bg-destructive/10 text-destructive border-destructive/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    neutral: 'bg-muted text-foreground border-border',
  };
  return (
    <Badge variant="outline" data-tone={tone} className={classes[tone]}>
      {children}
    </Badge>
  );
}

function readPrompt(question: RuleSetQuestion, locale: Locale): string {
  if (locale === 'ar') return question.prompt.en; // Arabic not translated in rule set; fall back to English.
  return question.prompt[locale] ?? question.prompt.en;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: flat type-narrowing chain over an `unknown` answer payload — each branch maps a distinct runtime shape to a display string and is not factorable without losing the guard sequence
function readAnswerSummary(
  raw: unknown,
  _locale: Locale,
  t: ReturnType<typeof useTranslations>,
): string {
  if (raw === undefined || raw === null) return t('outcome.drv.answerMissing');
  if (raw === 'yes' || raw === 'no') {
    return raw === 'yes' ? t('yesNo.yes') : t('yesNo.no');
  }
  if (typeof raw === 'number') return String(raw);
  if (typeof raw === 'object' && 'isNotApplicable' in raw) {
    const payload = raw as { rawScore?: number; isNotApplicable?: boolean };
    if (payload.isNotApplicable) return t('outcome.drv.answerNotApplicable');
    return String(payload.rawScore ?? '—');
  }
  if (typeof raw === 'object' && 'value' in raw) {
    const v = (raw as { value: unknown }).value;
    if (typeof v === 'number') return `${v}%`;
    if (typeof v === 'string') return v;
  }
  return t('outcome.drv.answerMissing');
  // locale unused for now; kept for future i18n formatting
}

export function Ir35AreaCard(props: Ir35AreaCardProps) {
  const { area, questionsSnapshot, answers, locale } = props;
  const t = useTranslations('Classification');
  const areaQuestions = questionsSnapshot.questions.filter(q => q.area === area.area);
  const drivingIds = area.drivingQuestionIds ?? [];
  const drivingQuestions = drivingIds
    .map(id => areaQuestions.find(q => q.id === id))
    .filter((q): q is RuleSetQuestion => Boolean(q));
  const otherQuestions = areaQuestions.filter(q => !drivingIds.includes(q.id));

  const tone = VERDICT_TONE[area.verdict];
  const areaTitle = tDynLoose(t, 'ir35.step', AREA_STEP_KEY[area.area]);
  const verdictLabel = tDyn(t, 'outcome.ir35.areaVerdict', area.verdict);

  return (
    <Card data-testid="ir35-area-card" data-area={area.area} className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <CardTitle className="text-base font-semibold">{areaTitle}</CardTitle>
        <TonePill tone={tone}>{verdictLabel}</TonePill>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {drivingQuestions.length > 0 ? (
          <section aria-label={t('outcome.ir35.drivingQuestions')} className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('outcome.ir35.drivingQuestions')}
            </h4>
            <ul className="space-y-2 text-sm">
              {drivingQuestions.map(q => (
                <li key={q.id} className="rounded-md border bg-muted/30 p-2">
                  <p className="font-medium text-foreground">{readPrompt(q, locale)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {readAnswerSummary(answers[q.id], locale, t)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {otherQuestions.length > 0 ? (
          <Collapsible className="group/area-collapsible print:open">
            <CollapsibleTrigger
              className="flex w-full items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm font-medium hover:bg-muted/40"
              aria-label={t('outcome.ir35.allQuestions')}>
              <span>{t('outcome.ir35.allQuestions')}</span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 transition-transform group-data-[state=open]/area-collapsible:rotate-180"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 print:!block print:animate-none">
              <ul className="space-y-2 text-sm">
                {otherQuestions.map(q => (
                  <li key={q.id} className="rounded-md border p-2">
                    <p className="font-medium text-foreground">{readPrompt(q, locale)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {readAnswerSummary(answers[q.id], locale, t)}
                    </p>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        {area.caseLawCitations.length > 0 ? (
          <section aria-label={t('outcome.ir35.caseLawCitations')} className="space-y-1">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('outcome.ir35.caseLawCitations')}
            </h4>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {area.caseLawCitations.map(citation => (
                <li key={citation}>{citation}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
