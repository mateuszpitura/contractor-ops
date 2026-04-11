import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@contractor-ops/db";
import {
  KsefApiClient,
  ksefConnectionConfigSchema,
} from "@contractor-ops/einvoice";
import { encryptCredentials } from "@contractor-ops/integrations";
import { getQStashClient } from "@contractor-ops/integrations/services/qstash-client";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";
import { processKsefSync } from "../services/ksef-sync-orchestrator.js";
import * as E from "../errors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const connectInput = z.object({
  authMethod: z.enum(["token", "certificate"]),
  token: z.string().optional(),
  certificateBase64: z.string().optional(),
  certificatePassword: z.string().optional(),
  environment: z.enum(["test", "prod"]).default("prod"),
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
   * Per D-04: Verify credentials before saving.
   */
  connect: tenantProcedure
    .use(requirePermission({ settings: ["update"] }))
    .input(connectInput)
    .mutation(async ({ ctx, input }) => {
      // Step 1: Get org NIP (per D-03)
      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
      });
      const settingsJson =
        (org.settingsJson as Record<string, unknown> | null) ?? {};
      const nip = settingsJson.taxId as string | undefined;

      if (!nip) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Organization NIP must be set in settings before connecting KSeF.",
        });
      }

      // Step 2: Validate input
      ksefConnectionConfigSchema.parse(input);

      // Step 3: Verify credentials before saving (per D-04)
      const client = new KsefApiClient(input.environment);

      if (input.authMethod === "token") {
        if (!input.token) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Token is required for token-based auth.",
          });
        }
        const valid = await client.verifyCredentials(input.token, nip);
        if (!valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "KSeF credential verification failed",
          });
        }
      }

      // Step 4: Build and encrypt credential blob
      const credentialsRef = encryptCredentials(
        {
          accessToken: input.token ?? "",
          extra: {
            certificateBase64: input.certificateBase64,
            certificatePassword: input.certificatePassword,
            authMethod: input.authMethod,
          },
        },
        "ksef",
      );

      // Step 5: Upsert IntegrationConnection (use findFirst + create/update)
      const existing = await prisma.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: "KSEF",
        },
      });

      let connection;
      if (existing) {
        connection = await prisma.integrationConnection.update({
          where: { id: existing.id },
          data: {
            status: "CONNECTED",
            configJson: {
              authMethod: input.authMethod,
              environment: input.environment,
            },
            credentialsRef,
            connectedByUserId: ctx.user!.id,
            connectedAt: new Date(),
          },
        });
      } else {
        connection = await prisma.integrationConnection.create({
          data: {
            organizationId: ctx.organizationId,
            provider: "KSEF",
            status: "CONNECTED",
            configJson: {
              authMethod: input.authMethod,
              environment: input.environment,
            },
            credentialsRef,
            connectedByUserId: ctx.user!.id,
          },
        });
      }

      // Step 6: Create QStash cron schedule (per D-05)
      try {
        const qstash = getQStashClient();
        const schedule = await qstash.schedules.create({
          destination: `${process.env.NEXT_PUBLIC_APP_URL}/api/ksef/_sync`,
          cron: "0 * * * *",
          body: JSON.stringify({
            organizationId: ctx.organizationId,
            connectionId: connection.id,
          }),
          retries: 2,
        });

        // Store schedule ID in configJson
        const currentConfig =
          (connection.configJson as Record<string, unknown>) ?? {};
        await prisma.integrationConnection.update({
          where: { id: connection.id },
          data: {
            configJson: {
              ...currentConfig,
              qstashScheduleId: schedule.scheduleId,
            },
          },
        });
      } catch (error) {
        console.error(
          "[ksef.connect] Failed to create QStash schedule:",
          error,
        );
        // Don't fail the connection — schedule can be retried
      }

      return plain(connection);
    }),

  /**
   * Disconnect organization from KSeF.
   * Deletes QStash schedule and sets status to DISCONNECTED.
   */
  disconnect: tenantProcedure
    .use(requirePermission({ settings: ["update"] }))
    .mutation(async ({ ctx }) => {
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: "KSEF",
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.INTEGRATION_NOT_FOUND,
        });
      }

      // Delete QStash schedule if it exists
      const configJson =
        (connection.configJson as Record<string, unknown>) ?? {};
      const scheduleId = configJson.qstashScheduleId as string | undefined;

      if (scheduleId) {
        try {
          const qstash = getQStashClient();
          await qstash.schedules.delete(scheduleId);
        } catch (error) {
          console.error(
            "[ksef.disconnect] Failed to delete QStash schedule:",
            error,
          );
        }
      }

      await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          status: "DISCONNECTED",
          configJson: { ...configJson, qstashScheduleId: null },
        },
      });

      return { success: true };
    }),

  /**
   * Trigger an immediate KSeF sync via QStash (per D-06).
   * Dispatches a one-off QStash job (not cron).
   */
  triggerSync: tenantProcedure
    .use(requirePermission({ settings: ["update"] }))
    .mutation(async ({ ctx }) => {
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: "KSEF",
          status: "CONNECTED",
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.INTEGRATION_NOT_CONNECTED,
        });
      }

      const qstash = getQStashClient();
      await qstash.publishJSON({
        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/ksef/_sync`,
        body: {
          organizationId: ctx.organizationId,
          connectionId: connection.id,
        },
      });

      return { triggered: true };
    }),

  /**
   * Get KSeF sync history (per D-07).
   * Returns recent IntegrationSyncLog entries for the KSeF connection.
   */
  syncHistory: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .input(syncHistoryInput)
    .query(async ({ ctx, input }) => {
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: "KSEF",
        },
        select: { id: true },
      });

      if (!connection) {
        return { logs: [] };
      }

      const logs = await prisma.integrationSyncLog.findMany({
        where: {
          integrationConnectionId: connection.id,
        },
        orderBy: { startedAt: "desc" },
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

      return plain({ logs });
    }),

  /**
   * Get KSeF connection status.
   * Returns the IntegrationConnection for KSEF provider, or null if not connected.
   */
  connectionStatus: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .query(async ({ ctx }) => {
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: "KSEF",
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

      return connection ? plain(connection) : null;
    }),
});
