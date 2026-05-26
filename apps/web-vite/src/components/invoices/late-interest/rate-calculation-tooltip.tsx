/**
 * Late-interest LPCDA rate tooltip. Step 11 codemod port from
 * apps/web/src/components/invoices/late-interest/rate-calculation-tooltip.tsx:
 *   - `next-intl` → `../../../i18n/useTranslations.js`
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { Info } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';

export function RateCalculationTooltip() {
  const t = useTranslations('Payments.lateInterest');
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              aria-label={t('rateTooltipAriaLabel')}
            />
          }>
          <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-sm">
          <p>{t('rateTooltipExplanation')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
