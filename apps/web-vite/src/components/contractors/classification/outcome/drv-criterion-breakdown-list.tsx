// ---------------------------------------------------------------------------
// DRV criterion breakdown
// ---------------------------------------------------------------------------
// Renders the per-category answer table with TableCaption for screen readers.
// All prompts are read from the frozen questionsSnapshot — never the live
// rule-set constant (answers must reflect what was asked at assessment time).

import type {
  QuestionsSnapshot,
  RuleSetQuestion,
  ScheinCategory,
} from '@contractor-ops/classification';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { WorkbenchDataTable } from '../../../table-kit/workbench-data-table.js';

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

type AnswerResult = { label: string; score: string };

function readNotApplicableAnswer(
  raw: { rawScore?: number; isNotApplicable?: boolean },
  t: ReturnType<typeof useTranslations>,
): AnswerResult {
  if (raw.isNotApplicable) {
    return { label: t('outcome.drv.answerNotApplicable'), score: '—' };
  }
  return {
    label: String(raw.rawScore ?? '—'),
    score: String(raw.rawScore ?? '—'),
  };
}

function readValueAnswer(raw: { value: unknown }): AnswerResult | undefined {
  const v = raw.value;
  if (typeof v === 'number') return { label: `${v}%`, score: String(v) };
  if (typeof v === 'string') return { label: v, score: '—' };
  return;
}

function readAnswer(raw: unknown, t: ReturnType<typeof useTranslations>): AnswerResult {
  if (raw === undefined || raw === null) {
    return { label: t('outcome.drv.answerMissing'), score: '—' };
  }
  if (raw === 'yes') return { label: t('yesNo.yes'), score: '—' };
  if (raw === 'no') return { label: t('yesNo.no'), score: '—' };
  if (typeof raw === 'number') return { label: String(raw), score: String(raw) };
  if (typeof raw === 'object' && 'isNotApplicable' in raw) {
    return readNotApplicableAnswer(raw as { rawScore?: number; isNotApplicable?: boolean }, t);
  }
  if (typeof raw === 'object' && 'value' in raw) {
    return (
      readValueAnswer(raw as { value: unknown }) ?? {
        label: t('outcome.drv.answerMissing'),
        score: '—',
      }
    );
  }
  return { label: t('outcome.drv.answerMissing'), score: '—' };
}

type CriterionRow = {
  id: string;
  prompt: string;
  drvReference: string | undefined;
  answerLabel: string;
  answerScore: string;
};

export function DrvCriterionBreakdownList(props: DrvCriterionBreakdownListProps) {
  const { category, categoryLabel, questionsSnapshot, answers, locale } = props;
  const t = useTranslations('Classification');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const data = useMemo<CriterionRow[]>(() => {
    return questionsSnapshot.questions
      .filter(q => q.category === category)
      .map(q => {
        const answer = readAnswer(answers[q.id], t);
        return {
          id: q.id,
          prompt: readPrompt(q, locale),
          drvReference: q.drvReference,
          answerLabel: answer.label,
          answerScore: answer.score,
        };
      });
  }, [questionsSnapshot, category, answers, locale, t]);

  const columns = useMemo<ColumnDef<CriterionRow, unknown>[]>(
    () => [
      {
        id: 'criterion',
        accessorKey: 'prompt',
        header: t('outcome.drv.criterion'),
        cell: ({ row }) => (
          <div className="align-top text-sm">
            <span className="font-medium">{row.original.prompt}</span>
            {row.original.drvReference ? (
              <span className="mt-1 block text-xs text-muted-foreground">
                {row.original.drvReference}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'answer',
        accessorKey: 'answerLabel',
        header: t('outcome.drv.answer'),
        cell: ({ row }) => <span className="align-top text-sm">{row.original.answerLabel}</span>,
      },
      {
        id: 'score',
        accessorKey: 'answerScore',
        header: () => <span className="block text-end">{t('outcome.drv.score')}</span>,
        cell: ({ row }) => (
          <span className="block align-top text-end text-sm tabular-nums">
            {row.original.answerScore}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <div data-testid="drv-criterion-table" data-category={category}>
      <p className="sr-only">{t('outcome.criteriaCaption', { category: categoryLabel })}</p>
      <WorkbenchDataTable
        sectionClassName=""
        columns={columns}
        data={data}
        totalRows={data.length}
        clientPagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={size => {
          setPageSize(size);
          setPageIndex(0);
        }}
        constrainHeight={false}
        hideDensityToggle
        hideChrome
        hideFooter
        getRowId={row => row.id}
        entityLabel={categoryLabel}
        emptyTitle={t('outcome.criteriaCaption', { category: categoryLabel })}
        noResultsTitle={t('outcome.criteriaCaption', { category: categoryLabel })}
      />
    </div>
  );
}
