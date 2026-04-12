import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../init.js";
import { adminProcedure } from "../middleware/rbac.js";
import { tenantProcedure } from "../middleware/tenant.js";
import {
  KNOWN_SUBSCRIPTION_PRICE_IDS,
  KNOWN_TOPUP_PRICE_IDS,
  TIER_CREDIT_ALLOWANCE,
  TRIAL_CREDIT_ALLOWANCE,
} from "../services/billing-constants.js";
import {
  createCheckoutSession,
  createPortalSession,
  createTopUpCheckoutSession,
  ensureStripeCustomer,
  getProrationPreview,
  getSubscription,
  updateSubscriptionSeatCount,
} from "../services/billing-service.js";
import { getCreditBalance } from "../services/credit-service.js";

// ---------------------------------------------------------------------------
// Static plan configuration (D-01 through D-06)
// ---------------------------------------------------------------------------

const PLAN_CONFIG = {
  tiers: [
    {
      id: "STARTER" as const,
      name: "Starter",
      basePriceMinor: 9_900, // 99 PLN base
      seatPriceMinor: 1_000, // 10 PLN per contractor
      monthlyOcrCredits: TIER_CREDIT_ALLOWANCE.STARTER,
      description: "Everything you need to manage contractors",
      features: [
        "Contractor management",
        "Contracts & documents",
        "Invoice intake & matching",
        "Approval workflows",
        "Payment batching",
      ],
      excludedFeatures: [
        "Integrations (Jira, Linear, Calendar)",
        "OCR invoice parsing",
        "Advanced workflows",
        "Audit log export",
        "API access",
      ],
    },
    {
      id: "PRO" as const,
      name: "Pro",
      basePriceMinor: 29_900, // 299 PLN base
      seatPriceMinor: 1_500, // 15 PLN per contractor
      monthlyOcrCredits: TIER_CREDIT_ALLOWANCE.PRO,
      description: "Integrations, OCR, and advanced workflows",
      features: [
        "Everything in Starter",
        "Integrations (Jira, Linear, Calendar)",
        "OCR invoice parsing",
        "Advanced workflows",
        "E-signatures",
      ],
      excludedFeatures: ["Audit log export", "API access"],
    },
    {
      id: "ENTERPRISE" as const,
      name: "Enterprise",
      basePriceMinor: 89_900, // 899 PLN base
      seatPriceMinor: 2_900, // 29 PLN per contractor
      monthlyOcrCredits: TIER_CREDIT_ALLOWANCE.ENTERPRISE,
      description: "Full platform access with audit and API",
      features: [
        "Everything in Pro",
        "Audit log export",
        "API access",
        "Priority support",
        "Custom onboarding",
      ],
      excludedFeatures: [],
    },
  ],
  trialDays: 14,
  trialCredits: TRIAL_CREDIT_ALLOWANCE,
  currency: "PLN",
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const billingRouter = router({
  /**
   * Get the current subscription for the organization.
   */
  getSubscription: tenantProcedure.query(async ({ ctx }) => {
    return getSubscription(ctx.organizationId);
  }),

  /**
   * Create a Stripe Checkout session for a new subscription.
   * Admin-only: only org admins can change billing.
   */
  createCheckoutSession: adminProcedure
    .input(
      z.object({
        priceId: z.string().min(1, "Price ID is required"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!KNOWN_SUBSCRIPTION_PRICE_IDS.has(input.priceId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid subscription price ID",
        });
      }

      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { billingEmail: true, name: true },
      });

      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
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
        where: { organizationId: ctx.organizationId, status: "ACTIVE" },
      });
      const quantity = Math.max(1, contractorCount);

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      return createCheckoutSession({
        organizationId: ctx.organizationId,
        priceId: input.priceId,
        stripeCustomerId,
        isNewOrg,
        quantity,
        successUrl: `${baseUrl}/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/settings?tab=billing`,
      });
    }),

  /**
   * Preview proration costs for a plan change.
   * Admin-only.
   */
  getProrationPreview: adminProcedure
    .input(
      z.object({
        newPriceId: z.string().min(1, "New price ID is required"),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!KNOWN_SUBSCRIPTION_PRICE_IDS.has(input.newPriceId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid subscription price ID",
        });
      }

      const sub = await getSubscription(ctx.organizationId);

      if (!sub) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active subscription found",
        });
      }

      if (!sub.stripeSubscriptionItemId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Subscription item ID not available",
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
        code: "NOT_FOUND",
        message: "No active subscription found",
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    return createPortalSession({
      stripeCustomerId: sub.stripeCustomerId,
      returnUrl: `${baseUrl}/settings?tab=billing`,
    });
  }),

  /**
   * Create a Stripe Checkout session for a one-time credit top-up.
   * Admin-only.
   */
  createTopUpCheckout: adminProcedure
    .input(
      z.object({
        priceId: z.string().min(1, "Price ID is required"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!KNOWN_TOPUP_PRICE_IDS.has(input.priceId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid top-up price ID",
        });
      }

      const sub = await getSubscription(ctx.organizationId);

      if (!sub) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active subscription found. Subscribe to a plan first.",
        });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      return createTopUpCheckoutSession({
        organizationId: ctx.organizationId,
        priceId: input.priceId,
        stripeCustomerId: sub.stripeCustomerId,
        successUrl: `${baseUrl}/settings?tab=billing&topup=success`,
        cancelUrl: `${baseUrl}/settings?tab=billing`,
      });
    }),

  /**
   * Sync the subscription seat count with the current number of active contractors.
   * Admin-only. Call this after adding/removing contractors.
   */
  syncSeatCount: adminProcedure.mutation(async ({ ctx }) => {
    const sub = await getSubscription(ctx.organizationId);

    if (!sub || !sub.stripeSubscriptionItemId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No active subscription with a subscription item found",
      });
    }

    if (sub.status !== "ACTIVE" && sub.status !== "TRIALING") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Subscription is not active",
      });
    }

    const contractorCount = await ctx.db.contractor.count({
      where: { organizationId: ctx.organizationId, status: "ACTIVE" },
    });
    const newQuantity = Math.max(1, contractorCount);

    if (newQuantity === sub.seatCount) {
      return { updated: false, seatCount: sub.seatCount };
    }

    await updateSubscriptionSeatCount({
      stripeSubscriptionId: sub.stripeSubscriptionId,
      stripeSubscriptionItemId: sub.stripeSubscriptionItemId,
      newQuantity,
    });

    return { updated: true, seatCount: newQuantity };
  }),

  /**
   * Get the current OCR credit balance for the organization.
   * Available to all authenticated users (tenantProcedure).
   */
  getCreditBalance: tenantProcedure.query(async ({ ctx }) => {
    return getCreditBalance(ctx.organizationId);
  }),

  /**
   * Get static plan configuration for client rendering.
   * Available to all authenticated users (tenantProcedure).
   */
  getPlanConfig: tenantProcedure.query(() => {
    return PLAN_CONFIG;
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
        where: { organizationId: ctx.organizationId, status: "ACTIVE" },
      }),
    ]);

    const tierConfig = PLAN_CONFIG.tiers.find((t) => t.id === sub?.tier);
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
