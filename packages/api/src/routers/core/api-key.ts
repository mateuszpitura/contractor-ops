import { entityIdSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { API_KEY_CANNOT_UPDATE_REVOKED, API_KEY_REVOKED } from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { PUBLIC_API_SCOPES } from '../../lib/scope-utils';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { requireTier } from '../../middleware/tier';
import { generateApiKey } from '../../services/api-key-service';
import { writeAuditLog } from '../../services/audit-writer';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const createInput = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(PUBLIC_API_SCOPES)).min(1),
  expiresAt: z.coerce.date().optional(),
});

const updateInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(z.enum(PUBLIC_API_SCOPES)).min(1).optional(),
});

// ---------------------------------------------------------------------------
// Base procedure: admin + Enterprise tier
// ---------------------------------------------------------------------------

const apiKeyAdminProcedure = tenantProcedure
  .use(requirePermission({ organization: ['update'] }))
  .use(requireTier('ENTERPRISE'));

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

    const { plaintext, prefix, hash } = generateApiKey();

    const key = await ctx.db.organizationApiKey.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name,
        prefix,
        hash,
        scopes: input.scopes,
        createdByUserId: ctx.user?.id ?? '',
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

    // F-OBS-05 — API keys are long-lived bearer tokens for the public API.
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
        createdAt: true,
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    return keys;
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

    const updated = await ctx.db.organizationApiKey.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.scopes !== undefined && { scopes: input.scopes }),
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // F-OBS-05 — scope/name changes can broaden API key access surface.
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user?.id ?? null,
      action: 'API_KEY_UPDATE',
      resourceType: 'ORGANIZATION',
      resourceId: ctx.organizationId,
      oldValues: { name: existing.name, scopes: existing.scopes },
      newValues: { name: updated.name, scopes: updated.scopes },
      metadata: { apiKeyId: updated.id },
    });

    return updated;
  }),

  /**
   * Revoke an API key. Immediate and irreversible.
   */
  revoke: apiKeyAdminProcedure
    .input(entityIdSchema)
    .mutation(async ({ ctx, input }) => {
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

      // F-OBS-05 — API key revocation is forensics-critical.
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
});
