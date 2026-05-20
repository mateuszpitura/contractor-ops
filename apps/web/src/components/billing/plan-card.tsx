'use client';

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@contractor-ops/ui/components/shadcn/card';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanTier {
  name: string;
  basePriceMinor: number;
  seatPriceMinor: number;
  creditAllowance: number;
  features: string[];
  excludedFeatures: string[];
  description: string;
}

export type PlanCtaMode = 'choose' | 'upgrade' | 'change' | 'current';

interface PlanCardProps {
  tier: PlanTier;
  ctaMode: PlanCtaMode;
  isRecommended: boolean;
  onSelect: () => void;
  disabled?: boolean;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPLN(minor: number): string {
  return String(minor / 100);
}

const CTA_VARIANTS: Record<PlanCtaMode, 'default' | 'outline'> = {
  choose: 'default',
  upgrade: 'default',
  change: 'outline',
  current: 'outline',
};

const CTA_KEY: Record<
  PlanCtaMode,
  'ctaChoosePlan' | 'ctaUpgradePlan' | 'ctaChangePlan' | 'ctaCurrentPlan'
> = {
  choose: 'ctaChoosePlan',
  upgrade: 'ctaUpgradePlan',
  change: 'ctaChangePlan',
  current: 'ctaCurrentPlan',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlanCard({
  tier,
  ctaMode,
  isRecommended,
  onSelect,
  disabled,
  compact,
}: PlanCardProps) {
  const t = useTranslations('Billing.planCard');
  const isCurrentPlan = ctaMode === 'current';
  const ctaVariant = CTA_VARIANTS[ctaMode];
  const ctaLabel = t(CTA_KEY[ctaMode]);

  return (
    <Card
      role="radio"
      aria-checked={isCurrentPlan}
      tabIndex={0}
      className={cn(
        'flex flex-col transition-shadow',
        isCurrentPlan && 'ring-2 ring-primary',
        isRecommended && !isCurrentPlan && 'ring-2 ring-primary/50',
        compact && 'py-3',
      )}
      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!(isCurrentPlan || disabled)) onSelect();
        }
      }}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{tier.name}</span>
          {isCurrentPlan && <Badge variant="default">{t('currentPlan')}</Badge>}
          {isRecommended && !isCurrentPlan && <Badge variant="success">{t('recommended')}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{tier.description}</p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {/* Price display */}
        <div>
          <span className="font-display text-[28px] font-semibold leading-tight tabular-nums">
            {formatPLN(tier.basePriceMinor)} PLN
          </span>
          <span className="text-sm text-muted-foreground">{t('perMonth')}</span>
        </div>

        <p className="text-sm text-muted-foreground">
          {t('perContractor', { price: formatPLN(tier.seatPriceMinor) })}
        </p>

        <p className="text-sm text-muted-foreground">
          {t('creditsIncluded', { credits: tier.creditAllowance })}
        </p>

        {/* Feature list */}
        <ul className="flex flex-col gap-2">
          {tier.features.map(feature => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              {feature}
            </li>
          ))}
          {!compact &&
            tier.excludedFeatures.map(feature => (
              <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                <X size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {feature}
              </li>
            ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button
          variant={ctaVariant}
          className="w-full"
          disabled={isCurrentPlan || disabled}
          onClick={onSelect}>
          {ctaLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
