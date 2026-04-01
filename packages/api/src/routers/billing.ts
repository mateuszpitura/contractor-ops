import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@contractor-ops/db";
import { router } from "../init.js";
import { adminProcedure } from "../middleware/rbac.js";
import { tenantProcedure } from "../middleware/tenant.js";
import {
  getSubscription,
  createCheckoutSession,
  getProrationPreview,
  createPortalSession,
  ensureStripeCustomer,
} from "../services/billing-service.js";
import {
  TIER_CREDIT_ALLOWANCE,
  TRIAL_CREDIT_ALLOWANCE,
} from "../services/billing-constants.js";

// ---------------------------------------------------------------------------
// Static plan configuration (D-01 through D-06)
// ---------------------------------------------------------------------------

const PLAN_CONFIG = {
  tiers: [
    {
      id: "STARTER" as const,
      name: "Starter",
      monthlyPriceGrosze: 35_000, // 350 PLN
      includedSeats: 5,
      monthlyOcrCredits: TIER_CREDIT_ALLOWANCE.STARTER,
      features: [
        "Core contractor management",
        "Invoice processing",
        "Basic approval workflows",
        "Email notifications",
      ],
    },
    {
      id: "PRO" as const,
      name: "Pro",
      monthlyPriceGrosze: 50_000, // 500 PLN
      includedSeats: 15,
      monthlyOcrCredits: TIER_CREDIT_ALLOWANCE.PRO,
      features: [
        "Everything in Starter",
        "Advanced workflows",
        "Slack integration",
        "Jira integration",
        "OCR invoice parsing",
        "Time tracking",
      ],
    },
    {
      id: "ENTERPRISE" as const,
      name: "Enterprise",
      monthlyPriceGrosze: 65_000, // 650 PLN
      includedSeats: 50,
      monthlyOcrCredits: TIER_CREDIT_ALLOWANCE.ENTERPRISE,
      features: [
        "Everything in Pro",
        "Contractor portal",
        "E-signatures",
        "KSeF integration",
        "Calendar sync",
        "Priority support",
      ],
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
      const org = await prisma.organization.findUnique({
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

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      return createCheckoutSession({
        organizationId: ctx.organizationId,
        priceId: input.priceId,
        stripeCustomerId,
        isNewOrg,
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
   * Get static plan configuration for client rendering.
   * Available to all authenticated users (tenantProcedure).
   */
  getPlanConfig: tenantProcedure.query(() => {
    return PLAN_CONFIG;
  }),
});
