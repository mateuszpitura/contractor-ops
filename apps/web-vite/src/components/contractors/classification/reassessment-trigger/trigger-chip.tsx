/**
 * Reassessment-trigger chip.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { RefreshCcw } from 'lucide-react';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { cn } from '../../../../lib/utils.js';

export interface ReassessmentTriggerChipProps {
  count?: number;
  className?: string;
}

export function ReassessmentTriggerChip({ count, className }: ReassessmentTriggerChipProps) {
  const t = useTranslations('Classification.polish.reassessmentTrigger');
  const label = t('chipLabel');
  const tooltip = t('chipTooltip');
  const ariaLabel = count && count > 1 ? `${label} — ${count}` : label;

  return (
    <Badge
      variant="warning"
      className={cn('gap-1.5 py-1 px-2', className)}
      aria-label={ariaLabel}
      data-slot="reassessment-trigger-chip"
      title={tooltip}>
      <RefreshCcw aria-hidden="true" className="size-3.5" />
      <span>{label}</span>
    </Badge>
  );
}
