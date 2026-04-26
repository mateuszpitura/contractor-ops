import type { IntegrationConnection } from '@contractor-ops/db/generated/prisma/client';
import { storeCredentials } from '@contractor-ops/integrations';
import { getQStashClient } from '@contractor-ops/integrations/services/qstash-client';
import {
  connectPeppolSchema,
  getServerEnv,
  getTransmissionByInvoiceIdSchema,
  getTransmissionsSchema,
  peppolLookupCapabilitiesSchema,
  retryTransmissionSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import * as E from '../errors.js';
import { router } from '../init.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { buildStorecoveAdapterForOrg } from '../services/peppol-adapter-factory.js';
import { getCapabilitiesWithCache, supportsXRechnungCii } from '../services/peppol-capability.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ---------------------------------------------------------------------------
// Peppol Router
// ---------------------------------------------------------------------------

export const peppolRouter = router({
  /**
   * Connect organization to the Peppol network via an ASP.
   * Validates TRN, encrypts ASP credentials, creates PeppolParticipant and
   * IntegrationConnection records, and schedules a QStash polling CRON.
   */
  connect: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
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
          message: 'Organization already has an active Peppol participant. Disconnect first.',
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
      const existingConnection = await ctx.db.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: 'PEPPOL',
        },
      });

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
            connectedByUserId: ctx.user?.id,
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
            connectedByUserId: ctx.user?.id,
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
      try {
        const qstash = getQStashClient();
        const schedule = await qstash.schedules.create({
          destination: `${getServerEnv().NEXT_PUBLIC_APP_URL}/api/peppol/poll`,
          cron: '*/15 * * * *',
          body: JSON.stringify({
            organizationId: ctx.organizationId,
          }),
          retries: 2,
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
        console.error('[peppol.connect] Failed to create QStash schedule:', error);
        // Don't fail the connection — schedule can be retried
      }

      return plain({ participant, connection });
    }),

  /**
   * Disconnect organization from the Peppol network.
   * Deregisters the participant and sets IntegrationConnection to DISCONNECTED.
   */
  disconnect: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .mutation(async ({ ctx }) => {
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
      const connection = await ctx.db.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: 'PEPPOL',
        },
      });

      if (connection) {
        // Delete QStash schedule if it exists
        const configJson = (connection.configJson as Record<string, unknown>) ?? {};
        const scheduleId = configJson.qstashScheduleId as string | undefined;

        if (scheduleId) {
          try {
            const qstash = getQStashClient();
            await qstash.schedules.delete(scheduleId);
          } catch (error) {
            console.error('[peppol.disconnect] Failed to delete QStash schedule:', error);
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
  getStatus: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      const participant = await ctx.db.peppolParticipant.findFirst({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ['PENDING', 'REGISTERED', 'ACTIVE'] },
        },
      });

      if (!participant) {
        return null;
      }

      const connection = await ctx.db.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: 'PEPPOL',
        },
        select: {
          id: true,
          status: true,
          configJson: true,
          lastSyncAt: true,
          lastSuccessAt: true,
          lastErrorAt: true,
          lastErrorMessage: true,
          connectedAt: true,
        },
      });

      return plain({ participant, connection });
    }),

  /**
   * Get PeppolParticipant for the organization with transmission counts.
   */
  getParticipant: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
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

      return plain({
        ...participant,
        _count: {
          sentTransmissions: sentCount,
          receivedTransmissions: receivedCount,
          failedTransmissions: failedCount,
        },
      });
    }),

  /**
   * Get the latest PeppolTransmission for a specific invoice.
   * Includes participant relation for receiver context.
   * Used by the invoice detail page to show transmission status.
   */
  getTransmissionByInvoiceId: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
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

      return plain({
        ...transmission,
        // Map participant data for UI consumption
        receiverParticipantId: transmission.participant.participantId,
        receiverSchemeId: transmission.participant.schemeId,
      });
    }),

  /**
   * Get paginated list of PeppolTransmissions for the organization.
   * Supports cursor-based pagination and direction filtering.
   */
  getTransmissions: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
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
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (transmissions.length > input.limit) {
        const next = transmissions.pop();
        nextCursor = next?.id;
      }

      return plain({ transmissions, nextCursor });
    }),

  /**
   * Retry a failed Peppol transmission.
   * Resets the status to PENDING so the outbound processor picks it up.
   */
  retryTransmission: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
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
          message: 'Failed transmission not found or not in retryable state.',
        });
      }

      const updated = await ctx.db.peppolTransmission.update({
        where: { id: transmission.id },
        data: {
          status: 'PENDING',
          errorMessage: null,
        },
      });

      return plain(updated);
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
  lookupCapabilities: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .input(peppolLookupCapabilitiesSchema)
    .query(async ({ ctx, input }) => {
      const adapter = await buildStorecoveAdapterForOrg(ctx.db as never, ctx.organizationId);
      if (!adapter) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'PEPPOL_NOT_CONNECTED',
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

      return plain({
        schemeId: capability.schemeId,
        value: capability.value,
        documentTypes: capability.documentTypes,
        fetchedAt: capability.fetchedAt,
        expiresAt: capability.expiresAt,
        fromCache: capability.fromCache,
        supportsXRechnungCii: hasXRechnungCii,
      });
    }),

  /**
   * List every PeppolParticipant row for the current org, including the
   * XRechnung-CII capability flag + last-check timestamp (RESEARCH Option A
   * — single source of truth).  Consumed by the Plan 07 Settings page.
   */
  listParticipants: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      const participants = await ctx.db.peppolParticipant.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { createdAt: 'desc' },
      });
      return plain(participants);
    }),
});
