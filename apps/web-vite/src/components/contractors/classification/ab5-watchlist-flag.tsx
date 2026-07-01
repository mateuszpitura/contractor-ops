// CA AB5 watchlist flag — advisory only.
//
// A decision-support signal, never a verdict: amber `warning` treatment with a
// tooltip that frames it as "review with your adviser", never an alarming red
// determination. Rendered beside the US classification verdict.

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { AlertTriangle } from 'lucide-react';
import type { ReactElement } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';

export function Ab5WatchlistFlag() {
  const t = useTranslations('UsClassification');
  const label = t('ab5.label');
  const tooltip = t('ab5.tooltip');

  const badge = (
    <Badge variant="warning" data-testid="ab5-watchlist-flag" aria-label={`${label}. ${tooltip}`}>
      <AlertTriangle className="size-3" aria-hidden="true" />
      <span>{label}</span>
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={badge as ReactElement} />
        <TooltipContent aria-label={tooltip} className="max-w-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
