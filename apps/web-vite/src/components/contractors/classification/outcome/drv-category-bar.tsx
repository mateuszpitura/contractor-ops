// ---------------------------------------------------------------------------
// DRV per-category horizontal bar — Phase 58 Plan 05 Task 1.
// ---------------------------------------------------------------------------
// Horizontal bar with weighted-score fill, threshold markers at 30% and 60%
// of the max weighted score, and an expandable criterion breakdown.
// role="img" + aria-label carry the full semantic information for assistive
// tech (colour is never the sole channel — WCAG 1.4.1).

import type {
  QuestionsSnapshot,
  ScheinCategory,
  ScheinCategoryResult,
  ScheinVerdict,
} from '@contractor-ops/classification';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import { ChevronDown } from 'lucide-react';
import { tDyn, tDynLoose } from '../../../../i18n/typed-keys.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { DrvCriterionBreakdownList } from './drv-criterion-breakdown-list';

type Locale = 'en' | 'pl' | 'de' | 'ar';

export interface DrvCategoryBarProps {
  readonly category: ScheinCategoryResult;
  readonly questionsSnapshot: QuestionsSnapshot;
  readonly answers: Record<string, unknown>;
  readonly locale: Locale;
}

const CATEGORY_STEP_KEY: Record<ScheinCategory, string> = {
  integration: 'integration',
  entrepreneurial: 'entrepreneurial',
  'personal-dep': 'personalDep',
  'economic-dep': 'economicDep',
};

const VERDICT_TONE: Record<ScheinVerdict, { fill: string; text: string }> = {
  green: { fill: 'bg-success', text: 'text-success' },
  amber: { fill: 'bg-warning', text: 'text-warning' },
  red: { fill: 'bg-destructive', text: 'text-destructive' },
};

/**
 * Thresholds expressed as a fraction of the maximum weighted score:
 *   < 30%  → green
 *   ≤ 60%  → amber
 *   > 60%  → red
 * These apply per-category (independent of the overall total-score thresholds
 * which evaluate on the 0-100 normalised total).
 */
export function classifyCategoryVerdict(
  weightedScore: number,
  maxWeightedScore: number,
): ScheinVerdict {
  if (maxWeightedScore <= 0) return 'green';
  const ratio = weightedScore / maxWeightedScore;
  if (ratio < 0.3) return 'green';
  if (ratio <= 0.6) return 'amber';
  return 'red';
}

export function DrvCategoryBar(props: DrvCategoryBarProps) {
  const { category, questionsSnapshot, answers, locale } = props;
  const t = useTranslations('Classification');
  const maxWeightedScore = category.weight * 3; // rawScore ∈ [0..3]
  const verdict = classifyCategoryVerdict(category.weightedScore, maxWeightedScore);
  const tone = VERDICT_TONE[verdict];
  const _fillPercent =
    maxWeightedScore === 0
      ? 0
      : Math.min(100, Math.max(0, (category.weightedScore / maxWeightedScore) * 100));

  const label = tDynLoose(t, 'schein.step', CATEGORY_STEP_KEY[category.category]);
  const levelLabel = tDyn(t, 'outcome.drv.verdict', verdict);
  const ariaLabel = t('outcome.drv.categoryAriaLabel', {
    category: label,
    weighted: category.weightedScore.toFixed(1),
    max: maxWeightedScore.toString(),
    level: levelLabel,
  });

  return (
    <div
      data-testid="drv-category-bar"
      data-category={category.category}
      data-verdict={verdict}
      className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">
            {t('schein.weightLabel', { weight: category.weight })}
          </span>
        </div>
        <div className={['flex flex-col items-end text-sm tabular-nums', tone.text].join(' ')}>
          <span className="font-semibold">
            {t('outcome.drv.categoryScore', {
              weighted: category.weightedScore.toFixed(1),
              max: maxWeightedScore.toString(),
            })}
          </span>
          <span className="text-xs">{levelLabel}</span>
        </div>
      </div>

      <div
        role="img"
        aria-label={ariaLabel}
        className="relative mt-3 h-3 w-full overflow-hidden rounded-full bg-muted print:border print:border-foreground/30"
        data-testid="drv-category-bar-track">
        <span
          className={['block h-full transition-[width]', tone.fill].join(' ')}
          aria-hidden="true"
        />
        {/* Threshold markers at 30% and 60% — visually indicate the
            green/amber/red transitions for sighted users; the aria-label on
            the parent already communicates the classification. */}
        <span
          aria-hidden="true"
          data-testid="drv-threshold-green"
          className="absolute top-0 bottom-0 w-[2px] bg-foreground/40"
          style={{ left: '30%' }}
        />
        <span
          aria-hidden="true"
          data-testid="drv-threshold-amber"
          className="absolute top-0 bottom-0 w-[2px] bg-foreground/40"
          style={{ left: '60%' }}
        />
      </div>

      <Collapsible className="group/drv-breakdown mt-3 print:open">
        <CollapsibleTrigger
          className="flex w-full items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm font-medium hover:bg-muted/40"
          aria-label={t('outcome.drv.criterionBreakdown')}>
          <span>{t('outcome.drv.criterionBreakdown')}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 transition-transform group-data-[state=open]/drv-breakdown:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 print:!block print:animate-none">
          <DrvCriterionBreakdownList
            category={category.category}
            categoryLabel={label}
            questionsSnapshot={questionsSnapshot}
            answers={answers}
            locale={locale}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
