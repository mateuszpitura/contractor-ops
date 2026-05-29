import { Check } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StepDefinition {
  id: string;
  label: string;
  shortLabel?: string;
}

interface StepperProps {
  steps: StepDefinition[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

interface StepButtonProps {
  step: StepDefinition;
  index: number;
  isCompleted: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  isClickable: boolean;
  ariaLabel: string;
  onStepClick?: (index: number) => void;
}

function StepButton({
  step,
  index,
  isCompleted,
  isCurrent,
  isFuture,
  isClickable,
  ariaLabel,
  onStepClick,
}: StepButtonProps) {
  const handleClick = useCallback(() => {
    if (isClickable && onStepClick) onStepClick(index);
  }, [isClickable, onStepClick, index]);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isCurrent}
      aria-current={isCurrent ? 'step' : undefined}
      aria-label={ariaLabel}
      tabIndex={isCurrent ? 0 : -1}
      disabled={isFuture}
      onClick={handleClick}
      className={cn(
        'relative flex shrink-0 items-center gap-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 rounded-full',
        isClickable && 'cursor-pointer',
        isFuture && 'cursor-default',
      )}>
      {/* Circle */}
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all',
          isCompleted && 'bg-green-600 text-white dark:bg-green-600',
          isCurrent && 'bg-primary text-primary-foreground',
          isFuture && 'border-2 border-muted-foreground/30 text-muted-foreground',
        )}>
        {isCompleted ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
      </span>

      {/* Label */}
      <span
        className={cn(
          'text-sm font-medium whitespace-nowrap',
          'md:hidden lg:inline',
          isCompleted && 'text-foreground',
          isCurrent && 'text-foreground',
          isFuture && 'text-muted-foreground',
        )}>
        {step.shortLabel ?? step.label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Stepper — custom composition of shadcn primitives
// ---------------------------------------------------------------------------

/**
 * 5-step horizontal stepper (desktop) / vertical (mobile).
 * - Completed: checkmark + success color
 * - Current: number + primary color
 * - Future: outlined + muted
 * - Connectors: solid (completed) / dashed (pending)
 * - Keyboard: arrow keys navigate, Enter selects
 * - ARIA: role="tablist", aria-current="step" for active
 */
export function Stepper({ steps, currentStep, onStepClick, className }: StepperProps) {
  const t = useTranslations('Zatca.stepper');
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!onStepClick) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(currentStep + 1, steps.length - 1);
        if (next < currentStep) return;
        onStepClick(next);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(currentStep - 1, 0);
        onStepClick(prev);
      }
    },
    [onStepClick, currentStep, steps.length],
  );

  return (
    <div
      role="tablist"
      aria-label={t('onboardingProgress')}
      className={cn('flex flex-col gap-2 md:flex-row md:items-center md:gap-0', className)}
      onKeyDown={handleKeyDown}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isFuture = index > currentStep;
        const isClickable = isCompleted && Boolean(onStepClick);

        return (
          <div key={step.id} className="flex items-center gap-0 md:flex-1">
            <StepButton
              step={step}
              index={index}
              isCompleted={isCompleted}
              isCurrent={isCurrent}
              isFuture={isFuture}
              isClickable={isClickable}
              ariaLabel={t('stepAriaLabel', { number: index + 1, label: step.label })}
              onStepClick={onStepClick}
            />

            {/* Connector line (not after last step) */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'hidden md:block md:flex-1 md:mx-2 h-px min-w-4',
                  isCompleted
                    ? 'bg-green-600 dark:bg-green-600'
                    : 'border-t-2 border-dashed border-muted-foreground/30',
                )}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
