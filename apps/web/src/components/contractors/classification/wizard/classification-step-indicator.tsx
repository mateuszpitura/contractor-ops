'use client';

// ---------------------------------------------------------------------------
// ClassificationStepIndicator — horizontal step breadcrumb
// ---------------------------------------------------------------------------
// See UI-SPEC §Interaction 2. Renders an ordered list of step dots +
// labels with `aria-current="step"` on the active li. On <640px only the
// current label is visible; others collapse to dot-only with sr-only text.

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export interface ClassificationStepIndicatorStep {
  /** Stable key (area or category id). */
  id: string;
  /** Translated step label. */
  label: string;
  /** Optional subtitle (e.g. DRV weight "30% Gewichtung"). */
  subtitle?: string;
}

export interface ClassificationStepIndicatorProps {
  steps: readonly ClassificationStepIndicatorStep[];
  /** 1-based current step. */
  currentStep: number;
  className?: string;
}

export function ClassificationStepIndicator({
  steps,
  currentStep,
  className,
}: ClassificationStepIndicatorProps) {
  const t = useTranslations('Classification.progress');

  return (
    <ol
      role="list"
      aria-label={t('ariaLabel', { current: currentStep, total: steps.length })}
      className={cn('flex items-center gap-2 overflow-x-auto', className)}>
      {steps.map((step, index) => {
        const position = index + 1;
        const visited = position < currentStep;
        const current = position === currentStep;
        const isLabelVisible = current; // always-visible label only for current on <640
        const srFull = t('announce', {
          current: position,
          total: steps.length,
          label: step.label,
        });

        return (
          <li
            key={step.id}
            aria-current={current ? 'step' : undefined}
            className="flex items-center gap-2 whitespace-nowrap">
            <span
              aria-hidden="true"
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
                current && 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/30',
                visited && !current && 'border-primary bg-primary text-primary-foreground',
                !visited && !current && 'border-input text-muted-foreground',
              )}>
              {position}
            </span>
            <span
              className={cn(
                'text-xs',
                current && 'font-semibold text-foreground',
                !current && 'text-muted-foreground',
                !isLabelVisible && 'hidden sm:inline',
              )}>
              {step.label}
              {step.subtitle ? (
                <span className="ms-1 text-[11px] text-muted-foreground">
                  ({step.subtitle})
                </span>
              ) : null}
            </span>
            <span className="sr-only">{srFull}</span>
            {position < steps.length ? (
              <span
                aria-hidden="true"
                className={cn(
                  'hidden h-px w-6 sm:inline-block',
                  visited ? 'bg-primary' : 'bg-border',
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
