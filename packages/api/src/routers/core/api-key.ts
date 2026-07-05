import { entityIdSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  API_KEY_CANNOT_ROTATE_SUPERSEDED,
  API_KEY_CANNOT_UPDATE_REVOKED,
  API_KEY_REVOKED,
  INVALID_ACTING_USER,
  UNAUTHORIZED,
} from '../../errors';
import { router } from '../../init';
import { TIER_MONTHLY_REQUEST_QUOTA } from '../../lib/api-tier-limits';
import { findOrThrow } from '../../lib/find-or-throw';
import { PUBLIC_API_SCOPES } from '../../lib/scope-utils';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { requireTier } from '../../middleware/tier';
import { generateApiKey } from '../../services/api-key-service';
import { getMonthlyRequestCount } from '../../services/api-quota-counter';
import { writeAuditLog } from '../../services/audit-writer';
import { getSubscription } from '../../services/billing-service';
import type { DbClient } from '../../services/types';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const createInput = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(PUBLIC_API_SCOPES)).min(1),
  expiresAt: z.coerce.date().optional(),
  // Attribution actor for the key's writes. Defaults to the creator; must be an
  // ACTIVE member of the org. NOT an authorization source (scopes are).
  actingUserId: z.string().optional(),
});

const updateInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(z.enum(PUBLIC_API_SCOPES)).min(1).optional(),
  actingUserId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Base procedure: admin + Enterprise tier
// ---------------------------------------------------------------------------

const apiKeyAdminProcedure = tenantProcedure
  .use(requirePermission({ organization: ['update'] }))
  .use(requireTier('ENTERPRISE'));

/**
 * Guard the acting-user binding: the id MUST reference a User who is an ACTIVE
 * (non-disabled) member of the key's org. Rejects cross-org / removed / disabled
 * users so a key can never attribute writes to an outsider (IDOR defense).
 */
async function assertActiveMember(
  db: DbClient,
  organizationId: string,
  userId: string,
): Promise<void> {
  const member = await db.member.findFirst({
    where: { organizationId, userId, disabledAt: null },
    select: { id: true },
  });
  if (!member) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: INVALID_ACTING_USER });
  }
}

// ---------------------------------------------------------------------------
// API Key management router
// ---------------------------------------------------------------------------

export const apiKeyRouter = router({
  /**
   * Create a new API key.
   * Returns the plaintext key exactly once — it cannot be retrieved again.
   */
  create: apiKeyAdminProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    const MAX_KEYS_PER_ORG = 50;
    const keyCount = await ctx.db.organizationApiKey.count({
      where: { organizationId: ctx.organizationId, revokedAt: null },
    });
    if (keyCount >= MAX_KEYS_PER_ORG) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Maximum ${MAX_KEYS_PER_ORG} active API keys per organization.`,
      });
    }

    const creatorId = ctx.user?.id;
    if (!creatorId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: UNAUTHORIZED });
    }

    // Attribution actor: defaults to the creator, must be an active org member.
    const actingUserId = input.actingUserId ?? creatorId;
    await assertActiveMember(ctx.db, ctx.organizationId, actingUserId);

    const { plaintext, prefix, hash } = generateApiKey();

    const key = await ctx.db.organizationApiKey.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name,
        prefix,
        hash,
        scopes: input.scopes,
        createdByUserId: creatorId,
        actingUserId,
        expiresAt: input.expiresAt ?? null,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // API keys are long-lived bearer tokens for the public API.
    // Issuance MUST be in the audit log for forensics + compliance.
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user?.id ?? null,
      action: 'API_KEY_CREATE',
      resourceType: 'ORGANIZATION',
      resourceId: ctx.organizationId,
      newValues: {
        apiKeyId: key.id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes,
        expiresAt: key.expiresAt,
      },
      metadata: { apiKeyId: key.id },
    });

    return {
      ...key,
      // Plaintext returned only on creation
      plaintext,
    };
  }),

  /**
   * List all API keys for the organization.
   * Never returns hashes.
   */
  list: apiKeyAdminProcedure.query(async ({ ctx }) => {
    const keys = await ctx.db.organizationApiKey.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        revokedAt: true,
        expiresAt: true,
        supersededAt: true,
        graceExpiresAt: true,
        actingUserId: true,
        createdAt: true,
        createdBy: {
          select: { id: true, name: true },
        },
        actingUser: {
          select: { id: true, name: true },
        },
      },
    });

    return keys;
  }),

  /**
   * Recent source-IP events for a key (Developer page). Read-only, org-scoped.
   */
  ipLog: apiKeyAdminProcedure.input(entityIdSchema).query(async ({ ctx, input }) => {
    return ctx.db.apiKeyIpEvent.findMany({
      where: { apiKeyId: input.id, organizationId: ctx.organizationId },
      orderBy: { seenAt: 'desc' },
      take: 50,
      select: { id: true, ipAddress: true, userAgent: true, seenAt: true },
    });
  }),

  /**
   * Current calendar-month API request usage vs the org's tier quota. `quota` is
   * null for the unlimited (Enterprise) tier.
   */
  usage: apiKeyAdminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const [count, subscription] = await Promise.all([
      getMonthlyRequestCount(ctx.organizationId),
      getSubscription(ctx.organizationId),
    ]);
    const tier = subscription?.tier ?? 'STARTER';
    const limit = TIER_MONTHLY_REQUEST_QUOTA[tier];
    return { month, count, quota: Number.isFinite(limit) ? limit : null };
  }),

  /**
   * Update an API key's name or scopes.
   */
  update: apiKeyAdminProcedure.input(updateInput).mutation(async ({ ctx, input }) => {
    const existing = await findOrThrow(
      () =>
        ctx.db.organizationApiKey.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
          },
        }),
      'API_KEY_NOT_FOUND',
    );

    if (existing.revokedAt) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: API_KEY_CANNOT_UPDATE_REVOKED });
    }

    // Rebinding the acting user re-runs the active-membership guard so a key can
    // never be pointed at a cross-org / removed / disabled user.
    if (input.actingUserId !== undefined) {
      await assertActiveMember(ctx.db, ctx.organizationId, input.actingUserId);
    }

    const updated = await ctx.db.organizationApiKey.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.scopes !== undefined && { scopes: input.scopes }),
        ...(input.actingUserId !== undefined && { actingUserId: input.actingUserId }),
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        actingUserId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Scope/name/acting-user changes can broaden the key's access surface.
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user?.id ?? null,
      action: 'API_KEY_UPDATE',
      resourceType: 'ORGANIZATION',
      resourceId: ctx.organizationId,
      oldValues: {
        name: existing.name,
        scopes: existing.scopes,
        actingUserId: existing.actingUserId,
      },
      newValues: { name: updated.name, scopes: updated.scopes, actingUserId: updated.actingUserId },
      metadata: { apiKeyId: updated.id },
    });

    return updated;
  }),

  /**
   * Revoke an API key. Immediate and irreversible.
   */
  revoke: apiKeyAdminProcedure.input(entityIdSchema).mutation(async ({ ctx, input }) => {
    const existing = await findOrThrow(
      () =>
        ctx.db.organizationApiKey.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
          },
        }),
      'API_KEY_NOT_FOUND',
    );

    if (existing.revokedAt) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: API_KEY_REVOKED });
    }

    await ctx.db.organizationApiKey.update({
      where: { id: input.id },
      data: { revokedAt: new Date() },
    });

    // API key revocation is forensics-critical.
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user?.id ?? null,
      action: 'API_KEY_REVOKE',
      resourceType: 'ORGANIZATION',
      resourceId: ctx.organizationId,
      oldValues: { revokedAt: null, name: existing.name, prefix: existing.prefix },
      newValues: { revokedAt: new Date().toISOString() },
      metadata: { apiKeyId: existing.id },
    });

    return { success: true };
  }),

  /**
   * Rotate an API key with a grace window: issue a NEW key inheriting the old
   * key's name/scopes/actingUserId/expiresAt, mark the old key superseded, and
   * keep the old key valid until `graceExpiresAt` (default 24h, max 168h) for a
   * zero-downtime cutover. Returns the new plaintext EXACTLY ONCE.
   */
  rotate: apiKeyAdminProcedure
    .input(z.object({ id: z.string(), graceHours: z.number().int().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      const creatorId = ctx.user?.id;
      if (!creatorId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: UNAUTHORIZED });
      }

      const existing = await findOrThrow(
        () =>
          ctx.db.organizationApiKey.findFirst({
            where: { id: input.id, organizationId: ctx.organizationId },
          }),
        'API_KEY_NOT_FOUND',
      );

      if (existing.revokedAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: API_KEY_REVOKED });
      }
      if (existing.supersededAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: API_KEY_CANNOT_ROTATE_SUPERSEDED });
      }

      const DEFAULT_GRACE_HOURS = 24;
      const MAX_GRACE_HOURS = 168;
      const graceHours = Math.min(input.graceHours ?? DEFAULT_GRACE_HOURS, MAX_GRACE_HOURS);
      const now = new Date();
      const graceExpiresAt = new Date(now.getTime() + graceHours * 60 * 60 * 1000);

      const { plaintext, prefix, hash } = generateApiKey();

      const newKey = await ctx.db.$transaction(async tx => {
        const created = await tx.organizationApiKey.create({
          data: {
            organizationId: ctx.organizationId,
            name: existing.name,
            prefix,
            hash,
            scopes: existing.scopes,
            createdByUserId: creatorId,
            actingUserId: existing.actingUserId,
            expiresAt: existing.expiresAt,
          },
          select: {
            id: true,
            name: true,
            prefix: true,
            scopes: true,
            expiresAt: true,
            createdAt: true,
          },
        });

        await tx.organizationApiKey.update({
          where: { id: existing.id },
          data: { supersededAt: now, supersededByKeyId: created.id, graceExpiresAt },
        });

        // Rotation is forensics-critical (old + new prefix + grace window).
        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: creatorId,
          action: 'API_KEY_ROTATE',
          resourceType: 'ORGANIZATION',
          resourceId: ctx.organizationId,
          oldValues: { apiKeyId: existing.id, prefix: existing.prefix },
          newValues: {
            apiKeyId: created.id,
            prefix: created.prefix,
            graceExpiresAt: graceExpiresAt.toISOString(),
          },
          metadata: { apiKeyId: created.id, supersededKeyId: existing.id },
        });

        return created;
      });

      return { ...newKey, graceExpiresAt, plaintext };
    }),
});
