// apps/web/src/components/payments/bacs/transliteration-warning-banner.tsx
//
// Phase 63 · Plan 04 · D-06 — Transliteration warning banner.
//
// 0 warnings  -> not rendered.
// 1+ replacements (no `?`) -> warning-tinted banner (review before download).
// Any `?` (unmappable) -> destructive-tinted banner (BACS will reject).

'use client';

import { AlertOctagon, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface TransliterationWarning {
  contractorName: string;
  replaced: string[];
}

interface TransliterationWarningBannerProps {
  warnings: TransliterationWarning[];
}

/**
 * Visual indicator for BACS character-set transliteration outcomes.
 *
 * Returns null (no banner) when there are zero replacements — the file is
 * fully BACS-clean and the user does not need to be alerted.
 */
export function TransliterationWarningBanner({ warnings }: TransliterationWarningBannerProps) {
  const t = useTranslations('Payments.bacs');

  // Tally the replacements + detect any unmappable `?`
  let totalReplaced = 0;
  let hasUnmappable = false;
  for (const w of warnings) {
    totalReplaced += w.replaced.length;
    if (w.replaced.includes('?')) {
      hasUnmappable = true;
    }
  }

  if (totalReplaced === 0) return null;

  if (hasUnmappable) {
    return (
      <Alert
        variant="destructive"
        role="alert"
        aria-label={t('aria.unmappableError')}
        data-testid="transliteration-banner-destructive">
        <AlertOctagon aria-hidden="true" className="size-5" />
        <AlertTitle>{t('unmappableError', { count: totalReplaced })}</AlertTitle>
        <AlertDescription className="mt-2 text-xs">
          {/* Show the first few problematic contractor names so the user can
              edit them upstream and retry. Limit to avoid overwhelming UI. */}
          <ul className="list-disc list-inside space-y-1">
            {warnings
              .filter(w => w.replaced.includes('?'))
              .slice(0, 8)
              .map(w => (
                <li key={w.contractorName}>
                  <span className="font-medium">{w.contractorName}</span>
                  <span className="ms-2 font-mono text-[11px] text-muted-foreground">
                    {w.replaced.join(' ')}
                  </span>
                </li>
              ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  }

  // 1+ replacements but all mappable — warning level only.
  return (
    <Alert
      variant="default"
      role="status"
      aria-label={t('aria.transliterationWarning')}
      className="border-amber-300/50 bg-amber-500/5"
      data-testid="transliteration-banner-warning">
      <AlertTriangle aria-hidden="true" className="size-5 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-700 dark:text-amber-400">
        {t('transliterationWarning', { count: totalReplaced })}
      </AlertTitle>
    </Alert>
  );
}
