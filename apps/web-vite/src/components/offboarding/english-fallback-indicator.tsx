/**
 * Locale-fallback "(English)" indicator. Step 11 codemod port from
 * apps/web/src/components/offboarding/english-fallback-indicator.tsx:
 *   - `next-intl` → `../../i18n/useTranslations.js`
 */

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { Info } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

export interface EnglishFallbackIndicatorProps {
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
