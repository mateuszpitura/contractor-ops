import { prisma } from "@contractor-ops/db";
import { metrics } from "@contractor-ops/logger/metrics";
import {
  TIER_CREDIT_ALLOWANCE,
  TRIAL_CREDIT_ALLOWANCE,
} from "./billing-constants.js";
import { stripe } from "./stripe-client.js";
import { dispatch } from "./notification-service.js";
import {
  cached,
  invalidate,
  CacheKeys,
  CacheTTL,
} from "./cache.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditBalance {
  balance: number;
  allowance: number;
  used: number;
  tier: string | null;
}

export interface CreditDeductionResult {
  allowed: boolean;
  remaining: number;
  reason?: "no_subscription" | "credits_exhausted";
}

export interface TopUpResult {
  balance: number;
}

// ---------------------------------------------------------------------------
// Credit Balance
// ---------------------------------------------------------------------------

/**
 * Returns the current OCR credit balance for an organization.
 *
 * - Fetches the active/trialing subscription
 * - Per D-08: uses TRIAL_CREDIT_ALLOWANCE (5) for trialing subscriptions
 * - Per D-06: uses TIER_CREDIT_ALLOWANCE for active subscriptions
 * - Aggregates OcrCreditLedger entries within the current billing period
 */
export async function getCreditBalance(
  organizationId: string,
): Promise<CreditBalance> {
  return cached(
    CacheKeys.creditBalance(organizationId),
    CacheTTL.CREDIT_BALANCE,
    () => fetchCreditBalance(organizationId),
  );
}

async function fetchCreditBalance(
  organizationId: string,
): Promise<CreditBalance> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  if (
    !subscription ||
    (subscription.status !== "ACTIVE" && subscription.status !== "TRIALING")
  ) {
    return { balance: 0, allowance: 0, used: 0, tier: null };
  }

  // Per D-08: Trial subscriptions get reduced allowance
  const allowance =
    subscription.status === "TRIALING"
      ? TRIAL_CREDIT_ALLOWANCE
      : TIER_CREDIT_ALLOWANCE[
          subscription.tier as keyof typeof TIER_CREDIT_ALLOWANCE
        ];

  const aggregation = await prisma.ocrCreditLedger.aggregate({
    where: {
      organizationId,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
    },
    _sum: { credits: true },
  });

  // Separate negative entries for "used" count
  const negativeAgg = await prisma.ocrCreditLedger.aggregate({
    where: {
      organizationId,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      credits: { lt: 0 },
    },
    _sum: { credits: true },
  });

  const netSum = aggregation._sum.credits ?? 0;
  const used = Math.abs(negativeAgg._sum.credits ?? 0);

  return {
    balance: netSum,
    allowance,
    used,
    tier: subscription.tier,
  };
}

// ---------------------------------------------------------------------------
// Atomic Credit Deduction
// ---------------------------------------------------------------------------

/**
 * Atomically checks and deducts one OCR credit for an organization.
 *
 * Uses Prisma's interactive transaction with Serializable isolation
 * to prevent race conditions (Pitfall 3 from RESEARCH.md).
 *
 * After successful deduction, fires a Stripe Meter event (fire-and-forget)
 * for invoice-level usage tracking per D-12.
 *
 * @returns Whether the deduction was allowed, remaining credits, and reason if denied
 */
export async function checkAndDeductCredit(
  organizationId: string,
): Promise<CreditDeductionResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await prisma.$transaction(
    async (tx: any) => {
      const subscription = await tx.subscription.findUnique({
        where: { organizationId },
      });

      if (
        !subscription ||
        (subscription.status !== "ACTIVE" &&
          subscription.status !== "TRIALING")
      ) {
        return {
          allowed: false as const,
          remaining: 0,
          reason: "no_subscription" as const,
          stripeCustomerId: null,
        };
      }

      // Per D-08: Trial subscriptions get reduced allowance
      const allowance =
        subscription.status === "TRIALING"
          ? TRIAL_CREDIT_ALLOWANCE
          : TIER_CREDIT_ALLOWANCE[
              subscription.tier as keyof typeof TIER_CREDIT_ALLOWANCE
            ];

      // Aggregate negative credits (usage) for the current billing period
      const usageAgg = await tx.ocrCreditLedger.aggregate({
        where: {
          organizationId,
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
          credits: { lt: 0 },
        },
        _sum: { credits: true },
      });

      const used = Math.abs(usageAgg._sum.credits ?? 0);
      const remaining = allowance - used;

      if (remaining <= 0) {
        return {
          allowed: false as const,
          remaining: 0,
          reason: "credits_exhausted" as const,
          stripeCustomerId: null,
        };
      }

      // Deduct one credit
      await tx.ocrCreditLedger.create({
        data: {
          organizationId,
          credits: -1,
          reason: "OCR_EXTRACTION",
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
        },
      });

      return {
        allowed: true as const,
        remaining: remaining - 1,
        stripeCustomerId: subscription.stripeCustomerId,
      };
    },
    {
      isolationLevel: "Serializable",
    },
  );

  // Track metrics
  metrics.increment("billing.credit_deduction", 1, {
    outcome: result.allowed ? "granted" : (result.reason ?? "unknown"),
  });

  // Invalidate credit cache after deduction
  if (result.allowed) {
    void invalidate(CacheKeys.creditBalance(organizationId));
  }

  // Notify admins when credits are exhausted
  if (result.allowed && result.remaining === 0) {
    metrics.increment("billing.credits_exhausted", 1);
    void notifyCreditExhausted(organizationId);
  }

  // Fire-and-forget Stripe Meter event after successful deduction (outside transaction)
  if (result.allowed && result.stripeCustomerId) {
    stripe.billing.meterEvents
      .create({
        event_name: "ocr_extraction",
        payload: {
          stripe_customer_id: result.stripeCustomerId,
          value: "1",
        },
      })
      .catch((err: unknown) =>
        console.error("[billing] Meter event failed:", err),
      );
  }

  // Strip internal stripeCustomerId from the return type
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    ...(result.reason ? { reason: result.reason } : {}),
  };
}

// ---------------------------------------------------------------------------
// Top-Up Credit Allocation
// ---------------------------------------------------------------------------

/**
 * Allocates top-up OCR credits for an organization.
 *
 * Creates a positive ledger entry with reason "TOP_UP" in the
 * current billing period. Per D-13.
 *
 * @returns The new credit balance after allocation
 */
export async function allocateTopUpCredits(params: {
  organizationId: string;
  credits: number;
  stripeEventId?: string;
}): Promise<TopUpResult> {
  if (params.credits <= 0) {
    throw new Error(
      `[billing] Credits must be positive, got ${params.credits}`,
    );
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: params.organizationId },
  });

  if (!subscription) {
    throw new Error(
      `[billing] No subscription found for organization ${params.organizationId}`,
    );
  }

  await prisma.ocrCreditLedger.create({
    data: {
      organizationId: params.organizationId,
      credits: params.credits,
      reason: "TOP_UP",
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      stripeEventId: params.stripeEventId ?? null,
    },
  });

  // Invalidate credit cache after top-up
  void invalidate(CacheKeys.creditBalance(params.organizationId));

  // Return updated balance
  const aggregation = await prisma.ocrCreditLedger.aggregate({
    where: {
      organizationId: params.organizationId,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
    },
    _sum: { credits: true },
  });

  return { balance: aggregation._sum.credits ?? 0 };
}

// ---------------------------------------------------------------------------
// Credit Exhaustion Notification
// ---------------------------------------------------------------------------

async function notifyCreditExhausted(
  organizationId: string,
): Promise<void> {
  try {
    const adminMembers = await prisma.member.findMany({
      where: {
        organizationId,
        role: { in: ["owner", "admin"] },
      },
      select: { userId: true },
    });

    const adminUserIds = adminMembers.map((m) => m.userId);
    if (adminUserIds.length === 0) return;

    await dispatch({
      organizationId,
      type: "CREDIT_EXHAUSTED" as const,
      recipientUserIds: adminUserIds,
      title: "OCR credits exhausted",
      body: "Your organization has used all OCR credits for this billing period. Purchase additional credits to continue processing invoices.",
      entityType: "ORGANIZATION",
      entityId: organizationId,
    });
  } catch (error) {
    console.error(
      `[billing] Failed to send credit exhaustion notification for org ${organizationId}:`,
      error,
    );
  }
}
