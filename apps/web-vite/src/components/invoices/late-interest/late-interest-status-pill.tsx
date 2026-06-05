/**
 * Late-interest status pill.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import type { LucideIcon } from 'lucide-react';
import { Check, Clock, MinusCircle, Slash } from 'lucide-react';
import { tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';

export type LateInterestStatus = 'NOT_APPLICABLE' | 'ACCRUING' | 'CLAIMED' | 'WAIVED' | 'PAID';

interface StatusPresentation {
  labelKey: string;
  icon: LucideIcon;
  containerClass: string;
}

const STATUS_PRESENTATION: Record<LateInterestStatus, StatusPresentation> = {
  NOT_APPLICABLE: {
    labelKey: 'notApplicable',
    icon: MinusCircle,
    containerClass: 'bg-muted text-muted-foreground',
  },
  ACCRUING: {
    labelKey: 'accruing',
    icon: Clock,
    containerClass: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  },
  CLAIMED: {
    labelKey: 'claimed',
    icon: Check,
    containerClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  },
  WAIVED: {
    labelKey: 'waived',
    icon: Slash,
    containerClass: 'bg-muted text-muted-foreground line-through',
  },
  PAID: {
    labelKey: 'paid',
    icon: Check,
    containerClass: 'bg-green-600/10 text-green-800 dark:text-green-400',
  },
};

export interface LateInterestStatusPillProps {
  status: LateInterestStatus;
  className?: string;
}

export function LateInterestStatusPill({ status, className }: LateInterestStatusPillProps) {
  const t = useTranslations('Payments.lateInterest.status');
  const presentation = STATUS_PRESENTATION[status];
  const Icon = presentation.icon;
  const label = tKey(t, presentation.labelKey);
  return (
    <Badge
      variant="secondary"
      className={cn('gap-1', presentation.containerClass, className)}
      aria-label={label}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{label}</span>
    </Badge>
  );
}
