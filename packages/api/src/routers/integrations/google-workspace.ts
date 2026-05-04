import { authApi } from '@contractor-ops/auth';
import type { Prisma } from '@contractor-ops/db';
import {
  decryptCredentials,
  encryptCredentials,
  getAdapter,
  registerAllAdapters,
} from '@contractor-ops/integrations';
import type { GoogleWorkspaceAdapter } from '@contractor-ops/integrations/adapters/google-workspace-adapter';
import { getQStashClient } from '@contractor-ops/integrations/services/qstash-client';
import { createLogger } from '@contractor-ops/logger';
import type { DirectoryRole } from '@contractor-ops/validators';
import { directoryImportInputSchema, getServerEnv } from '@contractor-ops/validators';
import * as Sentry from '@sentry/nextjs';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../init.js';
import type { TenantScopedDb } from '../../lib/tenant-db.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantProcedure } from '../../middleware/tenant.js';
import { requireTier } from '../../middleware/tier.js';

const log = createLogger({ service: 'google-workspace-router' });

// Ensure adapters are registered before any procedure runs
registerAllAdapters();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Loads the active Google Workspace connection for an organization,
 * decrypts credentials, refreshes token if expired, and returns adapter.
 */
async function getGoogleWorkspaceConnection(db: TenantScopedDb, organizationId: string) {
  const connection = await db.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: 'GOOGLE_WORKSPACE',
      status: 'CONNECTED',
    },
  });

  if (!connection) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Google Workspace not connected',
    });
  }

  const adapter = getAdapter('google_workspace') as GoogleWorkspaceAdapter;
  if (!adapter) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Google Workspace adapter not registered',
    });
  }

  let credentials = decryptCredentials(connection.credentialsRef, 'google_workspace');

  // Refresh token if expired
  if (credentials.expiresAt && new Date(credentials.expiresAt) < new Date()) {
    credentials = await adapter.refreshToken(credentials);
    const encrypted = encryptCredentials(credentials, 'google_workspace');
    await db.integrationConnection.update({
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
async function ensureSyncCronSchedule(
  db: TenantScopedDb,
  connectionId: string,
  organizationId: string,
) {
  const connection = await db.integrationConnection.findUnique({
    where: { id: connectionId },
    select: { configJson: true },
  });
  const config = (connection?.configJson ?? {}) as Record<string, unknown>;
  if (config.syncScheduleId) return; // Already has a schedule

  try {
    const qstashClient = getQStashClient();
    const scheduleId = `gw-sync-${organizationId}`;

    const schedule = await qstashClient.schedules.create({
      destination: `${getServerEnv().NEXT_PUBLIC_APP_URL}/api/google-workspace/_sync`,
      body: JSON.stringify({ organizationId, connectionId }),
      cron: '0 2 * * *', // Daily at 2 AM
      scheduleId,
      // F-ASYNC-18: bump default retries to 5 — Google Workspace transient
      // 5xx during a deploy or quota spike shouldn't permanently drop the
      // daily sync (the next 2AM tick recovers, but the gap is visible).
      retries: 5,
    });

    await db.integrationConnection.update({
      where: { id: connectionId },
      data: {
        configJson: {
          ...config,
          syncScheduleId: schedule.scheduleId ?? scheduleId,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    // F-ASYNC-12: surface schedule-create failure on lastErrorMessage so
    // ops + the UI can see "schedule unhealthy" instead of a CONNECTED
    // connection with no syncs.
    const message = error instanceof Error ? error.message : 'Schedule create failed';
    log.error({ err: error, organizationId, connectionId }, 'failed to create sync cron schedule');
    Sentry.captureException(error, {
      tags: {
        'integration.provider': 'GOOGLE_WORKSPACE',
        'qstash.outcome': 'schedule-create-failed',
      },
      extra: { organizationId, connectionId },
    });
    await db.integrationConnection.update({
      where: { id: connectionId },
      data: {
        lastErrorAt: new Date(),
        lastErrorMessage: `QStash schedule create failed: ${message.slice(0, 400)}`,
      },
    });
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
    .use(requirePermission({ member: ['read'] }))
    .query(async ({ ctx }) => {
      const { credentials, adapter } = await getGoogleWorkspaceConnection(
        ctx.db,
        ctx.organizationId,
      );

      const googleUsers = await adapter.listAllDirectoryUsers(credentials.accessToken);

      // Get existing org members to mark already-imported users
      const org = await authApi.getFullOrganization({
        headers: ctx.headers,
        query: { organizationId: ctx.organizationId },
      });

      const existingEmails = new Set(
        (org?.members ?? []).map(
          (m: Record<string, unknown>) =>
            ((m.user as Record<string, unknown>)?.email as string) ?? '',
        ),
      );

      const users = googleUsers.map(user => ({
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
          user.organizations?.find(o => o.primary)?.department ??
          user.organizations?.[0]?.department ??
          null,
        isAdmin: user.isAdmin ?? false,
        alreadyExists: existingEmails.has(user.primaryEmail),
      }));

      const alreadyImported = users.filter(u => u.alreadyExists).length;

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
    .use(requirePermission({ member: ['read'] }))
    .use(requireTier('PRO'))
    .input(
      z.object({
        userEmails: z.array(z.email()).min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { credentials, adapter } = await getGoogleWorkspaceConnection(
        ctx.db,
        ctx.organizationId,
      );

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
    .use(requirePermission({ member: ['create'] }))
    .use(requireTier('PRO'))
    .input(directoryImportInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { connection, credentials, adapter } = await getGoogleWorkspaceConnection(
        ctx.db,
        ctx.organizationId,
      );

      // F-DB-26 — re-fetch group memberships in parallel (chunks of 10) so a
      // 50-user import doesn't take 50× single-call latency. Same upper-bound
      // for invite-create below. The chunk size of 10 keeps us well under
      // Google Directory API + Resend rate limits.
      const CHUNK = 10;
      const serverGroupMemberships: Record<string, string[]> = {};
      for (let i = 0; i < input.users.length; i += CHUNK) {
        const slice = input.users.slice(i, i + CHUNK);
        await Promise.all(
          slice.map(async user => {
            const groups = await adapter.listUserGroups(credentials.accessToken, user.email);
            serverGroupMemberships[user.email] = groups.map(g => g.email);
          }),
        );
      }

      const succeeded: Array<{ email: string; role: string }> = [];
      const failed: Array<{ email: string; error: string }> = [];

      // F-DB-26 — invite-create in parallel chunks of 10 with allSettled so
      // one failure doesn't abort the whole batch.
      for (let i = 0; i < input.users.length; i += CHUNK) {
        const slice = input.users.slice(i, i + CHUNK);
        const results = await Promise.allSettled(
          slice.map(async user => {
            const role = resolveUserRole(
              user.email,
              serverGroupMemberships,
              input.groupRoleMappings,
              input.userRoleOverrides,
              input.defaultRole,
            );
            await authApi.createInvitation({
              headers: ctx.headers,
              body: {
                email: user.email,
                role,
                organizationId: ctx.organizationId,
              },
            });
            return { email: user.email, role };
          }),
        );
        for (let j = 0; j < results.length; j += 1) {
          const r = results[j]!;
          const user = slice[j]!;
          if (r.status === 'fulfilled') {
            succeeded.push(r.value);
          } else {
            const message =
              r.reason instanceof Error ? r.reason.message : String(r.reason ?? 'Unknown error');
            failed.push({ email: user.email, error: message });
          }
        }
      }

      // Store import metadata
      const currentConfig = (connection.configJson as Record<string, unknown>) ?? {};
      await ctx.db.integrationConnection.update({
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
      void ensureSyncCronSchedule(ctx.db, connection.id, ctx.organizationId);

      return { succeeded, failed };
    }),

  /**
   * Trigger a manual directory sync via QStash.
   * Ensures cron schedule exists, then publishes immediate sync job.
   */
  triggerSync: tenantProcedure
    .use(requirePermission({ member: ['read'] }))
    .use(requireTier('PRO'))
    .mutation(async ({ ctx }) => {
      const { connection } = await getGoogleWorkspaceConnection(ctx.db, ctx.organizationId);

      // Ensure cron schedule exists
      await ensureSyncCronSchedule(ctx.db, connection.id, ctx.organizationId);

      // Publish immediate sync job
      const qstashClient = getQStashClient();
      await qstashClient.publishJSON({
        url: `${getServerEnv().NEXT_PUBLIC_APP_URL}/api/google-workspace/_sync`,
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
    .use(requirePermission({ member: ['read'] }))
    .query(async ({ ctx }) => {
      const connection = await ctx.db.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: 'GOOGLE_WORKSPACE',
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

      const lastSync = await ctx.db.integrationSyncLog.findFirst({
        where: { integrationConnectionId: connection.id },
        orderBy: { startedAt: 'desc' },
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
