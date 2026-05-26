// ---------------------------------------------------------------------------
// ClassificationProgressBar — Radix Progress wrapper with fractional valuenow
// ---------------------------------------------------------------------------
// See UI-SPEC §Interaction 2 (Wizard step indicator + progress bar — a11y
// LOAD-BEARING). aria-valuenow uses fractional step completion so screen
// readers communicate intra-step progress.
//
// Live region (`<span aria-live="polite">`) announces only when the step
// index changes, NOT on every answer change — prevents chatty readback.

import { useEffect, useRef } from 'react';
import { useTranslations } from '../../../../i18n/useTranslations.js';

import { cn } from '../../../../lib/utils.js';

export interface ClassificationProgressBarProps {
  /** 1-based current step index (human-facing). */
  currentStep: number;
  totalSteps: number;
  /** 0..1 — fractional completion of the CURRENT step's questions. */
  currentStepCompletion: number;
  /** Human-readable label for the current step (used in the live region). */
  currentStepLabel: string;
  className?: string;
}

export function ClassificationProgressBar({
  currentStep,
  totalSteps,
  currentStepCompletion,
  currentStepLabel,
  className,
}: ClassificationProgressBarProps) {
  const t = useTranslations('Classification.progress');

  // aria-valuenow: integer part = completed steps, fraction = within-step.
  const valueNow = currentStep - 1 + Math.min(Math.max(currentStepCompletion, 0), 1);

  // Percentage for the visual fill (0..100).
  const _percent = (valueNow / totalSteps) * 100;

  // Live region ref — only announce when step index changes (not on
  // every answer change).
  const prevStepRef = useRef<number | null>(null);
  const liveRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (prevStepRef.current !== currentStep && liveRef.current) {
      liveRef.current.textContent = t('announce', {
        current: currentStep,
        total: totalSteps,
        label: currentStepLabel,
      });
      prevStepRef.current = currentStep;
    }
  }, [currentStep, totalSteps, currentStepLabel, t]);

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div
        role="progressbar"
        aria-valuenow={Number(valueNow.toFixed(2))}
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-label={t('ariaLabel', { current: currentStep, total: totalSteps })}
        className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-[width] duration-200 motion-reduce:transition-none" />
      </div>
      <span ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />
    </div>
  );
}
