'use client';

import { AlertTriangle, CheckCircle, ShieldX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Validation outcome union (maps 1:1 to the
// InvoiceIntakeRequest.validationStatus enum: VALID / WARNINGS / INVALID).
// ---------------------------------------------------------------------------

export const VALIDATION_STATUSES = ['VALID', 'WARNINGS', 'INVALID'] as const;

export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

interface ValidationVisual {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  className: string;
}

const VALIDATION_VISUALS: Record<ValidationStatus, ValidationVisual> = {
  VALID: {
    icon: CheckCircle,
    className: 'bg-green-600/10 text-green-700 dark:text-green-400 dark:bg-green-600/20',
  },
  WARNINGS: {
    icon: AlertTriangle,
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-500/20',
  },
  INVALID: {
    icon: ShieldX,
    className: 'bg-destructive/10 text-destructive',
  },
};

interface IntakeValidationStatusPillProps {
  status: ValidationStatus;
  className?: string;
}

/**
 * Validation-outcome pill. Same color-+-icon-+-text triad as the intake
 * status pill; never signals by colour alone.
 */
export function IntakeValidationStatusPill({
  status,
  className,
}: IntakeValidationStatusPillProps) {
  const t = useTranslations('EInvoice.intake.validation');
  const { icon: Icon, className: tokenClasses } = VALIDATION_VISUALS[status];
  const label = t(status);

  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tokenClasses,
        className,
      )}
      data-validation-status={status}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
