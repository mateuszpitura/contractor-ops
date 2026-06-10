/**
 * Permanent badge on a MANUAL_COMPLETED deprovisioning step. Mirrors
 * offboarding/override-badge.tsx: category icon + Tooltip showing the rationale
 * + actor + date. Presentational; the rationale comes from the step's
 * manualOverride* columns (read by the run-view hook).
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { CheckCircle2 } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

export interface StepOverrideBadgeProps {
  category: string | null | undefined;
  note: string | null | undefined;
  overriddenByUserId: string | null | undefined;
  overriddenAt: string | Date | null | undefined;
  actorName?: string;
}

export function StepOverrideBadge({
  category,
  note,
  overriddenByUserId,
  overriddenAt,
  actorName,
}: StepOverrideBadgeProps) {
  const t = useTranslations('Idp.StepOverrideBadge');
  if (!(category && overriddenAt)) return null;

  const date = new Date(overriddenAt).toLocaleDateString();

  return (
    <Tooltip>
      <TooltipTrigger
        className="inline-flex items-center gap-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('label')}>
        <Badge variant="secondary" className="gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('label')}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1 text-xs">
          <div>
            {t('tooltipActor', {
              name: actorName ?? overriddenByUserId ?? '',
              date,
            })}
          </div>
          <div>{t('tooltipCategory', { category: t(`category.${category}`) })}</div>
          {note ? <div className="max-w-xs text-muted-foreground">{note}</div> : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
