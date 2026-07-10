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
import { requireAddOn } from '../../middleware/add-on';
import { workforceFlagMiddleware } from '../../middleware/workforce-procedures';
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

const hrisReadProcedure = integrationSettingsProcedure('read')
  .use(requireAddOn('workforce'))
  .use(workforceFlagMiddleware);
const hrisWriteProcedure = integrationSettingsProcedure('update')
  .use(requireAddOn('workforce'))
  .use(workforceFlagMiddleware);

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
  getStatus: hrisReadProcedure.query(async ({ ctx }) => {
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
  connect: hrisWriteProcedure.input(connectInput).mutation(async ({ ctx, input }) => {
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
    const existingSameProvider = await ctx.db.integrationConnection.findFirst({
      where: {
        organizationId: ctx.organizationId,
        provider: input.provider,
      },
      select: { id: true, status: true, provider: true },
    });
    const disconnectedHris = await ctx.db.integrationConnection.findFirst({
      where: {
        organizationId: ctx.organizationId,
        provider: { in: ['PERSONIO', 'BAMBOOHR'] },
        status: 'DISCONNECTED',
      },
      select: { id: true, status: true, provider: true },
    });

    created = await ctx.db.$transaction(async tx => {
      let connectionId: string;

      if (existingSameProvider?.status === 'DISCONNECTED') {
        await tx.integrationConnection.update({
          where: { id: existingSameProvider.id },
          data: {
            status: 'CONNECTED',
            credentialsRef,
            connectedByUserId: ctx.user.id,
            tokenExpiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            lastErrorAt: null,
          },
        });
        connectionId = existingSameProvider.id;
      } else if (existingSameProvider) {
        throw new TRPCError({ code: 'CONFLICT', message: E.HRIS_ALREADY_CONNECTED });
      } else if (disconnectedHris) {
        await tx.integrationConnection.update({
          where: { id: disconnectedHris.id },
          data: {
            provider: input.provider,
            status: 'CONNECTED',
            credentialsRef,
            connectedByUserId: ctx.user.id,
            tokenExpiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            lastErrorAt: null,
            lastErrorMessage: null,
          },
        });
        connectionId = disconnectedHris.id;
      } else {
        try {
          const row = await tx.integrationConnection.create({
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
          connectionId = row.id;
        } catch (err) {
          if (isOneHrisPerOrgViolation(err)) {
            throw new TRPCError({ code: 'CONFLICT', message: E.HRIS_ALREADY_CONNECTED });
          }
          throw err;
        }
      }

      await writeAuditLog({
        tx,
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        action: 'hris.connect',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        newValues: {
          provider: input.provider,
          connectionId,
          reactivatedFrom: disconnectedHris?.provider ?? null,
        },
      });

      return { id: connectionId };
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
  disconnect: hrisWriteProcedure.mutation(async ({ ctx }) => {
    const connection = await loadOrgHrisConnection(ctx.db, ctx.organizationId);
    if (!connection) throw new TRPCError({ code: 'NOT_FOUND', message: E.HRIS_NOT_CONNECTED });

    await ctx.db.$transaction(async tx => {
      await tx.integrationConnection.update({
        where: { id: connection.id },
        data: { status: 'DISCONNECTED' },
      });
      await writeAuditLog({
        tx,
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        action: 'hris.disconnect',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        oldValues: { provider: connection.provider, connectionId: connection.id },
      });
    });
    return { id: connection.id };
  }),

  /** Run an on-demand pull for the connected HRIS. */
  syncNow: hrisWriteProcedure.mutation(async ({ ctx }) => {
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
  getMapping: hrisReadProcedure.query(async ({ ctx }) => {
    const connection = await loadOrgHrisConnection(ctx.db, ctx.organizationId);
    return resolveMapping(connection?.configJson);
  }),

  /** Write the field mapping (validated, credential-safe). */
  setMapping: hrisWriteProcedure.input(setMappingInput).mutation(async ({ ctx, input }) => {
    const connection = await loadOrgHrisConnection(ctx.db, ctx.organizationId);
    if (!connection) throw new TRPCError({ code: 'NOT_FOUND', message: E.HRIS_NOT_CONNECTED });

    const priorConfig =
      connection.configJson && typeof connection.configJson === 'object'
        ? (connection.configJson as Record<string, unknown>)
        : {};
    await ctx.db.$transaction(async tx => {
      await tx.integrationConnection.update({
        where: { id: connection.id },
        data: { configJson: { ...priorConfig, mapping: input.mapping } },
      });
      await writeAuditLog({
        tx,
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        action: 'hris.mapping.update',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
      });
    });
    return { success: true };
  }),

  /** Employees with no HRIS ExternalLink for the connected integration. */
  listUnlinkedEmployees: hrisReadProcedure.query(async ({ ctx }) => {
    const connection = await loadOrgHrisConnection(ctx.db, ctx.organizationId);
    if (!connection || connection.status !== 'CONNECTED') {
      return {
        employees: [] as Array<{
          workerId: string;
          displayName: string | null;
          email: string | null;
        }>,
      };
    }

    const linked = await ctx.db.externalLink.findMany({
      where: {
        organizationId: ctx.organizationId,
        integrationConnectionId: connection.id,
        entityType: { in: ['WORKER', 'EMPLOYEE'] },
      },
      select: { entityId: true },
    });
    const linkedIds = new Set(linked.map(row => row.entityId));

    const workers = await ctx.db.worker.findMany({
      where: {
        organizationId: ctx.organizationId,
        workerType: 'EMPLOYEE',
        deletedAt: null,
        ...(linkedIds.size > 0 ? { id: { notIn: [...linkedIds] } } : {}),
      },
      select: { id: true, displayName: true, email: true },
      orderBy: { displayName: 'asc' },
    });

    return {
      employees: workers.map(w => ({
        workerId: w.id,
        displayName: w.displayName,
        email: w.email,
      })),
    };
  }),

  /** Manually link a local employee to an HRIS remote person id. */
  linkEmployee: hrisWriteProcedure
    .input(
      z
        .object({
          workerId: z.string().min(1),
          externalId: z.string().min(1),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const connection = await loadOrgHrisConnection(ctx.db, ctx.organizationId);
      if (!connection || connection.status !== 'CONNECTED') {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.HRIS_NOT_CONNECTED });
      }
      assertProviderEnabled(
        connection.provider as HrisProviderInput,
        ctx.organizationId,
        ctx.region,
      );

      const worker = await ctx.db.worker.findFirst({
        where: {
          id: input.workerId,
          organizationId: ctx.organizationId,
          workerType: 'EMPLOYEE',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!worker) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.WORKER_NOT_FOUND });
      }

      const existingWorkerLink = await ctx.db.externalLink.findFirst({
        where: {
          organizationId: ctx.organizationId,
          integrationConnectionId: connection.id,
          entityId: input.workerId,
          entityType: { in: ['WORKER', 'EMPLOYEE'] },
        },
        select: { id: true },
      });
      if (existingWorkerLink) {
        throw new TRPCError({ code: 'CONFLICT', message: E.HRIS_EMPLOYEE_ALREADY_LINKED });
      }

      const existingExternalLink = await ctx.db.externalLink.findFirst({
        where: {
          organizationId: ctx.organizationId,
          integrationConnectionId: connection.id,
          externalId: input.externalId,
        },
        select: { id: true },
      });
      if (existingExternalLink) {
        throw new TRPCError({ code: 'CONFLICT', message: E.HRIS_EXTERNAL_ID_ALREADY_LINKED });
      }

      const link = await ctx.db.$transaction(async tx => {
        const row = await tx.externalLink.create({
          data: {
            organizationId: ctx.organizationId,
            integrationConnectionId: connection.id,
            entityType: 'WORKER',
            entityId: input.workerId,
            externalType: 'HRIS_EMPLOYEE',
            externalId: input.externalId,
          },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user.id,
          action: 'hris.employee.linked',
          resourceType: 'WORKER',
          resourceId: input.workerId,
          newValues: { externalId: input.externalId, externalLinkId: row.id },
          metadata: { via: 'manual' },
        });

        return row;
      });

      return { id: link.id, workerId: input.workerId, externalId: input.externalId };
    }),
});
