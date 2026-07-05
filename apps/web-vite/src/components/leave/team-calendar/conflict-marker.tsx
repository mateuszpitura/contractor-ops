import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { TriangleAlert } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';

interface ConflictMarkerProps {
  count: number;
  teamName?: string | null;
}

/**
 * Overlapping same-team leave marker. The warning-triangle shape is the visible
 * non-colour cue; the "Conflict" label is exposed to assistive tech and the
 * tooltip carries the overlap detail — meaning is never conveyed by colour alone.
 */
export function ConflictMarker({ count, teamName }: ConflictMarkerProps) {
  const t = useTranslations('Leave.calendar');
  const team = teamName ?? t('unassignedTeam');

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex items-center text-destructive">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">{t('conflict')}</span>
          </span>
        }
      />
      <TooltipContent>{t('conflictTooltip', { count, team })}</TooltipContent>
    </Tooltip>
  );
}
