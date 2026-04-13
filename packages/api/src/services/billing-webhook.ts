import { createLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import { getServerEnv } from '@contractor-ops/validators';
import type Stripe from 'stripe';
import { sendAppEmail } from './app-email.js';
import {
  resolveTierFromPriceId,
  resolveTopUpCredits,
  TIER_CREDIT_ALLOWANCE,
  TRIAL_CREDIT_ALLOWANCE,
} from './billing-constants.js';
import { CacheKeys, invalidate } from './cache.js';
import { dispatch } from './notification-service.js';
import type { NotificationEvent } from './notification-service.js';
import { stripe } from './stripe-client.js';
import type { DbClient } from './types.js';

const log = createLogger({ service: 'billing-webhook' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Prisma transaction client passed from the webhook route's $transaction.
 */
type TxClient = DbClient;

/**
 * Extended Stripe subscription shape that includes period fields.
 * Stripe's webhook payloads include current_period_start/end even though
 * the SDK types for newer API versions may not expose them directly.
 */
interface SubscriptionWithPeriod extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
}

// ---------------------------------------------------------------------------
// Stripe status -> DB enum mapping
// ---------------------------------------------------------------------------

const STRIPE_STATUS_MAP: Record<string, string> = {
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  unpaid: 'UNPAID',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'INCOMPLETE_EXPIRED',
  paused: 'PAUSED',
};

function buildBillingUrl(): string {
  const base = getServerEnv().NEXT_PUBLIC_APP_URL;
  return `${base}/settings?tab=billing`;
}

// ---------------------------------------------------------------------------
// Email helpers for billing-specific emails
// ---------------------------------------------------------------------------

async function sendBillingEmail(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  try {
    await sendAppEmail({
      from: 'Contractor Ops <notifications@contractorhub.io>',
      to: params.to,
      subject: params.subject,
      html: `<p>${params.body}</p><p><a href="${buildBillingUrl()}">Go to billing settings</a></p>`,
    });
  } catch (error) {
    console.error('[billing-webhook] Email send failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Helpers to extract subscription ID from invoice
// ---------------------------------------------------------------------------

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // In newer Stripe API versions, subscription is under parent.subscription_details
  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (parentSub) {
    return typeof parentSub === 'string' ? parentSub : parentSub.id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Route entry point
// ---------------------------------------------------------------------------

/**
 * Routes a verified Stripe event to the appropriate handler.
 * Called within a Prisma transaction from the webhook route.
 */
export async function routeStripeEvent(event: Stripe.Event, tx: TxClient): Promise<void> {
  log.info({ eventId: event.id, eventType: event.type }, 'routing stripe event');
  metrics.increment('billing.event', 1, { eventType: event.type });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        await handleCheckoutCompleted(session, tx);
      } else if (session.mode === 'payment' && session.metadata?.type === 'top_up') {
        await handleTopUpCompleted(session, tx);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as unknown as SubscriptionWithPeriod;
      await handleSubscriptionUpdated(subscription, tx);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription, tx);
      break;
    }

    case 'customer.subscription.trial_will_end': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleTrialWillEnd(subscription, tx);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(invoice, tx);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice, tx);
      break;
    }

    case 'invoice.payment_action_required': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentActionRequired(invoice, tx);
      break;
    }

    case 'customer.subscription.paused': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionPaused(subscription, tx);
      break;
    }

    case 'customer.subscription.resumed': {
      const subscription = event.data.object as unknown as SubscriptionWithPeriod;
      await handleSubscriptionUpdated(subscription, tx);
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      await handleChargeRefunded(charge, tx);
      break;
    }

    default:
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handles checkout.session.completed:
 * 1. Retrieves the full subscription from Stripe
 * 2. Upserts subscription state
 * 3. If trialing, creates initial trial credit ledger entry (D-08)
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  tx: TxClient,
): Promise<void> {
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!subscriptionId) {
    console.error('[stripe-webhook] checkout.session.completed missing subscription ID');
    return;
  }

  const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
  // Cast to include period fields available in webhook payload
  const subscription = subscriptionResponse as unknown as SubscriptionWithPeriod;
  await handleSubscriptionUpdated(subscription, tx);

  // Per D-08: Create initial trial credit ledger for trialing subscriptions
  if (subscription.status === 'trialing') {
    const organizationId = subscription.metadata?.organizationId;
    if (!organizationId) {
      console.error(
        '[stripe-webhook] checkout.session.completed: missing organizationId in metadata',
      );
      return;
    }

    // Dedup: use checkout session ID for uniqueness (guaranteed unique per checkout)
    const trialEventId = `trial_${session.id}`;
    const existingTrial = await tx.ocrCreditLedger.findFirst({
      where: { stripeEventId: trialEventId },
      select: { id: true },
    });

    if (existingTrial) {
      log.info({ subscriptionId, organizationId }, 'trial credits already allocated, skipping');
      return;
    }

    const periodStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000)
      : new Date();
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await tx.ocrCreditLedger.create({
      data: {
        organizationId,
        credits: TRIAL_CREDIT_ALLOWANCE,
        reason: 'TRIAL_ALLOWANCE',
        stripeEventId: trialEventId,
        periodStart,
        periodEnd,
      },
    });

    log.info({ organizationId, credits: TRIAL_CREDIT_ALLOWANCE }, 'trial credits allocated');
  }
}

/**
 * Handles checkout.session.completed for one-time top-up payments.
 * Resolves credits from the price ID and allocates them via the credit service.
 */
async function handleTopUpCompleted(session: Stripe.Checkout.Session, tx: TxClient): Promise<void> {
  const organizationId = session.metadata?.organizationId;
  const priceId = session.metadata?.priceId;

  if (!(organizationId && priceId)) {
    log.error(
      { sessionId: session.id },
      'handleTopUpCompleted: missing organizationId or priceId in metadata',
    );
    return;
  }

  const credits = resolveTopUpCredits(priceId);
  if (!credits) {
    log.error({ priceId, sessionId: session.id }, 'handleTopUpCompleted: unknown top-up price ID');
    return;
  }

  // Dedup: check if we already allocated credits for this session (inside tx for safety)
  const existing = await tx.ocrCreditLedger.findFirst({
    where: { stripeEventId: session.id },
    select: { id: true },
  });

  if (existing) {
    log.info(
      { sessionId: session.id },
      'handleTopUpCompleted: credits already allocated, skipping',
    );
    return;
  }

  const subscription = await tx.subscription.findUnique({
    where: { organizationId },
  });

  if (!subscription) {
    log.error({ organizationId }, 'handleTopUpCompleted: no subscription found for org');
    return;
  }

  await tx.ocrCreditLedger.create({
    data: {
      organizationId,
      credits,
      reason: 'TOP_UP',
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      stripeEventId: session.id,
    },
  });

  // Invalidate credit cache
  void invalidate(CacheKeys.creditBalance(organizationId));

  log.info({ organizationId, credits, sessionId: session.id }, 'top-up credits allocated');
}

/**
 * Upserts subscription state from a Stripe subscription object.
 */
async function handleSubscriptionUpdated(
  subscription: SubscriptionWithPeriod,
  tx: TxClient,
): Promise<void> {
  const organizationId = subscription.metadata?.organizationId;
  if (!organizationId) {
    console.error('[stripe-webhook] handleSubscriptionUpdated: missing organizationId in metadata');
    return;
  }

  const { tier, data } = buildSubscriptionData(subscription, organizationId);

  // Check if tier changed (for notification)
  const previousSub = await tx.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { tier: true },
  });

  await tx.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: { stripeSubscriptionId: subscription.id, ...data },
    update: data,
  });

  void invalidate(CacheKeys.subscription(organizationId), CacheKeys.creditBalance(organizationId));

  // Notify admins when subscription tier changes
  if (previousSub && previousSub.tier !== tier) {
    void notifyAdminsOfTierChange(tx, organizationId, previousSub.tier, tier);
  }
}

function buildSubscriptionData(
  subscription: SubscriptionWithPeriod,
  organizationId: string,
) {
  const status = STRIPE_STATUS_MAP[subscription.status] ?? 'ACTIVE';
  const priceId = subscription.items.data[0]?.price?.id;

  let tier: string;
  try {
    tier = priceId ? resolveTierFromPriceId(priceId) : 'STARTER';
  } catch {
    log.error(
      { priceId, subscriptionId: subscription.id, organizationId },
      'BILLING ALERT: unknown price ID in subscription, defaulting to STARTER - verify Stripe configuration',
    );
    tier = 'STARTER';
  }

  const { periodStart, periodEnd } = resolveSubscriptionPeriod(subscription);

  const data = {
    organizationId,
    stripeCustomerId:
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripeSubscriptionItemId: subscription.items.data[0]?.id ?? null,
    stripePriceId: priceId ?? null,
    tier,
    status,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    seatCount: subscription.items.data[0]?.quantity ?? 1,
  };

  return { tier, status, data };
}

function resolveSubscriptionPeriod(subscription: SubscriptionWithPeriod): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : subscription.start_date
      ? new Date(subscription.start_date * 1000)
      : new Date();

  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : subscription.start_date
      ? new Date((subscription.start_date + 30 * 24 * 60 * 60) * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return { periodStart, periodEnd };
}

async function notifyAdminsOfTierChange(
  tx: TxClient,
  organizationId: string,
  previousTier: string,
  newTier: string,
): Promise<void> {
  const adminMembers = await tx.member.findMany({
    where: { organizationId, role: { in: ['owner', 'admin'] } },
    select: { userId: true },
  });

  const adminUserIds = adminMembers.map((m: { userId: string }) => m.userId);
  if (adminUserIds.length === 0) return;

  void dispatch({
    organizationId,
    type: 'SUBSCRIPTION_CHANGED' as const,
    recipientUserIds: adminUserIds,
    title: 'Subscription plan changed',
    body: `Your plan has been changed from ${previousTier} to ${newTier}.`,
    entityType: 'ORGANIZATION',
    entityId: organizationId,
  }).catch((error: unknown) =>
    console.error('[stripe-webhook] Subscription change notification failed:', error),
  );
}

/**
 * Marks a subscription as CANCELED.
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  tx: TxClient,
): Promise<void> {
  const existing = await tx.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true, organizationId: true },
  });

  if (!existing) {
    log.warn(
      { subscriptionId: subscription.id },
      'handleSubscriptionDeleted: subscription not found in DB, skipping',
    );
    return;
  }

  await tx.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: 'CANCELED' },
  });

  void invalidate(
    CacheKeys.subscription(existing.organizationId),
    CacheKeys.creditBalance(existing.organizationId),
  );
}

/**
 * Stripe sends trial_will_end 3 days before trial expires.
 * Per D-10: Send both in-app notification AND email to billingEmail.
 */
async function handleTrialWillEnd(subscription: Stripe.Subscription, tx: TxClient): Promise<void> {
  const sub = await tx.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: { organization: { select: { billingEmail: true, id: true } } },
  });

  if (!sub?.organization) {
    console.error('[stripe-webhook] handleTrialWillEnd: subscription not found in DB');
    return;
  }

  // Get admin user IDs for in-app notification dispatch
  const adminMembers = await tx.member.findMany({
    where: {
      organizationId: sub.organization.id,
      role: { in: ['owner', 'admin'] },
    },
    select: { userId: true },
  });

  const adminUserIds = adminMembers.map((m: { userId: string }) => m.userId);

  if (adminUserIds.length > 0) {
    // In-app notification via dispatch
    void dispatch({
      organizationId: sub.organization.id,
      type: 'TRIAL_ENDING' as const,
      recipientUserIds: adminUserIds,
      title: 'Trial ending soon',
      body: 'Your trial ends in 3 days. Choose a plan to continue without interruption.',
      entityType: 'ORGANIZATION',
      entityId: sub.organization.id,
    }).catch((error: unknown) =>
      console.error('[stripe-webhook] Trial notification dispatch failed:', error),
    );
  }

  // Per D-10: Also send email to billingEmail
  if (sub.organization.billingEmail) {
    await sendBillingEmail({
      to: sub.organization.billingEmail,
      subject: 'Your Contractor Ops trial ends in 3 days',
      body: 'Your trial ends in 3 days. Choose a plan to continue without interruption.',
    });
  }
}

/**
 * Allocates monthly OCR credits when a subscription invoice is paid.
 * Uses TIER_CREDIT_ALLOWANCE from billing-constants (D-06).
 * Skips the first invoice (credits are allocated via checkout.session.completed).
 */
async function handleInvoicePaid(invoice: Stripe.Invoice, tx: TxClient): Promise<void> {
  // Skip non-subscription invoices and first invoices (trial start)
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);

  if (!subscriptionId || invoice.billing_reason === 'subscription_create') {
    return;
  }

  // Dedup: check if we already allocated credits for this invoice
  const existingAllocation = await tx.ocrCreditLedger.findFirst({
    where: { stripeEventId: invoice.id },
    select: { id: true },
  });

  if (existingAllocation) {
    return;
  }

  const sub = await tx.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!sub?.stripePriceId) {
    console.warn(
      `[stripe-webhook] handleInvoicePaid: subscription ${subscriptionId} not found or missing priceId`,
    );
    return;
  }

  let tier: string;
  try {
    tier = resolveTierFromPriceId(sub.stripePriceId);
  } catch {
    console.warn(`[stripe-webhook] handleInvoicePaid: unknown price ${sub.stripePriceId}`);
    return;
  }

  const credits = TIER_CREDIT_ALLOWANCE[tier as keyof typeof TIER_CREDIT_ALLOWANCE];

  await tx.ocrCreditLedger.create({
    data: {
      organizationId: sub.organizationId,
      credits,
      reason: 'MONTHLY_ALLOWANCE',
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      stripeEventId: invoice.id,
    },
  });
}

/**
 * Updates subscription to PAST_DUE and notifies billing admins.
 */
async function handlePaymentFailed(invoice: Stripe.Invoice, tx: TxClient): Promise<void> {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const sub = await tx.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: { organization: { select: { id: true, billingEmail: true } } },
  });

  if (!sub) return;

  await tx.subscription.update({
    where: { stripeSubscriptionId: subscriptionId },
    data: { status: 'PAST_DUE' },
  });

  void invalidate(
    CacheKeys.subscription(sub.organizationId),
    CacheKeys.creditBalance(sub.organizationId),
  );

  await notifyBillingAdmins(tx, sub, {
    type: 'PAYMENT_FAILED' as const,
    title: 'Payment failed',
    body: 'Payment failed. Update your payment method to continue your subscription.',
    emailSubject: 'Payment failed - action required',
  });
}

/**
 * Handles invoice.payment_action_required (3D Secure / SCA).
 * Notifies admins that payment verification is needed.
 */
async function handlePaymentActionRequired(invoice: Stripe.Invoice, tx: TxClient): Promise<void> {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const sub = await tx.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: { organization: { select: { id: true, billingEmail: true } } },
  });

  if (!sub) return;

  await notifyBillingAdmins(tx, sub, {
    type: 'PAYMENT_ACTION_REQUIRED' as const,
    title: 'Payment verification required',
    body: 'Your bank requires additional verification. Please complete the payment to keep your subscription active.',
    emailSubject: 'Payment verification required',
  });
}

/**
 * Shared helper: notify org admins via in-app dispatch and email the billing contact.
 */
async function notifyBillingAdmins(
  tx: TxClient,
  sub: { organizationId: string; organization?: { id: string; billingEmail: string | null } | null },
  notification: { type: string; title: string; body: string; emailSubject: string },
): Promise<void> {
  const adminMembers = await tx.member.findMany({
    where: { organizationId: sub.organizationId, role: { in: ['owner', 'admin'] } },
    select: { userId: true },
  });

  const adminUserIds = adminMembers.map((m: { userId: string }) => m.userId);

  if (adminUserIds.length > 0) {
    void dispatch({
      organizationId: sub.organizationId,
      type: notification.type as NotificationEvent['type'],
      recipientUserIds: adminUserIds,
      title: notification.title,
      body: notification.body,
      entityType: 'ORGANIZATION',
      entityId: sub.organizationId,
    }).catch((error: unknown) =>
      console.error(`[stripe-webhook] ${notification.type} notification failed:`, error),
    );
  }

  if (sub.organization?.billingEmail) {
    await sendBillingEmail({
      to: sub.organization.billingEmail,
      subject: notification.emailSubject,
      body: notification.body,
    });
  }
}

/**
 * Handles customer.subscription.paused.
 * Marks subscription as PAUSED in DB.
 */
async function handleSubscriptionPaused(
  subscription: Stripe.Subscription,
  tx: TxClient,
): Promise<void> {
  const existing = await tx.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true },
  });

  if (!existing) {
    console.warn(
      `[stripe-webhook] handleSubscriptionPaused: subscription ${subscription.id} not found in DB`,
    );
    return;
  }

  const sub = await tx.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: 'PAUSED' },
  });

  void invalidate(
    CacheKeys.subscription(sub.organizationId),
    CacheKeys.creditBalance(sub.organizationId),
  );

  log.info(
    { subscriptionId: subscription.id, organizationId: sub.organizationId },
    'subscription paused',
  );
}

/**
 * Handles charge.refunded.
 * Logs the refund for audit trail. Does NOT auto-revoke credits because
 * partial refunds and credit reversal are complex — flag for manual review.
 */
async function handleChargeRefunded(charge: Stripe.Charge, tx: TxClient): Promise<void> {
  const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;

  log.warn(
    {
      chargeId: charge.id,
      amountRefunded: charge.amount_refunded,
      customerId: customerId ?? 'unknown',
    },
    'charge refunded - checking for associated credit allocations',
  );

  if (!customerId) return;

  // Find the subscription for this customer to get organizationId + billing period
  const sub = await tx.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: {
      organizationId: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  });

  if (!sub) {
    log.warn({ customerId }, 'refund: no subscription found for customer');
    return;
  }

  // Create audit entry for every refund regardless of payment_intent presence
  const refundEventId = `refund_${charge.id}`;
  const existingRefund = await tx.ocrCreditLedger.findFirst({
    where: { stripeEventId: refundEventId },
    select: { id: true },
  });

  if (existingRefund) {
    log.info({ chargeId: charge.id }, 'refund already processed, skipping');
    return;
  }

  // Create audit entry for the refund (0 credits - just an audit trail)
  // Actual credit reversal requires manual review since partial refunds
  // and subscription vs top-up refunds have different implications
  await tx.ocrCreditLedger.create({
    data: {
      organizationId: sub.organizationId,
      credits: 0,
      reason: 'REFUND_AUDIT',
      stripeEventId: refundEventId,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
    },
  });

  log.warn(
    {
      chargeId: charge.id,
      organizationId: sub.organizationId,
      amountRefundedMinor: charge.amount_refunded,
      paymentIntentId:
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : (charge.payment_intent?.id ?? null),
    },
    'REFUND AUDIT: manual credit reversal may be needed - verify against ledger',
  );
}
