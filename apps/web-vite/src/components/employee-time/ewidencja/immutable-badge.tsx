import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { Lock } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';

/**
 * Archived + Lock marker on the current KP §149 snapshot. The lock shape + text
 * convey immutability independent of colour; the tooltip states the retention.
 */
export function ImmutableBadge() {
  const t = useTranslations('Ewidencja');
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge className="gap-1 border-0 bg-blue-500/10 font-normal text-blue-800 dark:text-blue-400">
            <Lock className="h-3 w-3" aria-hidden />
            {t('archived')}
          </Badge>
        }
      />
      <TooltipContent>{t('archivedTooltip')}</TooltipContent>
    </Tooltip>
  );
}
