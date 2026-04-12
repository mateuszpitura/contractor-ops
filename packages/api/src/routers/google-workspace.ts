import { auth } from "@contractor-ops/auth";
import type { Prisma } from "@contractor-ops/db";
import { prisma } from "@contractor-ops/db";
import {
  decryptCredentials,
  encryptCredentials,
  getAdapter,
  registerAllAdapters,
} from "@contractor-ops/integrations";
import type { GoogleWorkspaceAdapter } from "@contractor-ops/integrations/adapters/google-workspace-adapter";
import { getQStashClient } from "@contractor-ops/integrations/services/qstash-client";
import type { DirectoryRole } from "@contractor-ops/validators";
import { directoryImportInputSchema } from "@contractor-ops/validators";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../init.js";
import { requirePermission } from "../middleware/rbac.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requireTier } from "../middleware/tier.js";

// Ensure adapters are registered before any procedure runs
registerAllAdapters();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Loads the active Google Workspace connection for an organization,
 * decrypts credentials, refreshes token if expired, and returns adapter.
 */
async function getGoogleWorkspaceConnection(organizationId: string) {
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: "GOOGLE_WORKSPACE",
      status: "CONNECTED",
    },
  });

  if (!connection) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Google Workspace not connected",
    });
  }

  const adapter = getAdapter("google_workspace") as GoogleWorkspaceAdapter;
  if (!adapter) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Google Workspace adapter not registered",
    });
  }

  let credentials = decryptCredentials(connection.credentialsRef, "google_workspace");

  // Refresh token if expired
  if (credentials.expiresAt && new Date(credentials.expiresAt) < new Date()) {
    credentials = await adapter.refreshToken(credentials);
    const encrypted = encryptCredentials(credentials, "google_workspace");
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        credentialsRef: encrypted,
        tokenExpiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null,
      },
    });
  }

  return { connection, credentials, adapter };
}

/**
 * Creates a QStash cron schedule for daily directory sync at 2 AM.
 * Idempotent: skips if schedule already exists in connection config.
 */
async function ensureSyncCronSchedule(connectionId: string, organizationId: string) {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
    select: { configJson: true },
  });
  const config = (connection?.configJson ?? {}) as Record<string, unknown>;
  if (config.syncScheduleId) return; // Already has a schedule

  try {
    const qstashClient = getQStashClient();
    const scheduleId = `gw-sync-${organizationId}`;

    const schedule = await qstashClient.schedules.create({
      destination: `${process.env.NEXT_PUBLIC_APP_URL}/api/google-workspace/_sync`,
      body: JSON.stringify({ organizationId, connectionId }),
      cron: "0 2 * * *", // Daily at 2 AM
      scheduleId,
    });

    await prisma.integrationConnection.update({
      where: { id: connectionId },
      data: {
        configJson: {
          ...config,
          syncScheduleId: schedule.scheduleId ?? scheduleId,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("[google-workspace] Failed to create sync cron schedule:", error);
    // Don't fail the operation — schedule can be retried
  }
}

/**
 * Resolves the final role for a user based on priority:
 * 1. Explicit per-user override
 * 2. First matching group-to-role mapping
 * 3. Default role
 */
function resolveUserRole(
  email: string,
  serverGroupMemberships: Record<string, string[]>,
  groupRoleMappings: Array<{
    groupEmail: string;
    role: DirectoryRole;
  }>,
  userRoleOverrides: Record<string, DirectoryRole>,
  defaultRole: DirectoryRole,
): DirectoryRole {
  // Priority 1: explicit override
  if (userRoleOverrides[email]) {
    return userRoleOverrides[email];
  }

  // Priority 2: first matching group mapping
  const userGroups = serverGroupMemberships[email] ?? [];
  for (const mapping of groupRoleMappings) {
    if (userGroups.includes(mapping.groupEmail)) {
      return mapping.role;
    }
  }

  // Priority 3: default
  return defaultRole;
}

// ---------------------------------------------------------------------------
// Google Workspace Router
// ---------------------------------------------------------------------------

// googleWorkspace: Google Workspace integration — directory listing, group resolution, bulk import, sync
export const googleWorkspaceRouter = router({
  /**
   * List all users from the Google Workspace directory.
   * Marks users that already exist as org members.
   */
  listDirectory: tenantProcedure
    .use(requirePermission({ member: ["read"] }))
    .query(async ({ ctx }) => {
      const { credentials, adapter } = await getGoogleWorkspaceConnection(ctx.organizationId);

      const googleUsers = await adapter.listAllDirectoryUsers(credentials.accessToken);

      // Get existing org members to mark already-imported users
      const org = await auth.api.getFullOrganization({
        headers: ctx.headers,
        query: { organizationId: ctx.organizationId },
      });

      const existingEmails = new Set(
        (org?.members ?? []).map(
          (m: Record<string, unknown>) =>
            ((m.user as Record<string, unknown>)?.email as string) ?? "",
        ),
      );

      const users = googleUsers.map((user) => ({
        id: user.id,
        primaryEmail: user.primaryEmail,
        name: {
          givenName: user.name.givenName,
          familyName: user.name.familyName,
          fullName: user.name.fullName,
        },
        thumbnailPhotoUrl: user.thumbnailPhotoUrl ?? null,
        orgUnitPath: user.orgUnitPath ?? null,
        department:
          user.organizations?.find((o) => o.primary)?.department ??
          user.organizations?.[0]?.department ??
          null,
        isAdmin: user.isAdmin ?? false,
        alreadyExists: existingEmails.has(user.primaryEmail),
      }));

      const alreadyImported = users.filter((u) => u.alreadyExists).length;

      return {
        users,
        stats: {
          total: users.length,
          alreadyImported,
          new: users.length - alreadyImported,
        },
      };
    }),

  /**
   * List group memberships for multiple users.
   * Returns deduplicated groups with member emails.
   */
  listUserGroups: tenantProcedure
    .use(requirePermission({ member: ["read"] }))
    .use(requireTier("PRO"))
    .input(
      z.object({
        userEmails: z.array(z.string().email()).min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { credentials, adapter } = await getGoogleWorkspaceConnection(ctx.organizationId);

      const groupMap = new Map<
        string,
        {
          id: string;
          email: string;
          name: string;
          description: string | null;
          memberEmails: string[];
        }
      >();

      for (const email of input.userEmails) {
        const groups = await adapter.listUserGroups(credentials.accessToken, email);

        for (const group of groups) {
          const existing = groupMap.get(group.id);
          if (existing) {
            existing.memberEmails.push(email);
          } else {
            groupMap.set(group.id, {
              id: group.id,
              email: group.email,
              name: group.name,
              description: group.description ?? null,
              memberEmails: [email],
            });
          }
        }
      }

      return {
        groups: Array.from(groupMap.values()),
      };
    }),

  /**
   * Bulk import selected users by creating org invitations.
   * SECURITY: Re-fetches group memberships server-side for RBAC role resolution.
   */
  bulkImport: tenantProcedure
    .use(requirePermission({ member: ["create"] }))
    .use(requireTier("PRO"))
    .input(directoryImportInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { connection, credentials, adapter } = await getGoogleWorkspaceConnection(
        ctx.organizationId,
      );

      // Re-fetch group memberships server-side (NEVER trust client-supplied group data for RBAC)
      const serverGroupMemberships: Record<string, string[]> = {};
      for (const user of input.users) {
        const groups = await adapter.listUserGroups(credentials.accessToken, user.email);
        serverGroupMemberships[user.email] = groups.map((g) => g.email);
      }

      const succeeded: Array<{ email: string; role: string }> = [];
      const failed: Array<{ email: string; error: string }> = [];

      for (const user of input.users) {
        try {
          const role = resolveUserRole(
            user.email,
            serverGroupMemberships,
            input.groupRoleMappings,
            input.userRoleOverrides,
            input.defaultRole,
          );

          await auth.api.createInvitation({
            headers: ctx.headers,
            body: {
              email: user.email,
              role,
              organizationId: ctx.organizationId,
            },
          });

          succeeded.push({ email: user.email, role });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          failed.push({ email: user.email, error: message });
        }
      }

      // Store import metadata
      const currentConfig = (connection.configJson as Record<string, unknown>) ?? {};
      await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          configJson: {
            ...currentConfig,
            lastImportAt: new Date().toISOString(),
            lastImportCount: succeeded.length,
          } as Prisma.InputJsonValue,
        },
      });

      // Set up daily sync cron after successful import
      void ensureSyncCronSchedule(connection.id, ctx.organizationId);

      return { succeeded, failed };
    }),

  /**
   * Trigger a manual directory sync via QStash.
   * Ensures cron schedule exists, then publishes immediate sync job.
   */
  triggerSync: tenantProcedure
    .use(requirePermission({ member: ["read"] }))
    .use(requireTier("PRO"))
    .mutation(async ({ ctx }) => {
      const { connection } = await getGoogleWorkspaceConnection(ctx.organizationId);

      // Ensure cron schedule exists
      await ensureSyncCronSchedule(connection.id, ctx.organizationId);

      // Publish immediate sync job
      const qstashClient = getQStashClient();
      await qstashClient.publishJSON({
        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/google-workspace/_sync`,
        body: {
          organizationId: ctx.organizationId,
          connectionId: connection.id,
        },
      });

      return { triggered: true };
    }),

  /**
   * Get sync status for the Google Workspace connection.
   * Returns connection info and last sync log, or null if not connected.
   */
  syncStatus: tenantProcedure
    .use(requirePermission({ member: ["read"] }))
    .query(async ({ ctx }) => {
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: "GOOGLE_WORKSPACE",
        },
        select: {
          id: true,
          status: true,
          configJson: true,
          lastSyncAt: true,
        },
      });

      if (!connection) {
        return { connected: false as const };
      }

      const lastSync = await prisma.integrationSyncLog.findFirst({
        where: { integrationConnectionId: connection.id },
        orderBy: { startedAt: "desc" },
        select: {
          status: true,
          startedAt: true,
          completedAt: true,
        },
      });

      return {
        connected: true as const,
        connectionId: connection.id,
        lastSyncAt: connection.lastSyncAt,
        lastSyncStatus: lastSync?.status ?? null,
        configJson: connection.configJson as Record<string, unknown> | null,
      };
    }),
});
