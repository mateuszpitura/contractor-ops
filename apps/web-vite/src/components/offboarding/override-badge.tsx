/**
 * Permanent offboarding override badge. Step 11 codemod port from
 * apps/web/src/components/offboarding/override-badge.tsx:
 *   - `next-intl` → `../../i18n/useTranslations.js`
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { AlertOctagon } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

export interface OverrideMetadata {
  reason: string;
  acknowledged: boolean;
  overriddenByUserId: string;
  overriddenAt: string;
  blockedTaskKind: 'IP_VERIFICATION';
}

export interface OverrideBadgeProps {
  overrideMetadata: OverrideMetadata | null | undefined;
  actorName?: string;
}

export function OverrideBadge({ overrideMetadata, actorName }: OverrideBadgeProps) {
  const t = useTranslations('Offboarding.OverrideBadge');
  if (!overrideMetadata) return null;

  const date = new Date(overrideMetadata.overriddenAt).toLocaleDateString();

  return (
    <Tooltip>
      <TooltipTrigger
        className="inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        aria-label={t('label')}>
        <Badge variant="destructive" className="gap-1.5">
          <AlertOctagon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('label')}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1 text-xs">
          <div>{t('tooltipReason', { reason: overrideMetadata.reason })}</div>
          <div>
            {t('tooltipActor', {
              name: actorName ?? overrideMetadata.overriddenByUserId,
              date,
            })}
          </div>
          <div>{t('tooltipBlockedTask')}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
