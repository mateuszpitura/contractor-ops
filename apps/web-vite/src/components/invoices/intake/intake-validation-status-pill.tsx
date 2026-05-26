/**
 * Intake validation status pill. Step 11 codemod port from
 * apps/web/src/components/invoices/intake/intake-validation-status-pill.tsx:
 *   - `next-intl`    → `../../../i18n/useTranslations.js`
 *   - `@/lib/utils`  → `../../../lib/utils.js`
 */

import { AlertTriangle, CheckCircle, ShieldX } from 'lucide-react';
import type { ComponentType } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';

export const VALIDATION_STATUSES = ['VALID', 'WARNINGS', 'INVALID'] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

interface ValidationVisual {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  className: string;
}

const VALIDATION_VISUALS: Record<ValidationStatus, ValidationVisual> = {
  VALID: {
    icon: CheckCircle,
    className: 'bg-green-600/10 text-green-800 dark:text-green-400 dark:bg-green-600/20',
  },
  WARNINGS: {
    icon: AlertTriangle,
    className: 'bg-amber-500/10 text-amber-800 dark:text-amber-400 dark:bg-amber-500/20',
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

export function IntakeValidationStatusPill({ status, className }: IntakeValidationStatusPillProps) {
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
