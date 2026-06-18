import { useRouter } from '../../../i18n/navigation.js';
import { useBillingCheckout, useBillingSubscription } from './use-billing.js';

const BLOCKED_STATUSES = new Set([
  'CANCELED',
  'UNPAID',
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED',
  'PAUSED',
]);

export function useBillingOverlay() {
  const router = useRouter();
  const { data: subscription } = useBillingSubscription();
  const checkoutMutation = useBillingCheckout();

  const isTrialing = subscription?.status === 'TRIALING';
  const trialEnd = subscription?.trialEnd ? new Date(subscription.trialEnd) : null;
  const isTrialExpired = isTrialing && trialEnd !== null && trialEnd.getTime() < Date.now();
  const isBlocked = subscription ? BLOCKED_STATUSES.has(subscription.status) : false;
  const isPastDue = subscription?.status === 'PAST_DUE';
  const showTrialBanner = isTrialing && trialEnd !== null && !isTrialExpired;

  const handleUpgrade = () => {
    void router.push('/settings?tab=billing');
  };

  const handleSelectPlan = (priceId: string) => {
    checkoutMutation.mutate({ priceId });
  };

  return {
    subscription,
    showTrialBanner,
    trialEnd,
    isPastDue,
    isTrialExpired,
    isBlocked,
    handleUpgrade,
    handleSelectPlan,
    isSelecting: checkoutMutation.isPending,
  } as const;
}
