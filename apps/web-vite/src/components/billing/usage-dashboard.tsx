import { AtelierEmptyState, PaymentsIllustration, QueryErrorPanel } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Crown, Zap } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { BillingDateCard } from './billing-date-card';
import { CreditCard } from './credit-progress-bar';
import type { UsageDashboardData } from './hooks/use-billing.js';
import { PlanComparisonGrid } from './plan-comparison-grid';
import type { TierId } from './plan-comparison-grid.js';
import { SeatCountCard } from './seat-count-card';
import { TopUpDialogContainer } from './top-up-dialog-container';
import { UsageKpiCard } from './usage-kpi-card';

// ---------------------------------------------------------------------------
// Status badge variant mapping
// ---------------------------------------------------------------------------

const STATUS_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  ACTIVE: 'success',
  TRIALING: 'warning',
  PAST_DUE: 'destructive',
  CANCELED: 'secondary',
  UNPAID: 'destructive',
  INCOMPLETE: 'warning',
  INCOMPLETE_EXPIRED: 'secondary',
  PAUSED: 'secondary',
};

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'Active',
    TRIALING: 'Trial',
    PAST_DUE: 'Past due',
    CANCELED: 'Canceled',
    UNPAID: 'Unpaid',
    INCOMPLETE: 'Incomplete',
    INCOMPLETE_EXPIRED: 'Expired',
    PAUSED: 'Paused',
  };
  return map[status] ?? status;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface UsageDashboardProps {
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  parsed: UsageDashboardData | null;
  currentTier: TierId | null;
}

export function UsageDashboard({
  isLoading,
  isError,
  refetch,
  parsed,
  currentTier,
}: UsageDashboardProps) {
  const t = useTranslations('Billing.usage');
  const [topUpOpen, setTopUpOpen] = useState(false);
  const handleBuyMore = useCallback(() => setTopUpOpen(true), []);

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`usage-${i}`} className="rounded-xl border p-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    );
  }

  // ---- Error state ----
  if (isError) {
    return (
      <QueryErrorPanel message={t('errorLoading')} retryLabel={t('retry')} onRetry={refetch} />
    );
  }

  // ---- Data not yet available (isPending without isFetching, e.g. disabled query) ----
  if (!parsed) return null;

  const { subscription, credits, activeContractors, includedSeats, planConfig } = parsed;

  // ---- No subscription state ----
  if (!subscription) {
    return (
      <AtelierEmptyState
        variant="page"
        illustration={PaymentsIllustration}
        heading={t('noSubscription')}
        body={t('noSubscriptionBody')}
        primaryAction={{
          label: t('choosePlan'),
          href: '/settings?tab=billing',
          icon: Zap,
        }}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  // ---- Derive values ----
  const resolvedTier = currentTier ?? 'STARTER';
  const tierConfig = planConfig?.tiers?.find(tier => tier.id === resolvedTier);
  const seatPriceMinor = tierConfig?.seatPriceMinor ?? 0;
  const isTrialing = subscription.status === 'TRIALING';
  const billingDate = isTrialing ? subscription.trialEnd : subscription.currentPeriodEnd;
  const badgeVariant = STATUS_BADGE_VARIANT[subscription.status] ?? 'secondary';
  const remaining = credits?.balance ?? 0;
  const total = credits?.allowance ?? 0;
  const isLowCredits = total > 0 && remaining / total < 0.2;

  return (
    <div className="space-y-8">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Current Plan */}
        <UsageKpiCard
          icon={<Crown size={16} aria-hidden="true" />}
          label={t('currentPlan')}
          value={
            <div className="flex items-center gap-2">
              <span>{subscription.tier}</span>
              <Badge variant={badgeVariant} className="text-xs">
                {formatStatus(subscription.status)}
              </Badge>
            </div>
          }
        />

        {/* Card 2: Active Seats */}
        <SeatCountCard
          activeContractors={activeContractors}
          includedSeats={includedSeats}
          seatPriceMinor={seatPriceMinor}
        />

        {/* Card 3: OCR Credits */}
        <CreditCard
          used={credits?.used ?? 0}
          total={total}
          isLowCredits={isLowCredits}
          onBuyMore={handleBuyMore}
        />

        {/* Card 4: Next Billing Date */}
        <BillingDateCard date={billingDate ?? null} isTrialing={isTrialing} />
      </div>

      <Separator />

      {/* Plan Comparison Grid */}
      {/* biome-ignore lint/nursery/noJsxPropsBind: menu item handler */}
      <PlanComparisonGrid currentTier={resolvedTier} onSelectPlan={() => undefined} />

      <TopUpDialogContainer open={topUpOpen} onOpenChange={setTopUpOpen} />
    </div>
  );
}
