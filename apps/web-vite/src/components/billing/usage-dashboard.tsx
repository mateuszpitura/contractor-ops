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
import {
  deriveUsageDashboardTier,
  parseUsageDashboard,
  useUsageDashboard,
} from './hooks/use-billing.js';
import { PlanComparisonGrid } from './plan-comparison-grid';
import type { TierId } from './plan-comparison-grid.js';
import { SeatCountCard } from './seat-count-card';
import { TopUpDialog } from './top-up-dialog.js';
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

const noopSelectPlan = (): void => undefined;

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

interface UsageDashboardViewProps {
  parsed: UsageDashboardData;
  currentTier: TierId | null;
}

export function UsageDashboardView({ parsed, currentTier }: UsageDashboardViewProps) {
  const t = useTranslations('Billing.usage');
  const [topUpOpen, setTopUpOpen] = useState(false);
  const handleBuyMore = useCallback(() => setTopUpOpen(true), []);

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
  const creditAllowance = credits?.allowance ?? 0;
  const creditTopUp = credits?.topUp ?? 0;
  const creditUsed = credits?.used ?? 0;
  const creditPool = creditAllowance + creditTopUp;
  const remaining = credits?.balance ?? Math.max(0, creditPool - creditUsed);
  const isLowCredits = creditPool > 0 && remaining / creditPool < 0.2;

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
          used={creditUsed}
          total={creditPool}
          remaining={remaining}
          isLowCredits={isLowCredits}
          onBuyMore={handleBuyMore}
        />

        {/* Card 4: Next Billing Date */}
        <BillingDateCard date={billingDate ?? null} isTrialing={isTrialing} />
      </div>

      <Separator />

      {/* Plan Comparison Grid */}
      <PlanComparisonGrid currentTier={resolvedTier} onSelectPlan={noopSelectPlan} />

      <TopUpDialog open={topUpOpen} onOpenChange={setTopUpOpen} />
    </div>
  );
}

const USAGE_SKELETON_KEYS = ['credits', 'invoices', 'storage', 'seats'] as const;

function UsageDashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {USAGE_SKELETON_KEYS.map(key => (
        <div key={key} className="rounded-xl border p-4 space-y-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </div>
  );
}

export function UsageDashboard() {
  const t = useTranslations('Billing.usage');
  const dashboard = useUsageDashboard();
  const handleRetry = useCallback(() => void dashboard.refetch(), [dashboard.refetch]);

  if (dashboard.isLoading) return <UsageDashboardSkeleton />;

  if (dashboard.isError) {
    return (
      <QueryErrorPanel message={t('errorLoading')} retryLabel={t('retry')} onRetry={handleRetry} />
    );
  }

  const parsed = dashboard.data ? parseUsageDashboard(dashboard.data) : null;
  if (!parsed) return null;

  const currentTier = parsed.subscription ? deriveUsageDashboardTier(parsed.subscription) : null;

  return <UsageDashboardView parsed={parsed} currentTier={currentTier} />;
}
