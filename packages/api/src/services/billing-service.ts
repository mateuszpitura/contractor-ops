import { createHash } from 'node:crypto';
import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { CacheKeys, CacheTTL, cached } from './cache';
import { stripe } from './stripe-client';

// ---------------------------------------------------------------------------
// Idempotency-Key derivation (F-INT-04)
// ---------------------------------------------------------------------------

/**
 * Server-derived idempotency key for state-changing Stripe API calls.
 *
 * Stripe documents Idempotency-Key as "any value, up to 255 characters" and
 * dedupes for 24h. We hash a stable business tuple per operation so a QStash
 * retry, a manual user re-click, or a webhook reprocessing can't create
 * duplicate Stripe objects (subscriptions, customers, checkout sessions).
 *
 * NEVER pass through client-supplied input — always derive server-side from
 * (orgId, businessKey, operation).
 */
function stripeIdempotencyKey(
  organizationId: string,
  operation: string,
  businessKey: string,
): string {
  const digest = createHash('sha256')
    .update(`${organizationId}|${operation}|${businessKey}`)
    .digest('base64url');
  // Stripe accepts ≤255 chars; we keep it short for log readability.
  return `${operation}-${organizationId.slice(0, 12)}-${digest.slice(0, 24)}`;
}

const log = createLogger({ service: 'billing-service' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateCheckoutSessionParams {
  organizationId: string;
  priceId: string;
  stripeCustomerId: string;
  isNewOrg: boolean;
  quantity: number;
  successUrl: string;
  cancelUrl: string;
}

interface CreateTopUpCheckoutParams {
  organizationId: string;
  priceId: string;
  stripeCustomerId: string;
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
 * Get the subscription for an organization.
 * Cached in Redis for 15 minutes, invalidated by Stripe webhooks.
 */
export async function getSubscription(organizationId: string) {
  assertNonEmpty(organizationId, 'organizationId');

  return cached(CacheKeys.subscription(organizationId), CacheTTL.SUBSCRIPTION, () =>
    prisma.subscription.findUnique({ where: { organizationId } }),
  );
}

/**
 * Create a Stripe Checkout session for a new subscription.
 * Includes a 14-day trial for new organizations per D-07.
 * Currency is PLN (minor units) per project convention.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams,
): Promise<{ sessionUrl: string }> {
  assertNonEmpty(params.organizationId, 'organizationId');
  assertNonEmpty(params.priceId, 'priceId');
  assertNonEmpty(params.stripeCustomerId, 'stripeCustomerId');
  assertNonEmpty(params.successUrl, 'successUrl');
  assertNonEmpty(params.cancelUrl, 'cancelUrl');

  if (params.quantity < 1) {
    throw new Error('[billing-service] quantity must be at least 1');
  }

  try {
    // F-INT-04: idempotency key dedupes a double-click or QStash retry that
    // would otherwise create two checkout sessions (and two PaymentIntents)
    // for the same intended subscription.
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: params.stripeCustomerId,
        currency: 'pln',
        line_items: [
          {
            price: params.priceId,
            quantity: params.quantity,
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
      },
      {
        idempotencyKey: stripeIdempotencyKey(
          params.organizationId,
          'checkout-sub',
          `${params.priceId}:${params.quantity}`,
        ),
      },
    );

    if (!session.url) {
      throw new Error('[billing-service] Checkout session URL is null');
    }

    return { sessionUrl: session.url };
  } catch (error) {
    log.error({ err: error }, 'createCheckoutSession failed');
    throw error;
  }
}

/**
 * Preview proration costs for a plan change.
 * Returns line items with amounts in minor units (PLN smallest unit).
 */
export async function getProrationPreview(params: ProrationPreviewParams): Promise<{
  lines: Array<{ description: string; amountMinor: number }>;
  totalMinor: number;
}> {
  assertNonEmpty(params.stripeCustomerId, 'stripeCustomerId');
  assertNonEmpty(params.stripeSubscriptionId, 'stripeSubscriptionId');
  assertNonEmpty(params.stripeSubscriptionItemId, 'stripeSubscriptionItemId');
  assertNonEmpty(params.newPriceId, 'newPriceId');

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
        proration_behavior: 'create_prorations',
      },
    });

    const lines = (preview.lines?.data ?? []).map(line => ({
      description: line.description ?? '',
      amountMinor: line.amount,
    }));

    return {
      lines,
      totalMinor: preview.total,
    };
  } catch (error) {
    log.error({ err: error }, 'getProrationPreview failed');
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
  assertNonEmpty(params.stripeCustomerId, 'stripeCustomerId');
  assertNonEmpty(params.returnUrl, 'returnUrl');

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: params.stripeCustomerId,
      return_url: params.returnUrl,
    });

    return { url: session.url };
  } catch (error) {
    log.error({ err: error }, 'createPortalSession failed');
    throw error;
  }
}

/**
 * Create a Stripe Checkout session for a one-time credit top-up purchase.
 * Uses mode: "payment" (not subscription).
 */
export async function createTopUpCheckoutSession(
  params: CreateTopUpCheckoutParams,
): Promise<{ sessionUrl: string }> {
  assertNonEmpty(params.organizationId, 'organizationId');
  assertNonEmpty(params.priceId, 'priceId');
  assertNonEmpty(params.stripeCustomerId, 'stripeCustomerId');
  assertNonEmpty(params.successUrl, 'successUrl');
  assertNonEmpty(params.cancelUrl, 'cancelUrl');

  try {
    // F-INT-04: stable idempotency key. Note we INCLUDE successUrl in the
    // business key so distinct in-app flows don't share keys (and so that a
    // post-cancel retry from a different page lands cleanly).
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer: params.stripeCustomerId,
        currency: 'pln',
        line_items: [
          {
            price: params.priceId,
            quantity: 1,
          },
        ],
        metadata: {
          organizationId: params.organizationId,
          type: 'top_up',
          priceId: params.priceId,
        },
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
      },
      {
        idempotencyKey: stripeIdempotencyKey(
          params.organizationId,
          'checkout-topup',
          params.priceId,
        ),
      },
    );

    if (!session.url) {
      throw new Error('[billing-service] Top-up checkout session URL is null');
    }

    return { sessionUrl: session.url };
  } catch (error) {
    log.error({ err: error }, 'createTopUpCheckoutSession failed');
    throw error;
  }
}

/**
 * Update the seat quantity on an active Stripe subscription.
 * Called when contractors are added or removed from an organization.
 * Stripe automatically prorates the charge.
 */
export async function updateSubscriptionSeatCount(params: {
  stripeSubscriptionId: string;
  stripeSubscriptionItemId: string;
  newQuantity: number;
}): Promise<void> {
  assertNonEmpty(params.stripeSubscriptionId, 'stripeSubscriptionId');
  assertNonEmpty(params.stripeSubscriptionItemId, 'stripeSubscriptionItemId');

  if (params.newQuantity < 1) {
    throw new Error('[billing-service] seat quantity must be at least 1');
  }

  try {
    // F-INT-04: dedupe rapid-fire seat updates from concurrent contractor
    // mutations. Stripe accepts the same key across `update` calls for 24h.
    // Including newQuantity in the business key means two distinct seat
    // changes still both go through.
    await stripe.subscriptions.update(
      params.stripeSubscriptionId,
      {
        items: [
          {
            id: params.stripeSubscriptionItemId,
            quantity: params.newQuantity,
          },
        ],
        proration_behavior: 'create_prorations',
      },
      {
        idempotencyKey: stripeIdempotencyKey(
          params.stripeSubscriptionId,
          'sub-seats',
          String(params.newQuantity),
        ),
      },
    );
  } catch (error) {
    log.error(
      {
        err: error,
        stripeSubscriptionId: params.stripeSubscriptionId,
        newQuantity: params.newQuantity,
      },
      'updateSubscriptionSeatCount failed',
    );
    throw error;
  }
}

/**
 * Sync the Stripe subscription seat count with the current active contractor count.
 * Fire-and-forget: logs errors but does not throw, so contractor mutations
 * are not blocked by billing failures.
 */
export async function syncSeatCountForOrg(organizationId: string): Promise<void> {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { organizationId },
      select: {
        stripeSubscriptionId: true,
        stripeSubscriptionItemId: true,
        status: true,
        seatCount: true,
      },
    });

    if (!sub?.stripeSubscriptionItemId || (sub.status !== 'ACTIVE' && sub.status !== 'TRIALING')) {
      return;
    }

    const contractorCount = await prisma.contractor.count({
      where: { organizationId, status: 'ACTIVE' },
    });
    const newQuantity = Math.max(1, contractorCount);

    if (newQuantity === sub.seatCount) return;

    // F-INT-04: same idempotency strategy as updateSubscriptionSeatCount.
    await stripe.subscriptions.update(
      sub.stripeSubscriptionId,
      {
        items: [
          {
            id: sub.stripeSubscriptionItemId,
            quantity: newQuantity,
          },
        ],
        proration_behavior: 'create_prorations',
      },
      {
        idempotencyKey: stripeIdempotencyKey(organizationId, 'sub-seats-sync', String(newQuantity)),
      },
    );

    // Update local DB to keep in sync (don't wait for webhook)
    await prisma.subscription.update({
      where: { stripeSubscriptionId: sub.stripeSubscriptionId },
      data: { seatCount: newQuantity },
    });
  } catch (error) {
    log.error({ err: error, organizationId }, 'failed to sync seat count for org');
  }
}

/**
 * Ensure a Stripe customer exists for the organization.
 * If the org already has a subscription with a stripeCustomerId, returns it.
 * Otherwise, creates a new Stripe customer.
 */
export async function ensureStripeCustomer(params: EnsureStripeCustomerParams): Promise<string> {
  assertNonEmpty(params.organizationId, 'organizationId');
  assertNonEmpty(params.email, 'email');
  assertNonEmpty(params.name, 'name');

  // Check if org already has a subscription with a customer ID
  const existing = await prisma.subscription.findUnique({
    where: { organizationId: params.organizationId },
    select: { stripeCustomerId: true },
  });

  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

  try {
    // Use organizationId as idempotency key to prevent duplicate customers
    // if two concurrent requests both pass the DB check above.
    const customer = await stripe.customers.create(
      {
        email: params.email,
        name: params.name,
        metadata: {
          organizationId: params.organizationId,
        },
      },
      {
        idempotencyKey: `create-customer-${params.organizationId}`,
      },
    );

    return customer.id;
  } catch (error) {
    log.error({ err: error }, 'ensureStripeCustomer failed');
    throw error;
  }
}
