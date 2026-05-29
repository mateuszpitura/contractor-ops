import { useCallback } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { PlanCtaMode } from './plan-card';
import { PlanCard } from './plan-card';

interface PlanCardItemProps {
  tier: React.ComponentProps<typeof PlanCard>['tier'];
  priceId: string;
  ctaMode: PlanCtaMode;
  isRecommended: boolean;
  onSelectPlan: (priceId: string) => void;
  disabled: boolean;
  compact: boolean | undefined;
}

function PlanCardItem({
  tier,
  priceId,
  ctaMode,
  isRecommended,
  onSelectPlan,
  disabled,
  compact,
}: PlanCardItemProps) {
  const handleSelect = useCallback(() => onSelectPlan(priceId), [onSelectPlan, priceId]);
  return (
    <PlanCard
      tier={tier}
      ctaMode={ctaMode}
      isRecommended={isRecommended}
      onSelect={handleSelect}
      disabled={disabled}
      compact={compact}
    />
  );
}

// ---------------------------------------------------------------------------
// Static plan data (D-01 through D-06)
// ---------------------------------------------------------------------------

const TIER_ORDER = ['STARTER', 'PRO', 'ENTERPRISE'] as const;
type TierId = (typeof TIER_ORDER)[number];

const PLANS: Array<{
  id: TierId;
  name: string;
  basePriceMinor: number;
  seatPriceMinor: number;
  creditAllowance: number;
  features: string[];
  excludedFeatures: string[];
  description: string;
  priceId: string;
}> = [
  {
    id: 'STARTER',
    name: 'Starter',
    basePriceMinor: 9_900, // 99 PLN
    seatPriceMinor: 1_000, // 10 PLN per contractor
    creditAllowance: 20,
    features: [
      'Contractor management',
      'Contracts & documents',
      'Invoice intake & matching',
      'Approval workflows',
      'Payment batching',
    ],
    excludedFeatures: [
      'Integrations (Jira, Linear, Calendar)',
      'OCR invoice parsing',
      'Advanced workflows',
      'Audit log export',
      'API access',
    ],
    description: 'Everything you need to manage contractors',
    priceId: import.meta.env.VITE_STRIPE_PRICE_STARTER ?? '',
  },
  {
    id: 'PRO',
    name: 'Pro',
    basePriceMinor: 29_900, // 299 PLN
    seatPriceMinor: 1_500, // 15 PLN per contractor
    creditAllowance: 100,
    features: [
      'Everything in Starter',
      'Integrations (Jira, Linear, Calendar)',
      'OCR invoice parsing',
      'Advanced workflows',
      'E-signatures',
    ],
    excludedFeatures: ['Audit log export', 'API access'],
    description: 'Integrations, OCR, and advanced workflows',
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRO ?? '',
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    basePriceMinor: 89_900, // 899 PLN
    seatPriceMinor: 2_900, // 29 PLN per contractor
    creditAllowance: 500,
    features: [
      'Everything in Pro',
      'Audit log export',
      'API access',
      'Priority support',
      'Custom onboarding',
    ],
    excludedFeatures: [],
    description: 'Full platform access with audit and API',
    priceId: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE ?? '',
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanComparisonGridProps {
  currentTier?: TierId;
  onSelectPlan: (priceId: string) => void;
  compact?: boolean;
  isSelecting?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCtaMode(planTier: TierId, currentTier: TierId | undefined): PlanCtaMode {
  if (!currentTier) return 'choose';
  if (planTier === currentTier) return 'current';

  const planIndex = TIER_ORDER.indexOf(planTier);
  const currentIndex = TIER_ORDER.indexOf(currentTier);

  return planIndex > currentIndex ? 'upgrade' : 'change';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlanComparisonGrid({
  currentTier,
  onSelectPlan,
  compact,
  isSelecting = false,
}: PlanComparisonGridProps) {
  const t = useTranslations('Billing.planComparison');
  return (
    <div
      role="radiogroup"
      aria-label={t('selectAriaLabel')}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {PLANS.map((plan, index) => (
        <div key={plan.id} className={index === 2 ? 'md:col-span-2 lg:col-span-1' : undefined}>
          <PlanCardItem
            tier={plan}
            priceId={plan.priceId}
            ctaMode={getCtaMode(plan.id, currentTier)}
            isRecommended={plan.id === 'PRO'}
            onSelectPlan={onSelectPlan}
            disabled={!plan.priceId || isSelecting}
            compact={compact}
          />
        </div>
      ))}
    </div>
  );
}

export type { TierId };
export { PLANS, TIER_ORDER };
