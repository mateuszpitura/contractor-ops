import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useCallback, useId } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { EmployeePiiField } from './hooks/use-reveal-employee-pii.js';
import { useRevealEmployeePii } from './hooks/use-reveal-employee-pii.js';

export interface EmployeePiiMaskedRevealProps {
  /** Worker identity root the encrypted national ID hangs off. */
  workerId: string;
  /** Which national identifier this control reveals. */
  field: EmployeePiiField;
  /** Last four digits of the stored value — the only portion ever shown by default. */
  last4: string;
  /**
   * Whether the active role holds `employeePii:read`. When false the reveal
   * control is ABSENT (not disabled) — the server gate is the real boundary;
   * this is purely UX.
   */
  canReveal: boolean;
}

/** Masked shape per identifier; only the last four are ever rendered by default. */
const MASK: Record<EmployeePiiField, (last4: string) => string> = {
  ssn: last4 => `•••-••-${last4}`,
  pesel: last4 => `•••••••${last4}`,
  iqama: last4 => `••••••${last4}`,
  emiratesId: last4 => `784-••••-•••••••-${last4}`,
};

/**
 * National-ID masked display with a gated, audit-logged reveal.
 *
 * Default render shows only the last four digits; the full value enters the DOM
 * only after an explicit reveal click resolves the server `employee.revealPii`
 * call. Reveal is never triggered on hover, focus, or mount.
 */
export function EmployeePiiMaskedReveal({
  workerId,
  field,
  last4,
  canReveal,
}: EmployeePiiMaskedRevealProps) {
  const t = useTranslations('Employees.compliance.pii');
  const id = useId();
  const { reveal, revealedValue, isPending, isError, reset } = useRevealEmployeePii(
    workerId,
    field,
  );

  const isRevealed = revealedValue !== undefined;

  const handleToggle = useCallback(() => {
    if (isRevealed) {
      reset();
      return;
    }
    reveal();
  }, [isRevealed, reveal, reset]);

  const maskedLabel = t('maskedAriaLabel', { field: t(`${field}Label`), last4 });
  const errorId = `${id}-pii-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-pii`} className="text-sm font-medium">
        {t(`${field}Label`)}
      </Label>

      <div className="flex flex-wrap items-center gap-3">
        {isRevealed ? (
          <span
            id={`${id}-pii`}
            className="font-mono text-sm tabular-nums"
            data-testid="employee-pii-revealed-value">
            {revealedValue}
          </span>
        ) : (
          <span
            id={`${id}-pii`}
            role="img"
            className="font-mono text-sm tabular-nums"
            aria-label={maskedLabel}
            data-testid="employee-pii-masked-value">
            {MASK[field](last4)}
          </span>
        )}

        {canReveal ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-primary"
            onClick={handleToggle}
            disabled={isPending}
            aria-pressed={isRevealed}>
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : isRevealed ? (
              <EyeOff className="size-3.5" aria-hidden />
            ) : (
              <Eye className="size-3.5" aria-hidden />
            )}
            <span>{isRevealed ? t('hide') : t('reveal')}</span>
          </Button>
        ) : null}
      </div>

      {isRevealed ? null : <p className="text-xs text-muted-foreground">{t('maskedHint')}</p>}

      {isError ? (
        <p id={errorId} role="alert" aria-live="polite" className="text-xs text-destructive">
          {t('revealFailed')}
        </p>
      ) : null}
    </div>
  );
}
