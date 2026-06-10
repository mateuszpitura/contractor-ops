import type { IntegrationConnection } from '@contractor-ops/db/generated/prisma/client';
import { storeCredentials } from '@contractor-ops/integrations';
import { getQStashClient } from '@contractor-ops/integrations/services/qstash-client';
import { createLogger } from '@contractor-ops/logger';
import {
  connectPeppolSchema,
  getServerEnv,
  getTransmissionByInvoiceIdSchema,
  getTransmissionsSchema,
  peppolLookupCapabilitiesSchema,
  retryTransmissionSchema,
} from '@contractor-ops/validators';
import * as Sentry from '@sentry/node';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';

const log = createLogger({ service: 'peppol-router' });

import { router } from '../../init';
import { loadOrgIntegrationConnection } from '../../lib/integration-connection.js';
import {
  integrationProcedure,
  integrationSettingsProcedure,
} from '../../lib/integration-procedure';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { buildStorecoveAdapterForOrg } from '../../services/peppol-adapter-factory';
import { getCapabilitiesWithCache, supportsXRechnungCii } from '../../services/peppol-capability';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Peppol Router
// ---------------------------------------------------------------------------

export const peppolRouter = router({
  /**
   * Connect organization to the Peppol network via an ASP.
   * Validates TRN, encrypts ASP credentials, creates PeppolParticipant and
   * IntegrationConnection records, and schedules a QStash polling CRON.
   */
  connect: integrationSettingsProcedure('update')
    .input(connectPeppolSchema)
    .mutation(async ({ ctx, input }) => {
      const participantId = `0192:${input.trn}`;

      // Check if already connected
      const existing = await ctx.db.peppolParticipant.findFirst({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ['PENDING', 'REGISTERED', 'ACTIVE'] },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: E.PEPPOL_ALREADY_CONNECTED,
        });
      }

      // Store ASP credentials in secret store
      const credentialsRef = await storeCredentials(
        {
          accessToken: input.apiKey,
          extra: {
            aspProvider: input.aspProvider,
            environment: input.environment,
          },
        },
        ctx.organizationId,
        'peppol',
      );

      // Upsert IntegrationConnection
      const existingConnection = await loadOrgIntegrationConnection(
        ctx.db,
        ctx.organizationId,
        'PEPPOL',
        { status: 'any', optional: true },
      );

      let connection: IntegrationConnection;
      if (existingConnection) {
        connection = await ctx.db.integrationConnection.update({
          where: { id: existingConnection.id },
          data: {
            status: 'CONNECTED',
            configJson: {
              aspProvider: input.aspProvider,
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
            provider: 'PEPPOL',
            status: 'CONNECTED',
            configJson: {
              aspProvider: input.aspProvider,
              environment: input.environment,
            },
            credentialsRef,
            connectedByUserId: ctx.user.id,
          },
        });
      }

      // Create PeppolParticipant
      const participant = await ctx.db.peppolParticipant.create({
        data: {
          organizationId: ctx.organizationId,
          participantId,
          schemeId: '0192',
          identifierValue: input.trn,
          aspProvider: input.aspProvider,
          status: 'PENDING',
        },
      });

      // Schedule QStash polling CRON (every 15 minutes)
      // F-ASYNC-12: surface failures via lastErrorMessage + Sentry.
      // F-ASYNC-18: bump retries 2 → 5 to absorb Storecove transient blips.
      try {
        const qstash = getQStashClient();
        const schedule = await qstash.schedules.create({
          destination: `${getServerEnv().API_URL}/peppol/poll`,
          cron: '*/15 * * * *',
          body: JSON.stringify({
            organizationId: ctx.organizationId,
          }),
          retries: 5,
        });

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
          'failed to create Peppol QStash polling schedule',
        );
        Sentry.captureException(error, {
          tags: { 'integration.provider': 'PEPPOL', 'qstash.outcome': 'schedule-create-failed' },
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

      return { participant, connection };
    }),

  /**
   * Disconnect organization from the Peppol network.
   * Deregisters the participant and sets IntegrationConnection to DISCONNECTED.
   */
  disconnect: integrationSettingsProcedure('update').mutation(async ({ ctx }) => {
      const participant = await ctx.db.peppolParticipant.findFirst({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ['PENDING', 'REGISTERED', 'ACTIVE'] },
        },
      });

      if (!participant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.INTEGRATION_NOT_FOUND,
        });
      }

      // Deregister participant
      await ctx.db.peppolParticipant.update({
        where: { id: participant.id },
        data: { status: 'DEREGISTERED' },
      });

      // Update IntegrationConnection
      const connection = await loadOrgIntegrationConnection(
        ctx.db,
        ctx.organizationId,
        'PEPPOL',
        { status: 'any', optional: true },
      );

      if (connection) {
        // Delete QStash schedule if it exists
        const configJson = (connection.configJson as Record<string, unknown>) ?? {};
        const scheduleId = configJson.qstashScheduleId as string | undefined;

        if (scheduleId) {
          try {
            const qstash = getQStashClient();
            await qstash.schedules.delete(scheduleId);
          } catch (error) {
            // F-ASYNC-12: orphan-tracking log line + Sentry.
            log.error(
              {
                err: error,
                organizationId: ctx.organizationId,
                scheduleId,
                event: 'qstash_schedule_orphans',
              },
              'failed to delete Peppol QStash schedule on disconnect — schedule may be orphaned',
            );
            Sentry.captureException(error, {
              tags: {
                'integration.provider': 'PEPPOL',
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
      }

      return { success: true };
    }),

  /**
   * Get current Peppol connection status for the organization.
   * Returns participant and connection details, or null if not connected.
   */
  getStatus: integrationSettingsProcedure('read').query(async ({ ctx }) => {
      const participant = await ctx.db.peppolParticipant.findFirst({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ['PENDING', 'REGISTERED', 'ACTIVE'] },
        },
      });

      if (!participant) {
        return null;
      }

      const connection = await loadOrgIntegrationConnection(
        ctx.db,
        ctx.organizationId,
        'PEPPOL',
        { status: 'any', optional: true },
      );

      return { participant, connection };
    }),

  /**
   * Get PeppolParticipant for the organization with transmission counts.
   */
  getParticipant: integrationSettingsProcedure('read').query(async ({ ctx }) => {
      const participant = await ctx.db.peppolParticipant.findFirst({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ['PENDING', 'REGISTERED', 'ACTIVE'] },
        },
        include: {
          _count: {
            select: {
              transmissions: true,
            },
          },
        },
      });

      if (!participant) {
        return null;
      }

      // Get transmission counts by status
      const [sentCount, receivedCount, failedCount] = await Promise.all([
        ctx.db.peppolTransmission.count({
          where: {
            organizationId: ctx.organizationId,
            peppolParticipantId: participant.id,
            direction: 'OUTBOUND',
          },
        }),
        ctx.db.peppolTransmission.count({
          where: {
            organizationId: ctx.organizationId,
            peppolParticipantId: participant.id,
            direction: 'INBOUND',
          },
        }),
        ctx.db.peppolTransmission.count({
          where: {
            organizationId: ctx.organizationId,
            peppolParticipantId: participant.id,
            status: { in: ['FAILED', 'REJECTED'] },
          },
        }),
      ]);

      return {
        ...participant,
        _count: {
          sentTransmissions: sentCount,
          receivedTransmissions: receivedCount,
          failedTransmissions: failedCount,
        },
      };
    }),

  /**
   * Get the latest PeppolTransmission for a specific invoice.
   * Includes participant relation for receiver context.
   * Used by the invoice detail page to show transmission status.
   */
  getTransmissionByInvoiceId: integrationProcedure({ permission: { invoice: ['read'] } })
    .input(getTransmissionByInvoiceIdSchema)
    .query(async ({ ctx, input }) => {
      const transmission = await ctx.db.peppolTransmission.findFirst({
        where: {
          organizationId: ctx.organizationId,
          invoiceId: input.invoiceId,
        },
        include: {
          participant: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!transmission) return null;

      return {
        ...transmission,
        // Map participant data for UI consumption
        receiverParticipantId: transmission.participant.participantId,
        receiverSchemeId: transmission.participant.schemeId,
      };
    }),

  /**
   * Get paginated list of PeppolTransmissions for the organization.
   * Supports cursor-based pagination and direction filtering.
   */
  getTransmissions: integrationSettingsProcedure('read')
    .input(getTransmissionsSchema)
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        organizationId: ctx.organizationId,
      };

      if (input.direction) {
        where.direction = input.direction;
      }

      const transmissions = await ctx.db.peppolTransmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...cursorClause(input),
      });

      const { items, nextCursor } = paginateByLastKeptUndefined(transmissions, input);
      return { transmissions: items, nextCursor };
    }),

  /**
   * Retry a failed Peppol transmission.
   * Resets the status to PENDING so the outbound processor picks it up.
   */
  retryTransmission: integrationSettingsProcedure('update')
    .input(retryTransmissionSchema)
    .mutation(async ({ ctx, input }) => {
      const transmission = await ctx.db.peppolTransmission.findFirst({
        where: {
          id: input.transmissionId,
          organizationId: ctx.organizationId,
          status: { in: ['FAILED', 'REJECTED'] },
        },
      });

      if (!transmission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.EINVOICE_FAILED_TRANSMISSION_NOT_RETRYABLE,
        });
      }

      const updated = await ctx.db.peppolTransmission.update({
        where: { id: transmission.id },
        data: {
          status: 'PENDING',
          errorMessage: null,
        },
      });

      return updated;
    }),

  // -------------------------------------------------------------------------
  // Phase 61 · Plan 61-05 — XRechnung capability lookup + participant listing
  // -------------------------------------------------------------------------

  /**
   * Lookup a Peppol participant's SMP-registered document-type capabilities
   * via the Storecove discovery endpoint. Results are cached per-org for
   * 6h in `PeppolCapabilityCache` (CONTEXT D-11); callers can bypass the
   * cache with `forceRefresh: true`.
   *
   * Surface semantics:
   *  - Always returns the capability list + a computed `supportsXRechnungCii`
   *    flag so the Settings UI can render the send-gate pill without a
   *    second call.
   *  - Side effect: when the looked-up participant matches the org's OWN
   *    registered PeppolParticipant, updates `supportsXRechnungCii` +
   *    `lastCapabilityCheckAt` on the participant row.
   */
  lookupCapabilities: integrationSettingsProcedure('read')
    .input(peppolLookupCapabilitiesSchema)
    .query(async ({ ctx, input }) => {
      const adapter = await buildStorecoveAdapterForOrg(ctx.db as never, ctx.organizationId);
      if (!adapter) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.PEPPOL_NOT_CONNECTED,
        });
      }

      const capability = await getCapabilitiesWithCache(
        ctx.db as never,
        adapter,
        ctx.organizationId,
        input.schemeId,
        input.value,
        { forceRefresh: input.forceRefresh },
      );

      const hasXRechnungCii = supportsXRechnungCii(capability.documentTypes);

      // Side-effect: if this lookup matches the org's own participant row,
      // mirror the capability + last-check timestamp so the Settings UI
      // and the send-gate both read from the same source of truth.
      const ownParticipant = await ctx.db.peppolParticipant.findFirst({
        where: {
          organizationId: ctx.organizationId,
          schemeId: input.schemeId,
          identifierValue: input.value,
        },
        select: { id: true },
      });
      if (ownParticipant) {
        await ctx.db.peppolParticipant.update({
          where: { id: ownParticipant.id },
          data: {
            supportsXRechnungCii: hasXRechnungCii,
            lastCapabilityCheckAt: new Date(),
          },
        });
      }

      return {
        schemeId: capability.schemeId,
        value: capability.value,
        documentTypes: capability.documentTypes,
        fetchedAt: capability.fetchedAt,
        expiresAt: capability.expiresAt,
        fromCache: capability.fromCache,
        supportsXRechnungCii: hasXRechnungCii,
      };
    }),

  /**
   * List every PeppolParticipant row for the current org, including the
   * XRechnung-CII capability flag + last-check timestamp (RESEARCH Option A
   * — single source of truth).  Consumed by the Plan 07 Settings page.
   */
  listParticipants: integrationSettingsProcedure('read').query(async ({ ctx }) => {
      const participants = await ctx.db.peppolParticipant.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { createdAt: 'desc' },
      });
      return participants;
    }),
});
