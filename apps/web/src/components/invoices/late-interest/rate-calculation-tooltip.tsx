'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

// ---------------------------------------------------------------------------
// Rate calculation tooltip — LPCDA explanation
// ---------------------------------------------------------------------------

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
