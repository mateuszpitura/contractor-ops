'use client';

import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Clock, MinusCircle, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Skonto eligibility pill — 5 states per UI-SPEC colour table
// ---------------------------------------------------------------------------

export type SkontoEligibilityState =
  | 'ELIGIBLE'
  | 'PAST_DISCOUNT_WINDOW'
  | 'NO_SKONTO_CONFIGURED'
  | 'TAKEN_AT_PAYMENT'
  | 'NOT_TAKEN_AT_PAYMENT';

interface StatePresentation {
  labelKey: string;
  icon: LucideIcon;
  containerClass: string;
}

const STATE_PRESENTATION: Record<SkontoEligibilityState, StatePresentation> = {
  ELIGIBLE: {
    labelKey: 'eligible',
    icon: CheckCircle2,
    containerClass: 'bg-green-600/10 text-green-700 dark:text-green-400',
  },
  PAST_DISCOUNT_WINDOW: {
    labelKey: 'pastWindow',
    icon: Clock,
    containerClass: 'bg-muted text-muted-foreground',
  },
  NO_SKONTO_CONFIGURED: {
    labelKey: 'notConfigured',
    icon: MinusCircle,
    containerClass: 'bg-muted text-muted-foreground',
  },
  TAKEN_AT_PAYMENT: {
    labelKey: 'takenAtPayment',
    icon: CheckCircle2,
    containerClass: 'bg-green-600/10 text-green-700 dark:text-green-400',
  },
  NOT_TAKEN_AT_PAYMENT: {
    labelKey: 'notTakenAtPayment',
    icon: XCircle,
    containerClass: 'bg-muted text-muted-foreground',
  },
};

export interface SkontoEligibilityPillProps {
  state: SkontoEligibilityState;
  className?: string;
}

export function SkontoEligibilityPill({
  state,
  className,
}: SkontoEligibilityPillProps) {
  const t = useTranslations('Payments.skonto.eligibility');
  const presentation = STATE_PRESENTATION[state];
  const Icon = presentation.icon;
  const label = t(presentation.labelKey);

  return (
    <Badge
      variant="secondary"
      className={cn('gap-1', presentation.containerClass, className)}
      aria-label={label}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{label}</span>
    </Badge>
  );
}
