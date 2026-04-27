// Phase 74 D-15 — Locale-fallback visual indicator.
//
// Renders a muted "(English)" suffix on rows where the current locale's
// translation is missing and the English value is shown as a fallback.
// Includes a hover-revealed Info icon explaining the fallback semantics
// + an aria-described screen-reader description for a11y.

'use client';

import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface EnglishFallbackIndicatorProps {
  /** The locale the user is viewing the page in (e.g. 'pl' or 'de'). */
  targetLocale: 'pl' | 'de' | 'en';
}

export function EnglishFallbackIndicator({ targetLocale }: EnglishFallbackIndicatorProps) {
  const t = useTranslations('Offboarding.LocaleFallback');
  const localeLabel =
    targetLocale === 'pl' ? 'angielski' : targetLocale === 'de' ? 'Englisch' : 'English';

  return (
    <span
      className="inline-flex items-center gap-1 text-muted-foreground"
      aria-label={t('srDescription', { targetLocale: localeLabel })}>
      <span className="text-xs">{t('suffix')}</span>
      <Tooltip>
        <TooltipTrigger
          className="inline-flex h-3 w-3 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t('srDescription', { targetLocale: localeLabel })}>
          <Info className="h-3 w-3" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{t('srDescription', { targetLocale: localeLabel })}</TooltipContent>
      </Tooltip>
    </span>
  );
}
