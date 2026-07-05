import { entityIdSchema, webhookEventTypeSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../init';
import { TIER_WEBHOOK_SUBSCRIPTION_CAP } from '../../lib/api-tier-limits';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { getSubscription } from '../../services/billing-service';
import { enqueueJob } from '../../services/queue';
import { WebhookUrlError } from '../../services/webhooks/errors';
import { encryptWebhookSecret } from '../../services/webhooks/secret-store';
import { generateWebhookSecret } from '../../services/webhooks/signer';
import { assertWebhookUrlSafe } from '../../services/webhooks/ssrf-guard';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const createInput = z.object({
  url: z.string().url(),
  eventFilter: z.array(webhookEventTypeSchema).min(1),
  includePii: z.boolean().default(false),
  httpAllowed: z.boolean().default(false),
});

const updateInput = z.object({
  id: z.string(),
  url: z.string().url().optional(),
  eventFilter: z.array(webhookEventTypeSchema).min(1).optional(),
  includePii: z.boolean().optional(),
  httpAllowed: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** SSRF-check the target URL; map a rejection to a client BAD_REQUEST. */
async function assertUrlSafeOrReject(url: string, httpAllowed: boolean): Promise<void> {
  try {
    await assertWebhookUrlSafe(url, { httpAllowed });
  } catch (err) {
    if (err instanceof WebhookUrlError) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Webhook URL rejected: ${err.reason}`,
      });
    }
    throw err;
  }
}

function auditContext(headers: Headers): { ipAddress: string | null; userAgent: string | null } {
  return {
    ipAddress: headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: headers.get('user-agent'),
  };
}

const webhookAdminProcedure = tenantProcedure.use(requirePermission({ organization: ['update'] }));

// ---------------------------------------------------------------------------
// Webhook subscription management router (session-authed, admin-gated)
// ---------------------------------------------------------------------------

export const webhookSubscriptionRouter = router({
  /**
   * Create a subscription. SSRF-checks the URL, enforces the per-tier cap,
   * generates + encrypts a `whsec_` secret, and returns the plaintext ONCE.
   */
  create: webhookAdminProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    await assertUrlSafeOrReject(input.url, input.httpAllowed);

    const subscription = await getSubscription(ctx.organizationId);
    const tier = subscription?.tier ?? 'STARTER';
    const cap = TIER_WEBHOOK_SUBSCRIPTION_CAP[tier];
    if (Number.isFinite(cap)) {
      const count = await ctx.db.webhookSubscription.count({
        where: { organizationId: ctx.organizationId },
      });
      if (count >= cap) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Maximum ${cap} webhook subscription(s) for the ${tier} tier.`,
        });
      }
    }

    const secret = generateWebhookSecret();
    const created = await ctx.db.webhookSubscription.create({
      data: {
        organizationId: ctx.organizationId,
        url: input.url,
        eventFilter: input.eventFilter,
        secretEncrypted: encryptWebhookSecret(secret),
        includePii: input.includePii,
        httpAllowed: input.httpAllowed,
      },
      select: {
        id: true,
        url: true,
        eventFilter: true,
        includePii: true,
        httpAllowed: true,
        enabled: true,
        createdAt: true,
      },
    });

    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user?.id ?? null,
      action: 'WEBHOOK_SUBSCRIPTION_CREATE',
      resourceType: 'WEBHOOK_SUBSCRIPTION',
      resourceId: created.id,
      newValues: {
        url: created.url,
        eventFilter: created.eventFilter,
        includePii: created.includePii,
      },
      metadata: { subscriptionId: created.id },
      ...auditContext(ctx.headers),
    });

    // Secret revealed exactly once.
    return { ...created, secret };
  }),

  /** List subscriptions with health timestamps. Never returns the secret. */
  list: webhookAdminProcedure.query(async ({ ctx }) => {
    return ctx.db.webhookSubscription.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        eventFilter: true,
        includePii: true,
        httpAllowed: true,
        enabled: true,
        lastSuccessAt: true,
        lastFailureAt: true,
        createdAt: true,
      },
    });
  }),

  /** Update a subscription. Re-SSRF-checks on a URL change. */
  update: webhookAdminProcedure.input(updateInput).mutation(async ({ ctx, input }) => {
    const existing = await findOrThrow(
      () =>
        ctx.db.webhookSubscription.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        }),
      'WEBHOOK_SUBSCRIPTION_NOT_FOUND',
    );

    if (input.url !== undefined) {
      await assertUrlSafeOrReject(input.url, input.httpAllowed ?? existing.httpAllowed);
    }

    const updated = await ctx.db.webhookSubscription.update({
      where: { id: input.id },
      data: {
        ...(input.url !== undefined && { url: input.url }),
        ...(input.eventFilter !== undefined && { eventFilter: input.eventFilter }),
        ...(input.includePii !== undefined && { includePii: input.includePii }),
        ...(input.httpAllowed !== undefined && { httpAllowed: input.httpAllowed }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
      },
      select: {
        id: true,
        url: true,
        eventFilter: true,
        includePii: true,
        httpAllowed: true,
        enabled: true,
      },
    });

    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user?.id ?? null,
      action: 'WEBHOOK_SUBSCRIPTION_UPDATE',
      resourceType: 'WEBHOOK_SUBSCRIPTION',
      resourceId: updated.id,
      oldValues: {
        url: existing.url,
        eventFilter: existing.eventFilter,
        enabled: existing.enabled,
      },
      newValues: { url: updated.url, eventFilter: updated.eventFilter, enabled: updated.enabled },
      metadata: { subscriptionId: updated.id },
      ...auditContext(ctx.headers),
    });

    return updated;
  }),

  /** Rotate the signing secret: mint a new one, reveal once, old invalid at once. */
  rotateSecret: webhookAdminProcedure.input(entityIdSchema).mutation(async ({ ctx, input }) => {
    const existing = await findOrThrow(
      () =>
        ctx.db.webhookSubscription.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        }),
      'WEBHOOK_SUBSCRIPTION_NOT_FOUND',
    );

    const secret = generateWebhookSecret();
    await ctx.db.webhookSubscription.update({
      where: { id: existing.id },
      data: { secretEncrypted: encryptWebhookSecret(secret) },
    });

    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user?.id ?? null,
      action: 'WEBHOOK_SUBSCRIPTION_ROTATE_SECRET',
      resourceType: 'WEBHOOK_SUBSCRIPTION',
      resourceId: existing.id,
      metadata: { subscriptionId: existing.id },
      ...auditContext(ctx.headers),
    });

    return { id: existing.id, secret };
  }),

  /** Delete a subscription (cascades attempts + dead-letters). */
  delete: webhookAdminProcedure.input(entityIdSchema).mutation(async ({ ctx, input }) => {
    const existing = await findOrThrow(
      () =>
        ctx.db.webhookSubscription.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        }),
      'WEBHOOK_SUBSCRIPTION_NOT_FOUND',
    );

    await ctx.db.webhookSubscription.delete({ where: { id: existing.id } });

    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user?.id ?? null,
      action: 'WEBHOOK_SUBSCRIPTION_DELETE',
      resourceType: 'WEBHOOK_SUBSCRIPTION',
      resourceId: existing.id,
      oldValues: { url: existing.url, eventFilter: existing.eventFilter },
      metadata: { subscriptionId: existing.id },
      ...auditContext(ctx.headers),
    });

    return { success: true };
  }),

  /** Fire a synthetic `webhook.test` event through the delivery path. */
  testFire: webhookAdminProcedure.input(entityIdSchema).mutation(async ({ ctx, input }) => {
    const existing = await findOrThrow(
      () =>
        ctx.db.webhookSubscription.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        }),
      'WEBHOOK_SUBSCRIPTION_NOT_FOUND',
    );

    const attempt = await ctx.db.webhookDeliveryAttempt.create({
      data: {
        subscriptionId: existing.id,
        organizationId: ctx.organizationId,
        eventType: 'webhook.test',
        payloadJson: { message: 'Test event from Contractor Ops', subscriptionId: existing.id },
        status: 'PENDING',
      },
      select: { id: true },
    });
    await enqueueJob('webhook.deliver', { attemptId: attempt.id }, { dedupId: attempt.id });

    return { attemptId: attempt.id };
  }),

  /** Last 100 delivery attempts for a subscription. */
  listDeliveries: webhookAdminProcedure.input(entityIdSchema).query(async ({ ctx, input }) => {
    await findOrThrow(
      () =>
        ctx.db.webhookSubscription.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
          select: { id: true },
        }),
      'WEBHOOK_SUBSCRIPTION_NOT_FOUND',
    );

    return ctx.db.webhookDeliveryAttempt.findMany({
      where: { subscriptionId: input.id, organizationId: ctx.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        eventType: true,
        status: true,
        attempts: true,
        responseStatus: true,
        lastError: true,
        deliveredAt: true,
        nextAttemptAt: true,
        createdAt: true,
      },
    });
  }),
});
