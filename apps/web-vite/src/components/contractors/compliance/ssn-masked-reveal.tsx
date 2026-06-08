import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useCallback, useId } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useRevealSsn } from './hooks/use-reveal-ssn.js';

export interface SsnMaskedRevealProps {
  contractorId: string;
  /** Last four digits of the stored SSN — the only portion ever rendered by default. */
  last4: string;
  /**
   * Whether the active role holds `contractorPii:read`. When false the reveal
   * control is ABSENT (not disabled) — the server gate is the real boundary;
   * this is purely UX (UI-SPEC §B state 2, T-84-06-02).
   */
  canReveal: boolean;
}

/**
 * SSN masked display with a gated, audit-logged reveal (UI-SPEC §B, US-FIELD-02).
 *
 * Default render shows only `•••-••-{last4}`; the full value enters the DOM only
 * after an explicit reveal click resolves the server `contractor.revealSsn` call
 * (T-84-06-01). Reveal is never triggered on hover, focus, or mount.
 */
export function SsnMaskedReveal({ contractorId, last4, canReveal }: SsnMaskedRevealProps) {
  const t = useTranslations('Contractors.compliance.us');
  const id = useId();
  const { reveal, revealedSsn, isPending, isError, reset } = useRevealSsn(contractorId);

  const isRevealed = revealedSsn !== undefined;

  const handleToggle = useCallback(() => {
    if (isRevealed) {
      reset();
      return;
    }
    reveal();
  }, [isRevealed, reveal, reset]);

  const maskedLabel = t('ssnMaskedAriaLabel', { last4 });
  const errorId = `${id}-ssn-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-ssn`} className="text-sm font-medium">
        {t('ssnLabel')}
      </Label>

      <div className="flex flex-wrap items-center gap-3">
        {isRevealed ? (
          <span
            id={`${id}-ssn`}
            className="font-mono text-sm tabular-nums"
            data-testid="ssn-revealed-value">
            {revealedSsn}
          </span>
        ) : (
          <span
            id={`${id}-ssn`}
            className="font-mono text-sm tabular-nums"
            aria-label={maskedLabel}
            data-testid="ssn-masked-value">
            {`•••-••-${last4}`}
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
            <span>{isRevealed ? t('ssnHide') : t('ssnReveal')}</span>
          </Button>
        ) : null}
      </div>

      {isRevealed ? null : <p className="text-xs text-muted-foreground">{t('ssnMaskedHint')}</p>}

      {isError ? (
        <p id={errorId} role="alert" aria-live="polite" className="text-xs text-destructive">
          {t('ssnRevealFailed')}
        </p>
      ) : null}
    </div>
  );
}
