import { prisma } from '@contractor-ops/db';
import type { Prisma } from '@contractor-ops/db/generated/prisma/client';
import { createLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import type { BillingCreditDenialReason } from '@contractor-ops/validators';
import { billingCreditDenialReason } from '@contractor-ops/validators';
import { resolveOcrCreditAllowance } from './billing-constants';
import { CacheKeys, CacheTTL, cached, invalidate } from './cache';
import { enqueueNotificationOutboxEvent } from './outbox';
import { stripe } from './stripe-client';
import type { DbClient } from './types';

const log = createLogger({ service: 'credit-service' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditBalance {
  /** Remaining usable credits (allowance + topUp − used, floored at 0). */
  balance: number;
  allowance: number;
  topUp: number;
  used: number;
  tier: string | null;
}

export interface CreditDeductionResult {
  allowed: boolean;
  remaining: number;
  reason?: BillingCreditDenialReason;
}

export interface TopUpResult {
  balance: number;
}

// ---------------------------------------------------------------------------
// Credit Balance
// ---------------------------------------------------------------------------

/**
 * Returns the current OCR credit balance for an organization.
 */
export async function getCreditBalance(organizationId: string): Promise<CreditBalance> {
  return cached(CacheKeys.creditBalance(organizationId), CacheTTL.CREDIT_BALANCE, () =>
    fetchCreditBalance(organizationId),
  );
}

async function fetchCreditBalance(organizationId: string): Promise<CreditBalance> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  if (!subscription || (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIALING')) {
    return { balance: 0, allowance: 0, topUp: 0, used: 0, tier: null };
  }

  const allowance = resolveOcrCreditAllowance(subscription);
  if (allowance === null) {
    log.warn(
      { organizationId, tier: subscription.tier },
      'unknown subscription tier for OCR credits',
    );
    return { balance: 0, allowance: 0, topUp: 0, used: 0, tier: subscription.tier };
  }

  const periodWhere = {
    organizationId,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
  };

  const [negativeAgg, topUpAgg] = await Promise.all([
    prisma.ocrCreditLedger.aggregate({
      where: { ...periodWhere, credits: { lt: 0 } },
      _sum: { credits: true },
    }),
    prisma.ocrCreditLedger.aggregate({
      where: { ...periodWhere, credits: { gt: 0 }, reason: 'TOP_UP' },
      _sum: { credits: true },
    }),
  ]);

  const used = Math.abs(negativeAgg._sum.credits ?? 0);
  const topUp = topUpAgg._sum.credits ?? 0;
  const balance = computeCreditRemaining(allowance, topUp, used);

  return {
    balance,
    allowance,
    topUp,
    used,
    tier: subscription.tier,
  };
}

/** Gate formula shared by balance reads and deduction checks. */
export function computeCreditRemaining(
  allowance: number,
  topUpCredits: number,
  used: number,
): number {
  return Math.max(0, allowance + topUpCredits - used);
}

/**
 * When a billing period rolls, unused purchased top-up credits carry into the
 * new period as a single TOP_UP ledger row (deduped via stripeEventId).
 */
export async function carryForwardUnusedTopUpCredits(
  tx: DbClient,
  params: {
    organizationId: string;
    priorPeriodStart: Date;
    priorPeriodEnd: Date;
    newPeriodStart: Date;
    newPeriodEnd: Date;
    allowance: number;
  },
): Promise<number> {
  const rolloverEventId = `topup_rollover:${params.organizationId}:${params.newPeriodStart.toISOString()}`;
  const existing = await tx.ocrCreditLedger.findFirst({
    where: { stripeEventId: rolloverEventId },
    select: { id: true },
  });
  if (existing) return 0;

  const priorWhere = {
    organizationId: params.organizationId,
    periodStart: params.priorPeriodStart,
    periodEnd: params.priorPeriodEnd,
  };

  const [usageAgg, topUpAgg] = await Promise.all([
    tx.ocrCreditLedger.aggregate({
      where: { ...priorWhere, credits: { lt: 0 } },
      _sum: { credits: true },
    }),
    tx.ocrCreditLedger.aggregate({
      where: { ...priorWhere, credits: { gt: 0 }, reason: 'TOP_UP' },
      _sum: { credits: true },
    }),
  ]);

  const used = Math.abs(usageAgg._sum.credits ?? 0);
  const priorTopUp = topUpAgg._sum.credits ?? 0;
  const unusedTopUp = Math.max(0, priorTopUp - Math.max(0, used - params.allowance));

  if (unusedTopUp <= 0) return 0;

  await tx.ocrCreditLedger.create({
    data: {
      organizationId: params.organizationId,
      credits: unusedTopUp,
      reason: 'TOP_UP',
      periodStart: params.newPeriodStart,
      periodEnd: params.newPeriodEnd,
      stripeEventId: rolloverEventId,
    },
  });

  log.info(
    {
      organizationId: params.organizationId,
      unusedTopUp,
      priorPeriodStart: params.priorPeriodStart.toISOString(),
      newPeriodStart: params.newPeriodStart.toISOString(),
    },
    'carried forward unused top-up credits into new billing period',
  );

  return unusedTopUp;
}

// ---------------------------------------------------------------------------
// Atomic Credit Deduction
// ---------------------------------------------------------------------------

export async function checkAndDeductCredit(organizationId: string): Promise<CreditDeductionResult> {
  const result = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const subscription = await tx.subscription.findUnique({
        where: { organizationId },
      });

      if (
        !subscription ||
        (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIALING')
      ) {
        return {
          allowed: false as const,
          remaining: 0,
          reason: billingCreditDenialReason.noSubscription,
          stripeCustomerId: null,
        };
      }

      const allowance = resolveOcrCreditAllowance(subscription);
      if (allowance === null) {
        log.error(
          { organizationId, tier: subscription.tier },
          'unknown subscription tier for OCR credit deduction',
        );
        return {
          allowed: false as const,
          remaining: 0,
          reason: billingCreditDenialReason.noSubscription,
          stripeCustomerId: null,
        };
      }

      const periodWhere = {
        organizationId,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
      };

      const [usageAgg, topUpAgg] = await Promise.all([
        tx.ocrCreditLedger.aggregate({
          where: { ...periodWhere, credits: { lt: 0 } },
          _sum: { credits: true },
        }),
        tx.ocrCreditLedger.aggregate({
          where: { ...periodWhere, credits: { gt: 0 }, reason: 'TOP_UP' },
          _sum: { credits: true },
        }),
      ]);

      const used = Math.abs(usageAgg._sum.credits ?? 0);
      const topUpCredits = topUpAgg._sum.credits ?? 0;
      const remaining = computeCreditRemaining(allowance, topUpCredits, used);

      if (remaining <= 0) {
        return {
          allowed: false as const,
          remaining: 0,
          reason: billingCreditDenialReason.creditsExhausted,
          stripeCustomerId: null,
        };
      }

      const ledgerEntry = await tx.ocrCreditLedger.create({
        data: {
          organizationId,
          credits: -1,
          reason: 'OCR_EXTRACTION',
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
        },
        select: { id: true },
      });

      if (remaining - 1 === 0) {
        await enqueueCreditExhaustedNotification(
          tx,
          organizationId,
          subscription.currentPeriodStart,
        );
      }

      return {
        allowed: true as const,
        remaining: remaining - 1,
        stripeCustomerId: subscription.stripeCustomerId,
        ledgerEntryId: ledgerEntry.id,
      };
    },
    {
      isolationLevel: 'Serializable',
    },
  );

  metrics.increment('billing.credit_deduction', 1, {
    outcome: result.allowed ? 'granted' : (result.reason ?? 'unknown'),
  });

  if (result.allowed) {
    void invalidate(CacheKeys.creditBalance(organizationId));
  }

  if (result.allowed && result.remaining === 0) {
    metrics.increment('billing.creditsExhausted', 1);
  }

  if (result.allowed && result.stripeCustomerId) {
    const meterIdentifier = `ocr-${organizationId}-${result.ledgerEntryId ?? Date.now().toString()}`;
    stripe.billing.meterEvents
      .create({
        event_name: 'ocr_extraction',
        identifier: meterIdentifier,
        payload: {
          stripe_customer_id: result.stripeCustomerId,
          value: '1',
        },
      })
      .catch((err: unknown) => log.error({ err }, 'meter event failed'));
  }

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    ...(result.reason ? { reason: result.reason } : {}),
  };
}

// ---------------------------------------------------------------------------
// Top-Up Credit Allocation
// ---------------------------------------------------------------------------

export async function allocateTopUpCredits(params: {
  organizationId: string;
  credits: number;
  stripeEventId?: string;
}): Promise<TopUpResult> {
  if (params.credits <= 0) {
    throw new Error(`[billing] Credits must be positive, got ${params.credits}`);
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: params.organizationId },
  });

  if (!subscription) {
    throw new Error(`[billing] No subscription found for organization ${params.organizationId}`);
  }

  await prisma.ocrCreditLedger.create({
    data: {
      organizationId: params.organizationId,
      credits: params.credits,
      reason: 'TOP_UP',
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      stripeEventId: params.stripeEventId ?? null,
    },
  });

  void invalidate(CacheKeys.creditBalance(params.organizationId));

  const allowance = resolveOcrCreditAllowance(subscription);
  const periodWhere = {
    organizationId: params.organizationId,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
  };
  const [negativeAgg, topUpAgg] = await Promise.all([
    prisma.ocrCreditLedger.aggregate({
      where: { ...periodWhere, credits: { lt: 0 } },
      _sum: { credits: true },
    }),
    prisma.ocrCreditLedger.aggregate({
      where: { ...periodWhere, credits: { gt: 0 }, reason: 'TOP_UP' },
      _sum: { credits: true },
    }),
  ]);
  const used = Math.abs(negativeAgg._sum.credits ?? 0);
  const topUp = topUpAgg._sum.credits ?? 0;
  const balance = computeCreditRemaining(allowance ?? 0, topUp, used);

  return { balance };
}

// ---------------------------------------------------------------------------
// Credit Exhaustion Notification
// ---------------------------------------------------------------------------

async function enqueueCreditExhaustedNotification(
  tx: Prisma.TransactionClient,
  organizationId: string,
  periodStart: Date,
): Promise<void> {
  const adminMembers = await tx.member.findMany({
    where: {
      organizationId,
      role: { in: ['owner', 'admin'] },
    },
    select: { userId: true },
  });

  const adminUserIds = adminMembers.map(m => m.userId);
  if (adminUserIds.length === 0) return;

  await enqueueNotificationOutboxEvent({
    tx,
    event: {
      organizationId,
      type: 'CREDIT_EXHAUSTED',
      recipientUserIds: adminUserIds,
      title: 'OCR credits exhausted',
      body: 'Your organization has used all OCR credits for this billing period. Purchase additional credits to continue processing invoices.',
      entityType: 'ORGANIZATION',
      entityId: organizationId,
    },
    dedupKey: `CREDIT_EXHAUSTED:${organizationId}:${periodStart.toISOString()}`,
  });
}
