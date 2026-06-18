import type { IntegrationConnection } from '@contractor-ops/db/generated/prisma/client';
import { KsefApiClient, ksefConnectionConfigSchema } from '@contractor-ops/einvoice';
import { encryptCredentials } from '@contractor-ops/integrations';
import { getQStashClient } from '@contractor-ops/integrations/services/qstash-client';
import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import * as Sentry from '@sentry/node';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { loadOrgIntegrationConnection } from '../../lib/integration-connection.js';
import { integrationSettingsProcedure } from '../../lib/integration-procedure';
import { writeAuditLog } from '../../services/audit-writer';

const log = createLogger({ service: 'ksef-router' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const connectInput = z.object({
  authMethod: z.enum(['token', 'certificate']),
  token: z.string().optional(),
  certificateBase64: z.string().optional(),
  certificatePassword: z.string().optional(),
  environment: z.enum(['test', 'prod']).default('prod'),
});

const syncHistoryInput = z.object({
  limit: z.number().min(1).max(50).default(10),
});

// ---------------------------------------------------------------------------
// KSeF Router
// ---------------------------------------------------------------------------

export const ksefRouter = router({
  /**
   * Connect organization to KSeF.
   * Validates credentials, encrypts and stores them, creates QStash cron schedule.
   * Verifies credentials before saving.
   */
  connect: integrationSettingsProcedure('update')
    .input(connectInput)
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sequential connect flow — resolve NIP → validate credentials → encrypt → persist settings → create QStash cron schedule, each step gated; cohesive orchestration.
    .mutation(async ({ ctx, input }) => {
      // Step 1: Get org NIP
      const org = await ctx.db.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
      });
      const settingsJson = (org.settingsJson as Record<string, unknown> | null) ?? {};
      const nip = settingsJson.taxId as string | undefined;

      if (!nip) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.KSEF_REQUIRES_NIP,
        });
      }

      // Step 2: Validate input
      ksefConnectionConfigSchema.parse(input);

      // Step 3: Verify credentials before saving
      const client = new KsefApiClient(input.environment);

      if (input.authMethod === 'token') {
        if (!input.token) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.TOKEN_REQUIRED,
          });
        }
        const valid = await client.verifyCredentials(input.token, nip);
        if (!valid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.KSEF_CREDENTIAL_VERIFICATION_FAILED,
          });
        }
      }

      // Step 4: Build and encrypt credential blob
      const credentialsRef = encryptCredentials(
        {
          accessToken: input.token ?? '',
          extra: {
            certificateBase64: input.certificateBase64,
            certificatePassword: input.certificatePassword,
            authMethod: input.authMethod,
          },
        },
        'ksef',
      );

      // Step 5: Upsert IntegrationConnection (use findFirst + create/update)
      const existing = await loadOrgIntegrationConnection(ctx.db, ctx.organizationId, 'KSEF', {
        status: 'any',
        optional: true,
      });

      let connection: IntegrationConnection;
      if (existing) {
        connection = await ctx.db.integrationConnection.update({
          where: { id: existing.id },
          data: {
            status: 'CONNECTED',
            configJson: {
              authMethod: input.authMethod,
              environment: input.environment,
            },
            credentialsRef,
            connectedByUserId: ctx.user.id,
            connectedAt: new Date(),
          },
        });
      } else {
        connection = await ctx.db.integrationConnection.create({
          data: {
            organizationId: ctx.organizationId,
            provider: 'KSEF',
            status: 'CONNECTED',
            configJson: {
              authMethod: input.authMethod,
              environment: input.environment,
            },
            credentialsRef,
            connectedByUserId: ctx.user.id,
          },
        });
      }

      // Step 6: Create QStash cron schedule
      // Surface schedule-create failures via lastErrorMessage so the UI can
      // show "schedule unhealthy" instead of the connection appearing
      // CONNECTED with no syncs running. Retries bumped to 5 since KSeF
      // gov API stability is poor; a multi-hour outage would otherwise drop
      // the hourly sync.
      try {
        const qstash = getQStashClient();
        const schedule = await qstash.schedules.create({
          destination: `${getServerEnv().API_URL}/ksef/_sync`,
          cron: '0 * * * *',
          body: JSON.stringify({
            organizationId: ctx.organizationId,
            connectionId: connection.id,
          }),
          retries: 5,
        });

        // Store schedule ID in configJson
        const currentConfig = (connection.configJson as Record<string, unknown>) ?? {};
        await ctx.db.integrationConnection.update({
          where: { id: connection.id },
          data: {
            configJson: {
              ...currentConfig,
              qstashScheduleId: schedule.scheduleId,
            },
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Schedule create failed';
        log.error(
          { err: error, organizationId: ctx.organizationId, connectionId: connection.id },
          'failed to create KSeF QStash sync schedule',
        );
        Sentry.captureException(error, {
          tags: { 'integration.provider': 'KSEF', 'qstash.outcome': 'schedule-create-failed' },
          extra: { organizationId: ctx.organizationId, connectionId: connection.id },
        });
        await ctx.db.integrationConnection.update({
          where: { id: connection.id },
          data: {
            lastErrorAt: new Date(),
            lastErrorMessage: `QStash schedule create failed: ${message.slice(0, 400)}`,
          },
        });
      }

      // KSeF connect persists encrypted credentials and starts hourly invoice
      // sync to the Polish tax authority. We never log the credential payload
      // — only authMethod + environment.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: existing ? 'INTEGRATION_RECONNECT' : 'INTEGRATION_CONNECT',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        newValues: {
          provider: 'KSEF',
          authMethod: input.authMethod,
          environment: input.environment,
        },
        metadata: { connectionId: connection.id },
      });

      return connection;
    }),

  /**
   * Disconnect organization from KSeF.
   * Deletes QStash schedule and sets status to DISCONNECTED.
   */
  disconnect: integrationSettingsProcedure('update').mutation(async ({ ctx }) => {
    const connection = await loadOrgIntegrationConnection(ctx.db, ctx.organizationId, 'KSEF', {
      status: 'any',
      notFoundMessage: E.INTEGRATION_NOT_FOUND,
    });

    // Delete QStash schedule if it exists
    const configJson = (connection.configJson as Record<string, unknown>) ?? {};
    const scheduleId = configJson.qstashScheduleId as string | undefined;

    if (scheduleId) {
      try {
        const qstash = getQStashClient();
        await qstash.schedules.delete(scheduleId);
      } catch (error) {
        // Schedule delete failed — schedule will keep firing for a
        // connection that no longer exists. Surface as a Sentry event +
        // an ops-greppable log line so the periodic orphan sweeper (or a
        // human) can clean it up.
        log.error(
          {
            err: error,
            organizationId: ctx.organizationId,
            scheduleId,
            event: 'qstash_schedule_orphans',
          },
          'failed to delete KSeF QStash schedule on disconnect — schedule may be orphaned',
        );
        Sentry.captureException(error, {
          tags: {
            'integration.provider': 'KSEF',
            'qstash.outcome': 'schedule-delete-failed',
          },
          extra: { organizationId: ctx.organizationId, scheduleId },
        });
      }
    }

    await ctx.db.integrationConnection.update({
      where: { id: connection.id },
      data: {
        status: 'DISCONNECTED',
        configJson: { ...configJson, qstashScheduleId: null },
      },
    });

    // Disconnecting KSeF stops hourly invoice sync to the Polish tax
    // authority. Forensics-critical.
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user?.id ?? null,
      action: 'INTEGRATION_DISCONNECT',
      resourceType: 'ORGANIZATION',
      resourceId: ctx.organizationId,
      oldValues: { provider: 'KSEF', status: connection.status },
      newValues: { status: 'DISCONNECTED' },
      metadata: { connectionId: connection.id },
    });

    return { success: true };
  }),

  /**
   * Trigger an immediate KSeF sync via QStash.
   * Dispatches a one-off QStash job (not cron).
   */
  triggerSync: integrationSettingsProcedure('update').mutation(async ({ ctx }) => {
    const connection = await loadOrgIntegrationConnection(ctx.db, ctx.organizationId, 'KSEF', {
      notFoundMessage: E.INTEGRATION_NOT_CONNECTED,
    });

    const qstash = getQStashClient();
    await qstash.publishJSON({
      url: `${getServerEnv().API_URL}/ksef/_sync`,
      body: {
        organizationId: ctx.organizationId,
        connectionId: connection.id,
      },
    });

    return { triggered: true };
  }),

  /**
   * Get KSeF sync history.
   * Returns recent IntegrationSyncLog entries for the KSeF connection.
   */
  syncHistory: integrationSettingsProcedure('read')
    .input(syncHistoryInput)
    .query(async ({ ctx, input }) => {
      const connection = await loadOrgIntegrationConnection(ctx.db, ctx.organizationId, 'KSEF', {
        status: 'any',
        optional: true,
      });

      if (!connection) {
        return { logs: [] };
      }

      const logs = await ctx.db.integrationSyncLog.findMany({
        where: {
          integrationConnectionId: connection.id,
        },
        orderBy: { startedAt: 'desc' },
        take: input.limit,
        select: {
          id: true,
          syncType: true,
          status: true,
          direction: true,
          errorMessage: true,
          responsePayloadJson: true,
          startedAt: true,
          completedAt: true,
        },
      });

      return { logs };
    }),

  /**
   * Get KSeF connection status.
   * Returns the IntegrationConnection for KSEF provider, or null if not connected.
   */
  connectionStatus: integrationSettingsProcedure('read').query(async ({ ctx }) => {
    const connection = await loadOrgIntegrationConnection(ctx.db, ctx.organizationId, 'KSEF', {
      status: 'any',
      optional: true,
    });

    return connection ? connection : null;
  }),
});
