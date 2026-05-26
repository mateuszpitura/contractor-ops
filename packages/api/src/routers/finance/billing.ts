import type { Market } from '@contractor-ops/billing';
import { fetchPricingPlans, MARKETS } from '@contractor-ops/billing';
import { getServerEnv } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { adminProcedure } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import {
  KNOWN_SUBSCRIPTION_PRICE_IDS,
  KNOWN_TOPUP_PRICE_IDS,
  TIER_CREDIT_ALLOWANCE,
  TRIAL_CREDIT_ALLOWANCE,
} from '../../services/billing-constants';
import {
  createCheckoutSession,
  createPortalSession,
  createTopUpCheckoutSession,
  ensureStripeCustomer,
  getProrationPreview,
  getSubscription,
} from '../../services/billing-service';
import { getCreditBalance } from '../../services/credit-service';
import { stripe } from '../../services/stripe-client';

// ---------------------------------------------------------------------------
// Static plan configuration (D-01 through D-06)
// ---------------------------------------------------------------------------

const PLAN_CONFIG = {
  tiers: [
    {
      id: 'STARTER' as const,
      name: 'Starter',
      basePriceMinor: 9_900, // 99 PLN base
      seatPriceMinor: 1_000, // 10 PLN per contractor
      monthlyOcrCredits: TIER_CREDIT_ALLOWANCE.STARTER,
      description: 'Everything you need to manage contractors',
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
    },
    {
      id: 'PRO' as const,
      name: 'Pro',
      basePriceMinor: 29_900, // 299 PLN base
      seatPriceMinor: 1_500, // 15 PLN per contractor
      monthlyOcrCredits: TIER_CREDIT_ALLOWANCE.PRO,
      description: 'Integrations, OCR, and advanced workflows',
      features: [
        'Everything in Starter',
        'Integrations (Jira, Linear, Calendar)',
        'OCR invoice parsing',
        'Advanced workflows',
        'E-signatures',
      ],
      excludedFeatures: ['Audit log export', 'API access'],
    },
    {
      id: 'ENTERPRISE' as const,
      name: 'Enterprise',
      basePriceMinor: 89_900, // 899 PLN base
      seatPriceMinor: 2_900, // 29 PLN per contractor
      monthlyOcrCredits: TIER_CREDIT_ALLOWANCE.ENTERPRISE,
      description: 'Full platform access with audit and API',
      features: [
        'Everything in Pro',
        'Audit log export',
        'API access',
        'Priority support',
        'Custom onboarding',
      ],
      excludedFeatures: [],
    },
  ],
  trialDays: 14,
  trialCredits: TRIAL_CREDIT_ALLOWANCE,
  currency: 'PLN',
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const marketSchema = z.enum([...MARKETS] as [Market, ...Market[]]);

export const billingRouter = router({
  /**
   * Get the current subscription for the organization.
   */
  getSubscription: tenantProcedure.query(async ({ ctx }) => {
    return getSubscription(ctx.organizationId);
  }),

  /**
   * List Stripe-canonical pricing plans for a market. Consumed by the in-app
   * billing UI so prices stay in lockstep with the landing page (both call
   * the same `@contractor-ops/billing` fetcher; Stripe is the single source
   * of truth).
   */
  listPricing: tenantProcedure
    .input(z.object({ market: marketSchema }).optional())
    .query(async ({ input }) => {
      const all = await fetchPricingPlans(stripe);
      if (!input?.market) return all;
      return all.filter(p => p.market === input.market);
    }),

  /**
   * Create a Stripe Checkout session for a new subscription.
   * Admin-only: only org admins can change billing.
   */
  createCheckoutSession: adminProcedure
    .input(
      z.object({
        priceId: z.string().min(1, 'Price ID is required'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!KNOWN_SUBSCRIPTION_PRICE_IDS.has(input.priceId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.BILLING_INVALID_SUBSCRIPTION_PRICE_ID,
        });
      }

      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { billingEmail: true, name: true },
      });

      if (!org) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.BILLING_ORGANIZATION_NOT_FOUND,
        });
      }

      const email = org.billingEmail ?? `billing@${ctx.organizationId}.local`;

      const stripeCustomerId = await ensureStripeCustomer({
        organizationId: ctx.organizationId,
        email,
        name: org.name,
      });

      // Check if org already has a subscription (for trial eligibility)
      const existingSub = await getSubscription(ctx.organizationId);
      const isNewOrg = !existingSub;

      // Count active contractors as seat quantity (minimum 1)
      const contractorCount = await ctx.db.contractor.count({
        where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
      });
      const quantity = Math.max(1, contractorCount);

      const baseUrl = getServerEnv().NEXT_PUBLIC_APP_URL;

      const session = await createCheckoutSession({
        organizationId: ctx.organizationId,
        priceId: input.priceId,
        stripeCustomerId,
        isNewOrg,
        quantity,
        successUrl: `${baseUrl}/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/settings?tab=billing`,
      });

      // F-OBS-05 — subscription checkout starts the billing relationship and
      // can change plan tier; admins must be retraceable.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'BILLING_CHECKOUT_SESSION_CREATE',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        newValues: { priceId: input.priceId, quantity, isNewOrg },
        metadata: { stripeCustomerId },
      });

      return session;
    }),

  /**
   * Preview proration costs for a plan change.
   * Admin-only.
   */
  getProrationPreview: adminProcedure
    .input(
      z.object({
        newPriceId: z.string().min(1, 'New price ID is required'),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!KNOWN_SUBSCRIPTION_PRICE_IDS.has(input.newPriceId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.BILLING_INVALID_SUBSCRIPTION_PRICE_ID,
        });
      }

      const sub = await getSubscription(ctx.organizationId);

      if (!sub) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.BILLING_NO_ACTIVE_SUBSCRIPTION,
        });
      }

      if (!sub.stripeSubscriptionItemId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.BILLING_SUBSCRIPTION_ITEM_UNAVAILABLE,
        });
      }

      return getProrationPreview({
        stripeCustomerId: sub.stripeCustomerId,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        stripeSubscriptionItemId: sub.stripeSubscriptionItemId,
        newPriceId: input.newPriceId,
      });
    }),

  /**
   * Create a Stripe Billing Portal session.
   * Admin-only: for managing payment methods, viewing invoices, canceling.
   */
  createPortalSession: adminProcedure.mutation(async ({ ctx }) => {
    const sub = await getSubscription(ctx.organizationId);

    if (!sub) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: E.BILLING_NO_ACTIVE_SUBSCRIPTION,
      });
    }

    const baseUrl = getServerEnv().NEXT_PUBLIC_APP_URL;

    const portal = await createPortalSession({
      stripeCustomerId: sub.stripeCustomerId,
      returnUrl: `${baseUrl}/settings?tab=billing`,
    });

    // F-OBS-05 — billing portal session opens the door to plan changes,
    // payment-method updates, and cancellation. Audit the entry point.
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user?.id ?? null,
      action: 'BILLING_PORTAL_SESSION_CREATE',
      resourceType: 'ORGANIZATION',
      resourceId: ctx.organizationId,
      metadata: { stripeCustomerId: sub.stripeCustomerId },
    });

    return portal;
  }),

  /**
   * Create a Stripe Checkout session for a one-time credit top-up.
   * Admin-only.
   */
  createTopUpCheckout: adminProcedure
    .input(
      z.object({
        priceId: z.string().min(1, 'Price ID is required'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!KNOWN_TOPUP_PRICE_IDS.has(input.priceId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.BILLING_INVALID_TOPUP_PRICE_ID,
        });
      }

      const sub = await getSubscription(ctx.organizationId);

      if (!sub) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.BILLING_NO_SUBSCRIPTION_SUBSCRIBE_FIRST,
        });
      }

      const baseUrl = getServerEnv().NEXT_PUBLIC_APP_URL;

      const topup = await createTopUpCheckoutSession({
        organizationId: ctx.organizationId,
        priceId: input.priceId,
        stripeCustomerId: sub.stripeCustomerId,
        successUrl: `${baseUrl}/settings?tab=billing&topup=success`,
        cancelUrl: `${baseUrl}/settings?tab=billing`,
      });

      // F-OBS-05 — credit top-up is a billed event; audit who initiated.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'BILLING_TOPUP_CHECKOUT_CREATE',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        newValues: { priceId: input.priceId },
        metadata: { stripeCustomerId: sub.stripeCustomerId },
      });

      return topup;
    }),

  /**
   * Aggregated usage dashboard data: subscription, credits, active contractors,
   * included seats, and plan configuration in a single call.
   * Available to all authenticated users (tenantProcedure).
   */
  getUsageDashboard: tenantProcedure.query(async ({ ctx }) => {
    const [sub, credits, activeContractors] = await Promise.all([
      getSubscription(ctx.organizationId),
      getCreditBalance(ctx.organizationId),
      ctx.db.contractor.count({
        where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
      }),
    ]);

    const tierConfig = PLAN_CONFIG.tiers.find(t => t.id === sub?.tier);
    const includedSeats = tierConfig
      ? Math.floor(tierConfig.basePriceMinor / tierConfig.seatPriceMinor)
      : 0;

    return {
      subscription: sub,
      credits,
      activeContractors,
      includedSeats,
      planConfig: PLAN_CONFIG,
    };
  }),
});

export { PLAN_CONFIG };
