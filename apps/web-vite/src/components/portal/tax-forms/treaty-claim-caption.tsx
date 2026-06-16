import { Info } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { TreatyClaim } from './hooks/use-tax-form-wizard.js';

export interface TreatyClaimCaptionProps {
  treatyClaim: TreatyClaim | null;
  country: string;
}

/**
 * Auto-populated treaty claim line for the W-8 steps. Announced via
 * `aria-live="polite"` so screen-reader users hear the rate/article when it
 * resolves. When no treaty row matches, the 30% statutory default is stated in a
 * warning tone. The adviser-deferred verification note is informational, never an
 * error.
 */
export function TreatyClaimCaption({ treatyClaim, country }: TreatyClaimCaptionProps) {
  const t = useTranslations('TaxFormWizard.treaty');

  const hasTreaty = treatyClaim !== null && treatyClaim.rate < 30 && treatyClaim.article !== null;

  return (
    <div className="space-y-2 rounded-md bg-muted p-4" aria-live="polite">
      {hasTreaty ? (
        <p className="text-sm">
          {t('applied', {
            rate: treatyClaim.rate,
            article: treatyClaim.article ?? '',
            country,
          })}
        </p>
      ) : (
        <p className="text-sm text-warning">{t('noTreaty', { country })}</p>
      )}
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t('adviserNote')}</span>
      </p>
    </div>
  );
}
