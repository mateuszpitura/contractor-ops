'use client';

// ---------------------------------------------------------------------------
// Phase 60 · CLASS-08 — ReassessmentTriggerChip
// ---------------------------------------------------------------------------
// Inline chip surfaced on the engagement page whenever a GB engagement has
// one or more OPEN / ACKNOWLEDGED reassessment triggers. Semantic triad:
// shadcn Badge (warning variant) + RefreshCcw lucide icon + i18n label.
// WCAG 1.4.1 — colour is NEVER the sole channel (icon + text always accompany).

import { RefreshCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ReassessmentTriggerChipProps {
  /** If supplied, rendered into the aria-label so assistive tech reads the count. */
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
      title={tooltip}
    >
      <RefreshCcw aria-hidden="true" className="size-3.5" />
      <span>{label}</span>
    </Badge>
  );
}
