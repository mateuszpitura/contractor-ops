import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';

export interface TreatyRateCaptionProps {
  /** Treaty article claimed on the row, or null when none resolved. */
  treatyArticle: string | null;
  /** Chapter-3 withholding rate as a whole percent, or null when unresolved. */
  ratePercent: number | null;
  /**
   * True when the recipient has no complete W-8 chain and is reported at the 30%
   * statutory rate. Advisory only — this never blocks filing.
   */
  isStatutory: boolean;
}

/**
 * Per-recipient withholding-basis caption for a 1042-S row. A complete W-8 chain
 * shows the applied treaty rate in a success tone; a missing chain shows the 30%
 * statutory fallback in a warning tone. The warning is decision-support under the
 * §875(d) gate, never a hard block — routing still files the recipient.
 */
export function TreatyRateCaption({
  treatyArticle,
  ratePercent,
  isStatutory,
}: TreatyRateCaptionProps) {
  const t = useTranslations('Tax1042SBatch.treaty');

  if (isStatutory || !treatyArticle) {
    return (
      <p
        className="flex items-start gap-1.5 text-xs text-warning"
        data-basis="statutory"
        aria-live="polite">
        <Badge variant="warning" className="shrink-0">
          <AlertTriangle className="size-3" aria-hidden />
          <span>{t('statutoryBadge')}</span>
        </Badge>
        <span>{t('statutory')}</span>
      </p>
    );
  }

  const rateLabel = ratePercent === null ? '' : `${ratePercent}%`;

  return (
    <p
      className="flex items-start gap-1.5 text-xs text-success"
      data-basis="treaty"
      aria-live="polite">
      <Badge variant="success" className="shrink-0">
        <CheckCircle2 className="size-3" aria-hidden />
        <span>{t('appliedBadge')}</span>
      </Badge>
      <span>{t('applied', { rate: rateLabel, article: treatyArticle })}</span>
    </p>
  );
}
