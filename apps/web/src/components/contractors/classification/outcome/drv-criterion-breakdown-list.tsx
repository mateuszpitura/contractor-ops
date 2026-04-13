// ---------------------------------------------------------------------------
// DRV criterion breakdown — Phase 58 Plan 05 Task 1.
// ---------------------------------------------------------------------------
// Renders the per-category answer table with TableCaption for screen readers.
// All prompts are read from the frozen questionsSnapshot — never the live
// rule-set constant (Pitfall 1).

'use client';

import type {
  QuestionsSnapshot,
  RuleSetQuestion,
  ScheinCategory,
} from '@contractor-ops/classification';
import { useTranslations } from 'next-intl';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Locale = 'en' | 'pl' | 'de' | 'ar';

export interface DrvCriterionBreakdownListProps {
  readonly category: ScheinCategory;
  readonly categoryLabel: string;
  readonly questionsSnapshot: QuestionsSnapshot;
  readonly answers: Record<string, unknown>;
  readonly locale: Locale;
}

function readPrompt(question: RuleSetQuestion, locale: Locale): string {
  if (locale === 'ar') return question.prompt.en;
  return question.prompt[locale] ?? question.prompt.en;
}

function readAnswer(raw: unknown, t: (key: string) => string): { label: string; score: string } {
  if (raw === undefined || raw === null) {
    return { label: t('outcome.drv.answerMissing'), score: '—' };
  }
  if (raw === 'yes') return { label: t('yesNo.yes'), score: '—' };
  if (raw === 'no') return { label: t('yesNo.no'), score: '—' };
  if (typeof raw === 'number') return { label: String(raw), score: String(raw) };
  if (typeof raw === 'object' && 'isNotApplicable' in raw) {
    const payload = raw as { rawScore?: number; isNotApplicable?: boolean };
    if (payload.isNotApplicable) {
      return { label: t('outcome.drv.answerNotApplicable'), score: '—' };
    }
    return {
      label: String(payload.rawScore ?? '—'),
      score: String(payload.rawScore ?? '—'),
    };
  }
  if (typeof raw === 'object' && 'value' in raw) {
    const v = (raw as { value: unknown }).value;
    if (typeof v === 'number') return { label: `${v}%`, score: String(v) };
    if (typeof v === 'string') return { label: v, score: '—' };
  }
  return { label: t('outcome.drv.answerMissing'), score: '—' };
}

export function DrvCriterionBreakdownList(props: DrvCriterionBreakdownListProps) {
  const { category, categoryLabel, questionsSnapshot, answers, locale } = props;
  const t = useTranslations('Classification');
  const criteria = questionsSnapshot.questions.filter(q => q.category === category);

  return (
    <Table data-testid="drv-criterion-table" data-category={category}>
      <TableCaption className="sr-only">
        {t('outcome.criteriaCaption', { category: categoryLabel })}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">{t('outcome.drv.criterion')}</TableHead>
          <TableHead scope="col">{t('outcome.drv.answer')}</TableHead>
          <TableHead scope="col" className="text-end">
            {t('outcome.drv.score')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {criteria.map(q => {
          const answer = readAnswer(answers[q.id], t);
          return (
            <TableRow key={q.id}>
              <TableCell className="align-top text-sm">
                <span className="font-medium">{readPrompt(q, locale)}</span>
                {q.drvReference ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {q.drvReference}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="align-top text-sm">{answer.label}</TableCell>
              <TableCell className="align-top text-end text-sm tabular-nums">
                {answer.score}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
