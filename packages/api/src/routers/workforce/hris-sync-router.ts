// HRIS two-way sync router (connect XOR / disconnect / syncNow / mapping).
//
// Mounted dark inside conditionalWorkforceRouters (absent from appRouter when
// module.workforce-employees is OFF). Every mutating procedure re-asserts the
// workforce flag AND the per-provider integration.*-sync flag, so the surface
// stays dark until both are APPROVED. Connect is XOR — the one-HRIS-per-org
// partial index raises P2002 on a second HRIS, mapped to a typed CONFLICT.

import { evaluate } from '@contractor-ops/feature-flags';
import { encryptCredentials } from '@contractor-ops/integrations';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import * as E from '../../errors';
import { router } from '../../init';
import { integrationSettingsProcedure } from '../../lib/integration-procedure';
import { assertWorkforceEnabled } from '../../middleware/require-workforce-flag';
import { writeAuditLog } from '../../services/audit-writer';
import {
  hrisFieldMappingSchema,
  isOneHrisPerOrgViolation,
  publicHrisConfig,
  resolveMapping,
  runHrisPull,
} from '../../services/hris-sync';

const log = createLogger({ service: 'hris-sync-router' });

const HRIS_PROVIDER_ENUM = z.enum(['PERSONIO', 'BAMBOOHR']);
type HrisProviderInput = z.infer<typeof HRIS_PROVIDER_ENUM>;

function providerSlug(provider: HrisProviderInput): 'personio' | 'bamboohr' {
  return provider === 'PERSONIO' ? 'personio' : 'bamboohr';
}

function syncFlagFor(provider: HrisProviderInput) {
  return provider === 'PERSONIO' ? 'integration.personio-sync' : 'integration.bamboohr-sync';
}

function assertProviderEnabled(
  provider: HrisProviderInput,
  organizationId: string,
  region: string,
): void {
  assertWorkforceEnabled(organizationId, region);
  const evalRegion = region === 'ME' ? ('ME' as const) : ('EU' as const);
  const result = evaluate(syncFlagFor(provider), { organizationId, region: evalRegion });
  if (!result.enabled) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: E.HRIS_SYNC_NOT_ENABLED,
      cause: { flag: syncFlagFor(provider), provider, reason: result.reason },
    });
  }
}

const connectInput = z
  .object({
    provider: HRIS_PROVIDER_ENUM,
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .strict();

const setMappingInput = z.object({ mapping: hrisFieldMappingSchema }).strict();

async function loadOrgHrisConnection(
  db: Parameters<typeof runHrisPull>[0]['db'],
  organizationId: string,
) {
  return db.integrationConnection.findFirst({
    where: { organizationId, provider: { in: ['PERSONIO', 'BAMBOOHR'] } },
    select: {
      id: true,
      provider: true,
      status: true,
      lastSyncAt: true,
      lastSuccessAt: true,
      lastErrorAt: true,
      configJson: true,
    },
  });
}

export const hrisSyncRouter = router({
  /** The org's HRIS connection status + public (credential-safe) config. */
  getStatus: integrationSettingsProcedure('read').query(async ({ ctx }) => {
    const connection = await loadOrgHrisConnection(ctx.db, ctx.organizationId);
    if (!connection) return { connected: false as const };
    return {
      connected: true as const,
      id: connection.id,
      provider: connection.provider,
      status: connection.status,
      lastSyncAt: connection.lastSyncAt,
      lastSuccessAt: connection.lastSuccessAt,
      lastErrorAt: connection.lastErrorAt,
      config: publicHrisConfig(connection.configJson),
    };
  }),

  /** Connect an HRIS — XOR (a second HRIS is rejected with CONFLICT). */
  connect: integrationSettingsProcedure('update')
    .input(connectInput)
    .mutation(async ({ ctx, input }) => {
      assertProviderEnabled(input.provider, ctx.organizationId, ctx.region);

      const credentialsRef = encryptCredentials(
        {
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          expiresAt: input.expiresAt,
        },
        providerSlug(input.provider),
      );

      let created: { id: string };
      try {
        created = await ctx.db.integrationConnection.create({
          data: {
            organizationId: ctx.organizationId,
            provider: input.provider,
            status: 'CONNECTED',
            credentialsRef,
            connectedByUserId: ctx.user.id,
            tokenExpiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          },
          select: { id: true },
        });
      } catch (err) {
        if (isOneHrisPerOrgViolation(err)) {
          throw new TRPCError({ code: 'CONFLICT', message: E.HRIS_ALREADY_CONNECTED });
        }
        throw err;
      }

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        action: 'hris.connect',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        newValues: { provider: input.provider, connectionId: created.id },
      });

      // Fire-and-forget first pull so the user sees registry fields populate.
      void runHrisPull({
        db: ctx.db,
        organizationId: ctx.organizationId,
        connectionId: created.id,
        actorUserId: ctx.user.id,
      }).catch(err => {
        log.error(
          { err, organizationId: ctx.organizationId, connectionId: created.id },
          'hris connect: initial pull failed (fire-and-forget)',
        );
      });

      return { id: created.id, provider: input.provider };
    }),

  /** Disconnect the org's HRIS (marks the connection DISCONNECTED). */
  disconnect: integrationSettingsProcedure('update').mutation(async ({ ctx }) => {
    assertWorkforceEnabled(ctx.organizationId, ctx.region);
    const connection = await loadOrgHrisConnection(ctx.db, ctx.organizationId);
    if (!connection) throw new TRPCError({ code: 'NOT_FOUND', message: E.HRIS_NOT_CONNECTED });

    await ctx.db.integrationConnection.update({
      where: { id: connection.id },
      data: { status: 'DISCONNECTED' },
    });
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user.id,
      action: 'hris.disconnect',
      resourceType: 'ORGANIZATION',
      resourceId: ctx.organizationId,
      oldValues: { provider: connection.provider, connectionId: connection.id },
    });
    return { id: connection.id };
  }),

  /** Run an on-demand pull for the connected HRIS. */
  syncNow: integrationSettingsProcedure('update').mutation(async ({ ctx }) => {
    const connection = await loadOrgHrisConnection(ctx.db, ctx.organizationId);
    if (!connection || connection.status !== 'CONNECTED') {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: E.HRIS_NO_CONNECTED_TO_SYNC });
    }
    assertProviderEnabled(connection.provider as HrisProviderInput, ctx.organizationId, ctx.region);
    return runHrisPull({
      db: ctx.db,
      organizationId: ctx.organizationId,
      connectionId: connection.id,
      actorUserId: ctx.user.id,
    });
  }),

  /** Read the field mapping. */
  getMapping: integrationSettingsProcedure('read').query(async ({ ctx }) => {
    const connection = await loadOrgHrisConnection(ctx.db, ctx.organizationId);
    return resolveMapping(connection?.configJson);
  }),

  /** Write the field mapping (validated, credential-safe). */
  setMapping: integrationSettingsProcedure('update')
    .input(setMappingInput)
    .mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);
      const connection = await loadOrgHrisConnection(ctx.db, ctx.organizationId);
      if (!connection) throw new TRPCError({ code: 'NOT_FOUND', message: E.HRIS_NOT_CONNECTED });

      const priorConfig =
        connection.configJson && typeof connection.configJson === 'object'
          ? (connection.configJson as Record<string, unknown>)
          : {};
      await ctx.db.integrationConnection.update({
        where: { id: connection.id },
        data: { configJson: { ...priorConfig, mapping: input.mapping } },
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        action: 'hris.mapping.update',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
      });
      return { success: true };
    }),
});
