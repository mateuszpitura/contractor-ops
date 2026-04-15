'use client';

import { AlertOctagon, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// ---------------------------------------------------------------------------
// Transliteration Warning Banner
//
// Phase 63 Plan 04 — shows warnings about character transliteration in BACS
// output. Severity escalates when unmappable '?' characters are present.
// ---------------------------------------------------------------------------

interface TransliterationWarning {
  contractorName: string;
  replaced: string[];
}

interface TransliterationWarningBannerProps {
  warnings: TransliterationWarning[];
}

export function TransliterationWarningBanner({ warnings }: TransliterationWarningBannerProps) {
  // No warnings = don't render
  if (!warnings || warnings.length === 0) {
    return null;
  }

  const hasUnmappable = warnings.some((w) => w.replaced.some((r) => r.includes('?')));

  if (hasUnmappable) {
    return (
      <Alert variant="destructive">
        <AlertOctagon className="size-4" aria-hidden="true" />
        <AlertTitle aria-label="Unmappable character error">
          <UnmappableTitle />
        </AlertTitle>
        <AlertDescription>
          <WarningDetails warnings={warnings} />
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <AlertTitle aria-label="Transliteration warning">
        <TransliterationTitle />
      </AlertTitle>
      <AlertDescription>
        <WarningDetails warnings={warnings} />
      </AlertDescription>
    </Alert>
  );
}

function UnmappableTitle() {
  const t = useTranslations('Payments');
  return <>{t('unmappableCharacterError')}</>;
}

function TransliterationTitle() {
  const t = useTranslations('Payments');
  return <>{t('transliterationWarning')}</>;
}

function WarningDetails({ warnings }: { warnings: TransliterationWarning[] }) {
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {warnings.map((w) => (
        <li key={w.contractorName}>
          <span className="font-medium">{w.contractorName}:</span>{' '}
          {w.replaced.join(', ')}
        </li>
      ))}
    </ul>
  );
}
