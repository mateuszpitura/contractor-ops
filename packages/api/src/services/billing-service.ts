import { prisma } from "@contractor-ops/db";
import { stripe } from "./stripe-client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateCheckoutSessionParams {
  organizationId: string;
  priceId: string;
  stripeCustomerId: string;
  isNewOrg: boolean;
  successUrl: string;
  cancelUrl: string;
}

interface ProrationPreviewParams {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeSubscriptionItemId: string;
  newPriceId: string;
}

interface EnsureStripeCustomerParams {
  organizationId: string;
  email: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertNonEmpty(value: string, name: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`[billing-service] ${name} must not be empty`);
  }
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Get the subscription for an organization from the local DB cache.
 */
export async function getSubscription(organizationId: string) {
  assertNonEmpty(organizationId, "organizationId");

  return prisma.subscription.findUnique({
    where: { organizationId },
  });
}

/**
 * Create a Stripe Checkout session for a new subscription.
 * Includes a 14-day trial for new organizations per D-07.
 * Currency is PLN (grosze) per project convention.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams,
): Promise<{ sessionUrl: string }> {
  assertNonEmpty(params.organizationId, "organizationId");
  assertNonEmpty(params.priceId, "priceId");
  assertNonEmpty(params.stripeCustomerId, "stripeCustomerId");
  assertNonEmpty(params.successUrl, "successUrl");
  assertNonEmpty(params.cancelUrl, "cancelUrl");

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: params.stripeCustomerId,
      currency: "pln",
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: params.isNewOrg ? 14 : undefined,
        metadata: {
          organizationId: params.organizationId,
        },
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    if (!session.url) {
      throw new Error("[billing-service] Checkout session URL is null");
    }

    return { sessionUrl: session.url };
  } catch (error) {
    console.error("[billing-service] createCheckoutSession failed:", error);
    throw error;
  }
}

/**
 * Preview proration costs for a plan change.
 * Returns line items with amounts in grosze (PLN smallest unit).
 */
export async function getProrationPreview(
  params: ProrationPreviewParams,
): Promise<{
  lines: Array<{ description: string; amountGrosze: number }>;
  totalGrosze: number;
}> {
  assertNonEmpty(params.stripeCustomerId, "stripeCustomerId");
  assertNonEmpty(params.stripeSubscriptionId, "stripeSubscriptionId");
  assertNonEmpty(params.stripeSubscriptionItemId, "stripeSubscriptionItemId");
  assertNonEmpty(params.newPriceId, "newPriceId");

  try {
    const preview = await stripe.invoices.createPreview({
      customer: params.stripeCustomerId,
      subscription: params.stripeSubscriptionId,
      subscription_details: {
        items: [
          {
            id: params.stripeSubscriptionItemId,
            price: params.newPriceId,
          },
        ],
        proration_behavior: "create_prorations",
      },
    });

    const lines = (preview.lines?.data ?? []).map((line) => ({
      description: line.description ?? "",
      amountGrosze: line.amount,
    }));

    return {
      lines,
      totalGrosze: preview.total,
    };
  } catch (error) {
    console.error("[billing-service] getProrationPreview failed:", error);
    throw error;
  }
}

/**
 * Create a Stripe Billing Portal session for the customer.
 */
export async function createPortalSession(params: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  assertNonEmpty(params.stripeCustomerId, "stripeCustomerId");
  assertNonEmpty(params.returnUrl, "returnUrl");

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: params.stripeCustomerId,
      return_url: params.returnUrl,
    });

    return { url: session.url };
  } catch (error) {
    console.error("[billing-service] createPortalSession failed:", error);
    throw error;
  }
}

/**
 * Ensure a Stripe customer exists for the organization.
 * If the org already has a subscription with a stripeCustomerId, returns it.
 * Otherwise, creates a new Stripe customer.
 */
export async function ensureStripeCustomer(
  params: EnsureStripeCustomerParams,
): Promise<string> {
  assertNonEmpty(params.organizationId, "organizationId");
  assertNonEmpty(params.email, "email");
  assertNonEmpty(params.name, "name");

  // Check if org already has a subscription with a customer ID
  const existing = await prisma.subscription.findUnique({
    where: { organizationId: params.organizationId },
    select: { stripeCustomerId: true },
  });

  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

  try {
    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: {
        organizationId: params.organizationId,
      },
    });

    return customer.id;
  } catch (error) {
    console.error("[billing-service] ensureStripeCustomer failed:", error);
    throw error;
  }
}
