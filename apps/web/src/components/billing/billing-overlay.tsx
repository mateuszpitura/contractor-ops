'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';
import { SoftBlockModal } from './soft-block-modal';
import { TrialBanner } from './trial-banner';

// ---------------------------------------------------------------------------
// Statuses that should trigger the soft-block modal
// ---------------------------------------------------------------------------

const BLOCKED_STATUSES = new Set([
  'CANCELED',
  'UNPAID',
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED',
  'PAUSED',
]);

// ---------------------------------------------------------------------------
// BillingOverlay
// ---------------------------------------------------------------------------
// Client component rendered inside the dashboard layout (server component).
// Queries the subscription status and conditionally renders:
// 1. TrialBanner (last 7 days of trial)
// 2. SoftBlockModal (trial expired, canceled, unpaid, etc.)
// 3. PastDueBanner (payment failed but still has access)
// ---------------------------------------------------------------------------

export function BillingOverlay() {
  const router = useRouter();

  const { data: subscription } = useQuery(trpc.billing.getSubscription.queryOptions());

  const checkoutMutation = useMutation({
    ...trpc.billing.createCheckoutSession.mutationOptions(),
    onSuccess(data) {
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
      toast.success('Done.');
    },

    onError: err => toast.error(err.message),
  });

  // No subscription data yet or no subscription at all -- don't render
  if (!subscription) return null;

  const isTrialing = subscription.status === 'TRIALING';
  const trialEnd = subscription.trialEnd ? new Date(subscription.trialEnd) : null;

  // Trial expired: show soft-block modal
  const isTrialExpired = isTrialing && trialEnd !== null && trialEnd.getTime() < Date.now();

  // Subscription in a blocked state (canceled, unpaid, etc.)
  const isBlocked = BLOCKED_STATUSES.has(subscription.status);

  // Past due: show warning banner but don't block
  const isPastDue = subscription.status === 'PAST_DUE';

  // Trial ending soon: show banner (last 7 days)
  const showTrialBanner = isTrialing && trialEnd !== null && !isTrialExpired;

  function handleUpgrade() {
    router.push('/settings?tab=billing');
  }

  function handleSelectPlan(priceId: string) {
    checkoutMutation.mutate({ priceId });
  }

  return (
    <>
      {!!showTrialBanner && !!trialEnd && (
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        <TrialBanner trialEnd={trialEnd} onUpgrade={handleUpgrade} />
      )}
      {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
      {isPastDue && <PastDueBanner onResolve={handleUpgrade} />}
      {/* biome-ignore lint/nursery/noJsxPropsBind: menu item handler */}
      <SoftBlockModal isOpen={isTrialExpired || isBlocked} onSelectPlan={handleSelectPlan} />
    </>
  );
}

// ---------------------------------------------------------------------------
// PastDueBanner
// ---------------------------------------------------------------------------

function PastDueBanner({ onResolve }: { onResolve: () => void }) {
  const t = useTranslations('Billing.overlay');
  return (
    <div
      role="alert"
      className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-center text-sm text-destructive">
      <span className="font-medium">{t('paymentFailed')}</span> {t('paymentFailedBody')}{' '}
      <button
        type="button"
        onClick={onResolve}
        className="underline font-medium hover:no-underline">
        {t('goToBilling')}
      </button>
    </div>
  );
}
