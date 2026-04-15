'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Sort Code Validator
//
// Phase 63 Plan 04 — inline validate button + result pill for UK sort codes.
// Calls trpc.bacs.validateSortCode to run VocaLink modulus check.
// ---------------------------------------------------------------------------

interface SortCodeValidatorProps {
  sortCode: string;
  accountNumber: string;
}

export function SortCodeValidator({ sortCode, accountNumber }: SortCodeValidatorProps) {
  const t = useTranslations('Payments');
  const [shouldValidate, setShouldValidate] = useState(false);

  // Only validate when we have both fields with correct length
  const canValidate = sortCode.length === 6 && accountNumber.length === 8;

  const validationQuery = useQuery({
    ...trpc.bacs.validateSortCode.queryOptions({
      sortCode: sortCode.replace(/-/g, ''),
      accountNumber,
    }),
    enabled: shouldValidate && canValidate,
  });

  const handleValidate = () => {
    setShouldValidate(true);
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleValidate}
        disabled={!canValidate || validationQuery.isFetching}
      >
        {validationQuery.isFetching && <Loader2 className="mr-2 size-3 animate-spin" />}
        {t('validateSortCode')}
      </Button>

      {/* Result badge */}
      {validationQuery.data && (
        <ValidatorBadge
          status={validationQuery.data.status}
          warnings={validationQuery.data.warnings}
        />
      )}
    </div>
  );
}

function ValidatorBadge({
  status,
  warnings,
}: {
  status: 'VALID' | 'WARN' | 'INVALID';
  warnings: string[];
}) {
  const t = useTranslations('Payments');

  if (status === 'VALID') {
    return (
      <Badge variant="default" className="gap-1" aria-label={t('sortCodeValid')}>
        <CheckCircle className="size-3" />
        {t('sortCodeValid')}
      </Badge>
    );
  }

  if (status === 'WARN') {
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="gap-1 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          aria-label={t('sortCodeWarning')}
        >
          {t('sortCodeWarning')}
        </Badge>
        {warnings.length > 0 && (
          <span className="text-xs text-muted-foreground">{warnings[0]}</span>
        )}
      </div>
    );
  }

  return (
    <Badge variant="destructive" className="gap-1" aria-label={t('sortCodeInvalid')}>
      <XCircle className="size-3" />
      {t('sortCodeInvalid')}
    </Badge>
  );
}
