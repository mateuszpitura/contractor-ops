import type { SubscriptionWithPeriod } from '@contractor-ops/billing/webhook';
import {
  buildSubscriptionData,
  getSubscriptionIdFromInvoice,
  handleSubscriptionDeleted as markSubscriptionDeleted,
} from '@contractor-ops/billing/webhook';
import type { SubscriptionTier } from '@contractor-ops/db/generated/prisma/client';
import { createLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import { getServerEnv } from '@contractor-ops/validators';
import type Stripe from 'stripe';
import { sendAppEmail } from './app-email';
import {
  resolveTierFromPriceId,
  resolveTopUpCredits,
  TIER_CREDIT_ALLOWANCE,
  TRIAL_CREDIT_ALLOWANCE,
} from './billing-constants';
import { CacheKeys, invalidate } from './cache';
import type { NotificationEvent } from './notification-service';
import { dispatch } from './notification-service';
import { captureEvent } from './posthog';
import { stripe } from './stripe-client';
import type { DbClient } from './types';

const log = createLogger({ service: 'billing-webhook' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Prisma transaction client passed from the webhook route's $transaction.
 */
type TxClient = DbClient;

function buildBillingUrl(): string {
  const base = getServerEnv().PUBLIC_APP_URL;
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
    log.error({ err: error }, 'email send failed');
  }
}

// ---------------------------------------------------------------------------
// Route entry point
// ---------------------------------------------------------------------------

/**
 * Routes a verified Stripe event to the appropriate handler.
 * Called within a Prisma transaction from the webhook route.
 *
 * Returns a list of pending notification events that the caller MUST
 * dispatch AFTER the transaction commits — never inside it. Dispatching
 * notifications inside the Stripe Serializable tx (a) writes to the
 * unscoped `prisma` connection, escaping the tx isolation boundary,
 * (b) sends user-facing emails/in-app notifications even if the outer
 * tx rolls back, and (c) the previous `void dispatch(...)` form caused
 * unhandled rejection crashes in Node strict mode (Render default).
 */
export async function routeStripeEvent(
  event: Stripe.Event,
  tx: TxClient,
): Promise<NotificationEvent[]> {
  log.info({ eventId: event.id, eventType: event.type }, 'routing stripe event');
  metrics.increment('billing.event', 1, { eventType: event.type });

  const pendingNotifications: NotificationEvent[] = [];

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        await handleCheckoutCompleted(session, tx, pendingNotifications);
        await emitStripeFunnelEvent('checkout_completed', session);
      } else if (session.mode === 'payment' && session.metadata?.type === 'top_up') {
        await handleTopUpCompleted(session, tx);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as unknown as SubscriptionWithPeriod;
      const wasCreate = event.type === 'customer.subscription.created';
      await handleSubscriptionUpdated(subscription, tx, pendingNotifications);
      await emitSubscriptionFunnelEvent(subscription, wasCreate);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription, tx);
      break;
    }

    case 'customer.subscription.trial_will_end': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleTrialWillEnd(subscription, tx, pendingNotifications);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(invoice, tx);
      await emitInvoicePaidFunnelEvent(invoice);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice, tx, pendingNotifications);
      break;
    }

    case 'invoice.payment_action_required': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentActionRequired(invoice, tx, pendingNotifications);
      break;
    }

    case 'customer.subscription.paused': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionPaused(subscription, tx);
      break;
    }

    case 'customer.subscription.resumed': {
      const subscription = event.data.object as unknown as SubscriptionWithPeriod;
      await handleSubscriptionUpdated(subscription, tx, pendingNotifications);
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      await handleChargeRefunded(charge, tx);
      break;
    }

    default:
  }

  return pendingNotifications;
}

/**
 * Dispatches the pending notification events collected during a Stripe
 * webhook transaction. Each dispatch is awaited individually with its
 * own try/catch so a single failing notification never blocks the others.
 *
 * MUST be called only after `prisma.$transaction(routeStripeEvent)`
 * resolves successfully — never inside the transaction.
 */
export async function dispatchStripeWebhookNotifications(
  events: NotificationEvent[],
): Promise<void> {
  for (const event of events) {
    try {
      await dispatch(event);
    } catch (err) {
      log.error(
        { err, notificationType: event.type, organizationId: event.organizationId },
        'stripe webhook notification dispatch failed',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handles checkout.session.completed:
 * 1. Retrieves the full subscription from Stripe
 * 2. Upserts subscription state
 * 3. If trialing, creates initial trial credit ledger entry
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  tx: TxClient,
  pendingNotifications: NotificationEvent[],
): Promise<void> {
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!subscriptionId) {
    log.error({}, 'checkout.session.completed missing subscription ID');
    return;
  }

  const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
  // Cast to include period fields available in webhook payload
  const subscription = subscriptionResponse as unknown as SubscriptionWithPeriod;
  await handleSubscriptionUpdated(subscription, tx, pendingNotifications);

  // Create initial trial credit ledger for trialing subscriptions
  if (subscription.status === 'trialing') {
    const organizationId = subscription.metadata?.organizationId;
    if (!organizationId) {
      log.error({}, 'checkout.session.completed: missing organizationId in metadata');
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
  pendingNotifications: NotificationEvent[],
): Promise<void> {
  const organizationId = subscription.metadata?.organizationId;
  if (!organizationId) {
    log.error({}, 'handleSubscriptionUpdated: missing organizationId in metadata');
    return;
  }

  const { tier, data } = buildSubscriptionData(
    subscription,
    organizationId,
    resolveTierFromPriceId,
    {
      onUnknownPriceId: ({ priceId, subscriptionId, organizationId: orgId }) => {
        log.error(
          { priceId, subscriptionId, organizationId: orgId },
          'BILLING ALERT: unknown price ID in subscription, defaulting to STARTER - verify Stripe configuration',
        );
      },
    },
  );

  // Check if tier changed (for notification)
  const previousSub = await tx.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { tier: true },
  });

  await tx.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: {
      stripeSubscriptionId: subscription.id,
      ...data,
    } as Parameters<typeof tx.subscription.upsert>[0]['create'],
    update: data as Parameters<typeof tx.subscription.upsert>[0]['update'],
  });

  void invalidate(CacheKeys.subscription(organizationId), CacheKeys.creditBalance(organizationId));

  // Queue tier-change notification for after-tx dispatch
  if (previousSub && previousSub.tier !== tier) {
    await queueTierChangeNotification(
      tx,
      organizationId,
      previousSub.tier,
      tier,
      pendingNotifications,
    );
  }
}

/**
 * Builds and queues a tier-change notification. The dispatch itself happens
 * after the Stripe Serializable tx commits (see dispatchStripeWebhookNotifications).
 */
async function queueTierChangeNotification(
  tx: TxClient,
  organizationId: string,
  previousTier: string,
  newTier: string,
  pendingNotifications: NotificationEvent[],
): Promise<void> {
  const adminMembers = await tx.member.findMany({
    where: { organizationId, role: { in: ['owner', 'admin'] } },
    select: { userId: true },
  });

  const adminUserIds = adminMembers.map((m: { userId: string }) => m.userId);
  if (adminUserIds.length === 0) return;

  pendingNotifications.push({
    organizationId,
    type: 'SUBSCRIPTION_CHANGED' as NotificationEvent['type'],
    recipientUserIds: adminUserIds,
    title: 'Subscription plan changed',
    body: `Your plan has been changed from ${previousTier} to ${newTier}.`,
    entityType: 'ORGANIZATION',
    entityId: organizationId,
  });
}

/**
 * Marks a subscription as CANCELED.
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  tx: TxClient,
): Promise<void> {
  const result = await markSubscriptionDeleted(subscription, tx);
  if (!result) {
    log.warn(
      { subscriptionId: subscription.id },
      'handleSubscriptionDeleted: subscription not found in DB, skipping',
    );
    return;
  }

  void invalidate(
    CacheKeys.subscription(result.organizationId),
    CacheKeys.creditBalance(result.organizationId),
  );
}

/**
 * Stripe sends trial_will_end 3 days before trial expires.
 * Sends both in-app notification AND email to billingEmail.
 *
 * The in-app dispatch is queued (not awaited inside the tx) so that the
 * caller can fire it after the Stripe Serializable tx commits.
 */
async function handleTrialWillEnd(
  subscription: Stripe.Subscription,
  tx: TxClient,
  pendingNotifications: NotificationEvent[],
): Promise<void> {
  const sub = await tx.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: { organization: { select: { billingEmail: true, id: true } } },
  });

  if (!sub?.organization) {
    log.error({}, 'handleTrialWillEnd: subscription not found in DB');
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
    pendingNotifications.push({
      organizationId: sub.organization.id,
      type: 'TRIAL_ENDING' as NotificationEvent['type'],
      recipientUserIds: adminUserIds,
      title: 'Trial ending soon',
      body: 'Your trial ends in 3 days. Choose a plan to continue without interruption.',
      entityType: 'ORGANIZATION',
      entityId: sub.organization.id,
    });
  }

  // Also send email to billingEmail
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
 * Uses TIER_CREDIT_ALLOWANCE from billing-constants.
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
    log.warn({ subscriptionId }, 'handleInvoicePaid: subscription not found or missing priceId');
    return;
  }

  let tier: string;
  try {
    tier = resolveTierFromPriceId(sub.stripePriceId);
  } catch {
    log.warn({ priceId: sub.stripePriceId }, 'handleInvoicePaid: unknown price');
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
async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  tx: TxClient,
  pendingNotifications: NotificationEvent[],
): Promise<void> {
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

  await queueBillingAdminNotification(tx, sub, pendingNotifications, {
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
async function handlePaymentActionRequired(
  invoice: Stripe.Invoice,
  tx: TxClient,
  pendingNotifications: NotificationEvent[],
): Promise<void> {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const sub = await tx.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: { organization: { select: { id: true, billingEmail: true } } },
  });

  if (!sub) return;

  await queueBillingAdminNotification(tx, sub, pendingNotifications, {
    type: 'PAYMENT_ACTION_REQUIRED' as const,
    title: 'Payment verification required',
    body: 'Your bank requires additional verification. Please complete the payment to keep your subscription active.',
    emailSubject: 'Payment verification required',
  });
}

/**
 * Shared helper: queue an in-app notification (for after-tx dispatch) and
 * email the billing contact synchronously. The notification is NOT
 * dispatched inside this call because the caller is inside the Stripe
 * Serializable tx — see dispatchStripeWebhookNotifications.
 */
async function queueBillingAdminNotification(
  tx: TxClient,
  sub: {
    organizationId: string;
    organization?: { id: string; billingEmail: string | null } | null;
  },
  pendingNotifications: NotificationEvent[],
  notification: { type: string; title: string; body: string; emailSubject: string },
): Promise<void> {
  const adminMembers = await tx.member.findMany({
    where: { organizationId: sub.organizationId, role: { in: ['owner', 'admin'] } },
    select: { userId: true },
  });

  const adminUserIds = adminMembers.map((m: { userId: string }) => m.userId);

  if (adminUserIds.length > 0) {
    pendingNotifications.push({
      organizationId: sub.organizationId,
      type: notification.type as NotificationEvent['type'],
      recipientUserIds: adminUserIds,
      title: notification.title,
      body: notification.body,
      entityType: 'ORGANIZATION',
      entityId: sub.organizationId,
    });
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
    log.warn(
      { subscriptionId: subscription.id },
      'handleSubscriptionPaused: subscription not found in DB',
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

// ---------------------------------------------------------------------------
// PostHog funnel events (server-side)
// ---------------------------------------------------------------------------
//
// Webhooks identify by `organizationId` (the only stable id Stripe carries
// on its payloads). The launch funnel groups by organization_id, so this is
// the correct distinct_id for these events. When the user-side `signup_*`
// events are aliased to the org's primary user via `aliasAnonToUser` on
// first authenticated app load, PostHog cohorts can still join the two
// streams by `organization_id`.

async function emitStripeFunnelEvent(
  reason: 'checkout_completed',
  session: Stripe.Checkout.Session,
): Promise<void> {
  const organizationId = session.metadata?.organizationId;
  if (!organizationId) return;
  await captureEvent({
    distinctId: organizationId,
    organizationId,
    event: 'stripe_checkout_completed',
    properties: {
      reason,
      stripe_session_id: session.id,
      mode: session.mode,
      currency: session.currency,
      amount_total_minor: session.amount_total,
    },
  });
}

async function emitSubscriptionFunnelEvent(
  subscription: SubscriptionWithPeriod,
  wasCreate: boolean,
): Promise<void> {
  const organizationId = subscription.metadata?.organizationId;
  if (!organizationId) return;

  const status = subscription.status;
  // Map Stripe sub status → funnel events. trial_started fires once on the
  // first trialing sub; paid_converted fires when status transitions to
  // active (i.e. first non-trial paid period). PostHog dedups on event +
  // distinct_id automatically when the consumer queries unique events.
  if (status === 'trialing' && wasCreate) {
    await captureEvent({
      distinctId: organizationId,
      organizationId,
      event: 'trial_started',
      properties: {
        stripe_subscription_id: subscription.id,
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
      },
    });
  } else if (status === 'active') {
    await captureEvent({
      distinctId: organizationId,
      organizationId,
      event: 'paid_converted',
      properties: {
        stripe_subscription_id: subscription.id,
        was_trial: !!subscription.trial_end,
      },
    });
  }
}

async function emitInvoicePaidFunnelEvent(invoice: Stripe.Invoice): Promise<void> {
  // Stripe API ≥ 2025: invoice.parent.subscription_details.metadata carries
  // the organizationId we set during checkout. Fall back to top-level if
  // older payloads arrive (defensive — should not happen in production).
  const organizationId =
    invoice.parent?.subscription_details?.metadata?.organizationId ??
    (invoice as unknown as { metadata?: { organizationId?: string } }).metadata?.organizationId;
  if (!organizationId) return;
  await captureEvent({
    distinctId: organizationId,
    organizationId,
    event: 'invoice_paid',
    properties: {
      stripe_invoice_id: invoice.id,
      amount_paid_minor: invoice.amount_paid,
      currency: invoice.currency,
      billing_reason: invoice.billing_reason,
    },
  });
}
