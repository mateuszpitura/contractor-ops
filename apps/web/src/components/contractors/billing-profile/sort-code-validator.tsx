// apps/web/src/components/contractors/billing-profile/sort-code-validator.tsx
//
// Phase 63 · Plan 04 · D-01 — Inline VocaLink modulus check button.
//
// Validates a UK sort-code + account-number pair via the existing
// `bacs.validateSortCode` tRPC procedure. Renders a status pill with the
// outcome:
//   VALID   -> success badge, "Sort code passed modulus check"
//   WARN    -> warning badge with reason text (exception-category sort codes)
//   INVALID -> destructive badge (regex-level fail; rarely surfaces because
//              Zod blocks non-digit input upstream)

'use client';

import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { trpc } from '@/trpc/init';

interface SortCodeValidatorProps {
  /** Hyphen-free 6-digit sort code from the parent form. */
  sortCode: string;
  /** 8-digit account number from the parent form. */
  accountNumber: string;
}

type ValidationStatus = 'VALID' | 'WARN' | 'INVALID';

interface ValidationOutcome {
  status: ValidationStatus;
  warnings: string[];
}

export function SortCodeValidator({ sortCode, accountNumber }: SortCodeValidatorProps) {
  const t = useTranslations('Payments.ukBank');
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<ValidationOutcome | null>(null);
  const [pending, setPending] = useState(false);
  /**
   * Monotonic request-id ratchet. Each invocation captures its own id; the
   * UI only reflects the most recent invocation's outcome. Without this,
   * a fast double-click (or paste-then-click + immediate input edit) could
   * fire two parallel queries and let the slower one win — overwriting the
   * outcome of the more-recent input. The button is disabled while pending,
   * but clicks queued before React commits the disabled state still slip
   * through inside a single batched update window.
   */
  const requestIdRef = useRef(0);

  // validateSortCode is a tRPC `query` — not a mutation. We invoke it
  // imperatively via the React Query cache (fetchQuery) so validation only
  // runs when the user clicks the button, not on every keystroke.
  const handleValidate = async () => {
    const myId = requestIdRef.current + 1;
    requestIdRef.current = myId;

    setOutcome(null);
    setPending(true);
    try {
      const data = await queryClient.fetchQuery(
        trpc.bacs.validateSortCode.queryOptions({ sortCode, accountNumber }),
      );
      if (myId === requestIdRef.current) {
        setOutcome(data as ValidationOutcome);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      // Format-level errors (5-digit sort code etc.) bubble up via Zod.
      if (myId === requestIdRef.current) {
        setOutcome({ status: 'INVALID', warnings: [message] });
      }
    } finally {
      if (myId === requestIdRef.current) {
        setPending(false);
      }
    }
  };

  const canValidate = sortCode.length === 6 && accountNumber.length === 8;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canValidate || pending}
        onClick={handleValidate}
        data-testid="validate-sort-code-button">
        {pending ? '…' : t('validateButton')}
      </Button>

      {outcome ? renderBadge(outcome, t) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBadge(outcome: ValidationOutcome, t: ReturnType<typeof useTranslations>) {
  if (outcome.status === 'VALID') {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="success" aria-label="Sort code valid">
          <CheckCircle2 aria-hidden="true" className="size-3" />
          VALID
        </Badge>
        <span className="text-xs text-muted-foreground">{t('validationSuccess')}</span>
      </div>
    );
  }

  if (outcome.status === 'WARN') {
    return (
      <div className="flex items-start gap-2">
        <Badge variant="warning" aria-label="Sort code warning">
          <ShieldAlert aria-hidden="true" className="size-3" />
          WARN
        </Badge>
        <span className="text-xs text-muted-foreground max-w-md">
          {outcome.warnings.length > 0 ? outcome.warnings.join(' · ') : t('validationWarn')}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="destructive" aria-label="Sort code invalid">
        <XCircle aria-hidden="true" className="size-3" />
        INVALID
      </Badge>
      <span className="text-xs text-destructive">{t('validationFail')}</span>
    </div>
  );
}
