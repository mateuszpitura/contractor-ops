/**
 * Skonto eligibility pill. Step 11 codemod port from
 * apps/web/src/components/invoices/skonto/skonto-eligibility-pill.tsx:
 *   - `next-intl`         → `../../../i18n/useTranslations.js`
 *   - `@/i18n/typed-keys` → `../../../i18n/typed-keys.js`
 *   - `@/lib/utils`       → `../../../lib/utils.js`
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Clock, MinusCircle, XCircle } from 'lucide-react';
import { tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';

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
    containerClass: 'bg-green-600/10 text-green-800 dark:text-green-400',
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
    containerClass: 'bg-green-600/10 text-green-800 dark:text-green-400',
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

export function SkontoEligibilityPill({ state, className }: SkontoEligibilityPillProps) {
  const t = useTranslations('Payments.skonto.eligibility');
  const presentation = STATE_PRESENTATION[state];
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
