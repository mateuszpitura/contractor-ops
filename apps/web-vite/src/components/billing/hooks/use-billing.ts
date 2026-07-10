import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { TierId } from '../plan-comparison-grid.js';

const TIER_RANK: Record<string, number> = {
  STARTER: 1,
  PRO: 2,
  ENTERPRISE: 3,
};

const PROP_TO_KEY: Record<string, string> = {
  Pro: 'PRO',
  Enterprise: 'ENTERPRISE',
};

export function useBillingSubscription() {
  const trpc = useTRPC();
  return useQuery(trpc.billing.getSubscription.queryOptions());
}

export function useFeatureGate(requiredTier: 'Pro' | 'Enterprise') {
  const { data: subscription, isLoading } = useBillingSubscription();
  const requiredTierKey = PROP_TO_KEY[requiredTier] ?? 'PRO';
  const currentRank = subscription?.tier ? (TIER_RANK[subscription.tier as string] ?? 0) : 0;
  const requiredRank = TIER_RANK[requiredTierKey] ?? 0;
  const isAllowed = !isLoading && !!subscription && currentRank >= requiredRank;

  return { isLoading, isAllowed, subscription } as const;
}

export function useProrationPreview(newPriceId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.billing.getProrationPreview.queryOptions({ newPriceId }));
}

export function useUsageDashboard() {
  const trpc = useTRPC();
  return useQuery(trpc.billing.getUsageDashboard.queryOptions());
}

export function useBillingCheckout(onPlanSelected?: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Billing.billingTab');
  const toasts = useCommonToasts();

  return useMutation({
    ...trpc.billing.createCheckoutSession.mutationOptions(),
    onSuccess(data) {
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
      toast.success(toasts.done());
      queryClient.invalidateQueries(trpc.billing.pathFilter());
      onPlanSelected?.();
    },
    onError() {
      toast.error(t('checkoutFailed'));
    },
  });
}

export function useBillingPortal() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Billing.billingTab');
  const toasts = useCommonToasts();

  return useMutation({
    ...trpc.billing.createPortalSession.mutationOptions(),
    onSuccess(data) {
      if (data.url) {
        window.location.href = data.url;
      }
      toast.success(toasts.done());
      queryClient.invalidateQueries(trpc.billing.pathFilter());
    },
    onError() {
      toast.error(t('portalFailed'));
    },
  });
}

export function useTopUpCheckout() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Billing.topUp');
  const toasts = useCommonToasts();

  const mutation = useMutation({
    ...trpc.billing.createTopUpCheckout.mutationOptions(),
    onSuccess(data) {
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
      toast.success(toasts.done());
      queryClient.invalidateQueries(trpc.billing.pathFilter());
    },
    onError() {
      toast.error(t('errors.checkoutFailed'));
    },
  });

  const checkout = useCallback(
    (selectedBundle: string) => {
      const priceIdMap: Record<string, string> = {
        '10': import.meta.env.VITE_STRIPE_PRICE_TOPUP_10 ?? '',
        '25': import.meta.env.VITE_STRIPE_PRICE_TOPUP_25 ?? '',
        '50': import.meta.env.VITE_STRIPE_PRICE_TOPUP_50 ?? '',
      };
      const priceId = priceIdMap[selectedBundle];
      if (!priceId) {
        toast.error(t('errors.priceNotConfigured'));
        return;
      }
      mutation.mutate({ priceId });
    },
    [mutation, t],
  );

  return { ...mutation, checkout } as const;
}

export function useBillingTab() {
  const t = useTranslations('Billing.billingTab');
  const [searchParams] = useSearchParams();
  const { data: subscription } = useBillingSubscription();
  const checkoutMutation = useBillingCheckout();
  const portalMutation = useBillingPortal();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      toast.success(t('subscriptionUpdated'));
      const url = new URL(window.location.href);
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, t]);

  return {
    subscription,
    checkoutMutation,
    portalMutation,
    t,
  } as const;
}

export type UsageDashboardData = {
  subscription: {
    tier: string;
    status: string;
    trialEnd: string | null;
    currentPeriodEnd: string | null;
    cancelAt: string | null;
  } | null;
  credits: { balance: number; allowance: number; topUp: number; used: number; tier: string };
  activeContractors: number;
  includedSeats: number;
  planConfig: { tiers: Array<{ id: string; seatPriceMinor: number; [key: string]: unknown }> };
};

export function parseUsageDashboard(data: unknown): UsageDashboardData {
  return data as UsageDashboardData;
}

export function deriveUsageDashboardTier(subscription: UsageDashboardData['subscription']): TierId {
  return (subscription?.tier ?? 'STARTER') as TierId;
}
