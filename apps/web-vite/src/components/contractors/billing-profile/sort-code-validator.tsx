// Phase 63 · Plan 04 · D-01 — Inline VocaLink modulus check button.

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { SortCodeValidationOutcome } from '../hooks/use-sort-code-validation.js';
import { useSortCodeValidation } from '../hooks/use-sort-code-validation.js';

interface SortCodeValidatorProps {
  sortCode: string;
  accountNumber: string;
}

export function SortCodeValidator({ sortCode, accountNumber }: SortCodeValidatorProps) {
  const t = useTranslations('Payments.ukBank');
  const { validate } = useSortCodeValidation();
  const [outcome, setOutcome] = useState<SortCodeValidationOutcome | null>(null);
  const [pending, setPending] = useState(false);
  const requestIdRef = useRef(0);

  const handleValidate = useCallback(async () => {
    const myId = requestIdRef.current + 1;
    requestIdRef.current = myId;

    setOutcome(null);
    setPending(true);
    try {
      const data = await validate(sortCode, accountNumber);
      if (myId === requestIdRef.current) {
        setOutcome(data);
      }
    } finally {
      if (myId === requestIdRef.current) {
        setPending(false);
      }
    }
  }, [validate, sortCode, accountNumber]);

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

function renderBadge(outcome: SortCodeValidationOutcome, t: ReturnType<typeof useTranslations>) {
  if (outcome.status === 'VALID') {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="success" aria-label={t('badgeValidAriaLabel')}>
          <CheckCircle2 aria-hidden="true" className="size-3" />
          {t('badgeValid')}
        </Badge>
        <span className="text-xs text-muted-foreground">{t('validationSuccess')}</span>
      </div>
    );
  }

  if (outcome.status === 'WARN') {
    return (
      <div className="flex items-start gap-2">
        <Badge variant="warning" aria-label={t('badgeWarnAriaLabel')}>
          <ShieldAlert aria-hidden="true" className="size-3" />
          {t('badgeWarn')}
        </Badge>
        <span className="text-xs text-muted-foreground max-w-md">
          {outcome.warnings.length > 0 ? outcome.warnings.join(' · ') : t('validationWarn')}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="destructive" aria-label={t('badgeInvalidAriaLabel')}>
        <XCircle aria-hidden="true" className="size-3" />
        {t('badgeInvalid')}
      </Badge>
      <span className="text-xs text-destructive">{t('validationFail')}</span>
    </div>
  );
}
