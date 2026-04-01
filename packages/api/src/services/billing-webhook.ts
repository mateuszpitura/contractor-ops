import type Stripe from "stripe";
import { stripe } from "./stripe-client.js";
import {
  TIER_CREDIT_ALLOWANCE,
  TRIAL_CREDIT_ALLOWANCE,
  resolveTierFromPriceId,
} from "./billing-constants.js";
import { dispatch } from "./notification-service.js";
import { Resend } from "resend";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Prisma transaction client passed from the webhook route's $transaction.
 * Using a permissive type since the exact shape depends on Prisma extensions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

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
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  unpaid: "UNPAID",
  incomplete: "INCOMPLETE",
  incomplete_expired: "INCOMPLETE_EXPIRED",
  paused: "PAUSED",
};

// ---------------------------------------------------------------------------
// Resend client (lazy init for direct billing emails)
// ---------------------------------------------------------------------------

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function buildBillingUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
    const resend = getResend();
    await resend.emails.send({
      from: "Contractor Ops <notifications@contractorhub.io>",
      to: params.to,
      subject: params.subject,
      html: `<p>${params.body}</p><p><a href="${buildBillingUrl()}">Go to billing settings</a></p>`,
    });
  } catch (error) {
    console.error("[billing-webhook] Email send failed:", error);
  }
}

// ---------------------------------------------------------------------------
// Helpers to extract subscription ID from invoice
// ---------------------------------------------------------------------------

function getSubscriptionIdFromInvoice(
  invoice: Stripe.Invoice,
): string | null {
  // In newer Stripe API versions, subscription is under parent.subscription_details
  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (parentSub) {
    return typeof parentSub === "string" ? parentSub : parentSub.id;
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
export async function routeStripeEvent(
  event: Stripe.Event,
  tx: TxClient,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        await handleCheckoutCompleted(session, tx);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data
        .object as unknown as SubscriptionWithPeriod;
      await handleSubscriptionUpdated(subscription, tx);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription, tx);
      break;
    }

    case "customer.subscription.trial_will_end": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleTrialWillEnd(subscription, tx);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(invoice, tx);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice, tx);
      break;
    }

    default:
      console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
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
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    console.error(
      "[stripe-webhook] checkout.session.completed missing subscription ID",
    );
    return;
  }

  const subscriptionResponse =
    await stripe.subscriptions.retrieve(subscriptionId);
  // Cast to include period fields available in webhook payload
  const subscription =
    subscriptionResponse as unknown as SubscriptionWithPeriod;
  await handleSubscriptionUpdated(subscription, tx);

  // Per D-08: Create initial trial credit ledger for trialing subscriptions
  if (subscription.status === "trialing") {
    const organizationId = subscription.metadata?.organizationId;
    if (!organizationId) {
      console.error(
        "[stripe-webhook] checkout.session.completed: missing organizationId in metadata",
      );
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
        reason: "TRIAL_ALLOWANCE",
        periodStart,
        periodEnd,
      },
    });
  }
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
    console.error(
      "[stripe-webhook] handleSubscriptionUpdated: missing organizationId in metadata",
    );
    return;
  }

  const status = STRIPE_STATUS_MAP[subscription.status] ?? "ACTIVE";
  const priceId = subscription.items.data[0]?.price?.id;
  let tier: string;

  try {
    tier = priceId ? resolveTierFromPriceId(priceId) : "STARTER";
  } catch {
    console.warn(
      `[stripe-webhook] Unknown price ID ${priceId}, defaulting to STARTER`,
    );
    tier = "STARTER";
  }

  // Period dates from subscription (webhook payloads include these)
  const currentPeriodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : new Date(subscription.start_date * 1000);
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : new Date(
        (subscription.start_date + 30 * 24 * 60 * 60) * 1000,
      );

  const data = {
    organizationId,
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    stripeSubscriptionItemId: subscription.items.data[0]?.id ?? null,
    stripePriceId: priceId ?? null,
    tier,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    trialEnd: subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    seatCount: subscription.items.data[0]?.quantity ?? 1,
  };

  await tx.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: {
      stripeSubscriptionId: subscription.id,
      ...data,
    },
    update: data,
  });
}

/**
 * Marks a subscription as CANCELED.
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  tx: TxClient,
): Promise<void> {
  await tx.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: "CANCELED" },
  });
}

/**
 * Stripe sends trial_will_end 3 days before trial expires.
 * Per D-10: Send both in-app notification AND email to billingEmail.
 */
async function handleTrialWillEnd(
  subscription: Stripe.Subscription,
  tx: TxClient,
): Promise<void> {
  const sub = await tx.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: { organization: { select: { billingEmail: true, id: true } } },
  });

  if (!sub?.organization) {
    console.error(
      "[stripe-webhook] handleTrialWillEnd: subscription not found in DB",
    );
    return;
  }

  // Get admin user IDs for in-app notification dispatch
  const adminMembers = await tx.member.findMany({
    where: {
      organizationId: sub.organization.id,
      role: { in: ["owner", "admin"] },
    },
    select: { userId: true },
  });

  const adminUserIds = adminMembers.map(
    (m: { userId: string }) => m.userId,
  );

  if (adminUserIds.length > 0) {
    // In-app notification via dispatch
    void dispatch({
      organizationId: sub.organization.id,
      type: "TRIAL_ENDING" as const,
      recipientUserIds: adminUserIds,
      title: "Trial ending soon",
      body: "Your trial ends in 3 days. Choose a plan to continue without interruption.",
      entityType: "ORGANIZATION",
      entityId: sub.organization.id,
    }).catch((error: unknown) =>
      console.error(
        "[stripe-webhook] Trial notification dispatch failed:",
        error,
      ),
    );
  }

  // Per D-10: Also send email to billingEmail
  if (sub.organization.billingEmail) {
    await sendBillingEmail({
      to: sub.organization.billingEmail,
      subject: "Your Contractor Ops trial ends in 3 days",
      body: "Your trial ends in 3 days. Choose a plan to continue without interruption.",
    });
  }
}

/**
 * Allocates monthly OCR credits when a subscription invoice is paid.
 * Uses TIER_CREDIT_ALLOWANCE from billing-constants (D-06).
 * Skips the first invoice (credits are allocated via checkout.session.completed).
 */
async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  tx: TxClient,
): Promise<void> {
  // Skip non-subscription invoices and first invoices (trial start)
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);

  if (!subscriptionId || invoice.billing_reason === "subscription_create") {
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
    console.warn(
      `[stripe-webhook] handleInvoicePaid: unknown price ${sub.stripePriceId}`,
    );
    return;
  }

  const credits =
    TIER_CREDIT_ALLOWANCE[tier as keyof typeof TIER_CREDIT_ALLOWANCE];

  await tx.ocrCreditLedger.create({
    data: {
      organizationId: sub.organizationId,
      credits,
      reason: "MONTHLY_ALLOWANCE",
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
    data: { status: "PAST_DUE" },
  });

  // Notify admin users
  const adminMembers = await tx.member.findMany({
    where: {
      organizationId: sub.organizationId,
      role: { in: ["owner", "admin"] },
    },
    select: { userId: true },
  });

  const adminUserIds = adminMembers.map(
    (m: { userId: string }) => m.userId,
  );

  if (adminUserIds.length > 0) {
    void dispatch({
      organizationId: sub.organizationId,
      type: "PAYMENT_FAILED" as const,
      recipientUserIds: adminUserIds,
      title: "Payment failed",
      body: "Payment failed. Update your payment method to continue your subscription.",
      entityType: "ORGANIZATION",
      entityId: sub.organizationId,
    }).catch((error: unknown) =>
      console.error(
        "[stripe-webhook] Payment failed notification dispatch failed:",
        error,
      ),
    );
  }

  // Also email billing contact
  if (sub.organization?.billingEmail) {
    await sendBillingEmail({
      to: sub.organization.billingEmail,
      subject: "Payment failed - action required",
      body: "Payment failed. Update your payment method to continue your subscription.",
    });
  }
}
