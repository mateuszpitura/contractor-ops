'use client';

import { cn } from '@contractor-ops/ui/lib/utils';
import { Check } from 'lucide-react';

export interface StepperStep {
  id: string;
  label: string;
  description?: string;
  optional?: boolean;
}

interface StepperProps {
  steps: ReadonlyArray<StepperStep>;
  activeIndex: number;
  completedIndices?: ReadonlyArray<number>;
  onStepClick?: (index: number) => void;
  className?: string;
}

export function Stepper({
  steps,
  activeIndex,
  completedIndices = [],
  onStepClick,
  className,
}: StepperProps) {
  return (
    <ol
      aria-label="Wizard progress"
      className={cn('flex items-center gap-2 overflow-x-auto', className)}>
      {steps.map((step, index) => {
        const isActive = index === activeIndex;
        const isCompleted = completedIndices.includes(index) || index < activeIndex;
        const isClickable = Boolean(onStepClick) && (isCompleted || isActive);

        return (
          <li key={step.id} className="flex flex-1 items-center gap-2 min-w-[8rem]">
            <button
              type="button"
              disabled={!isClickable}
              onClick={isClickable ? () => onStepClick?.(index) : undefined}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 text-start',
                isClickable ? 'cursor-pointer' : 'cursor-default',
              )}>
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isActive && !isCompleted && 'border-primary bg-primary/10 text-primary',
                  !(isActive || isCompleted) && 'border-border bg-card text-muted-foreground',
                )}>
                {isCompleted ? <Check aria-hidden className="size-4" /> : index + 1}
              </span>
              <span className="flex flex-col">
                <span
                  className={cn(
                    'text-xs font-medium leading-tight',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                  {step.label}
                  {step.optional ? (
                    <span className="ms-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      (opt)
                    </span>
                  ) : null}
                </span>
                {step.description ? (
                  <span className="text-[11px] leading-tight text-muted-foreground/80">
                    {step.description}
                  </span>
                ) : null}
              </span>
            </button>
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  'h-px flex-1 transition-colors',
                  isCompleted ? 'bg-primary/60' : 'bg-border/60',
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
