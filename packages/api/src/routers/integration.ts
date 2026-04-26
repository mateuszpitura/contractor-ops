import {
  generateOAuthState,
  getAdapter,
  getAllProviderHealth,
  getProviderHealth,
  registerAllAdapters,
} from '@contractor-ops/integrations';
import {
  disconnectProviderSchema,
  getServerEnv,
  getServerEnvRecord,
  getSyncLogSchema,
  getWebhookLogSchema,
  providerSlugSchema,
  slackUserLinkSchema,
  slackUserUnlinkSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import * as E from '../errors.js';
import { router } from '../init.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { syncWorkspaceUsers } from '../services/slack-client.js';

// Ensure all provider adapters are registered before any procedure runs
registerAllAdapters();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ---------------------------------------------------------------------------
// Integration router
// ---------------------------------------------------------------------------

export const integrationRouter = router({
  /**
   * Get current Slack integration status for the organization.
   * Returns connection info or null if not connected.
   */
  getSlackStatus: tenantProcedure.query(async ({ ctx }) => {
    const connection = await ctx.db.integrationConnection.findFirst({
      where: {
        organizationId: ctx.organizationId,
        provider: 'SLACK',
      },
      include: {
        connectedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!connection) {
      return null;
    }

    return plain({
      connected: connection.status === 'CONNECTED',
      status: connection.status,
      displayName: connection.displayName,
      connectedAt: connection.connectedAt,
      connectedByUser: connection.connectedBy,
    });
  }),

  /**
   * List user mappings between org members and Slack users.
   * Shows matched and unmatched users with their Slack info.
   */
  listUserMappings: tenantProcedure.query(async ({ ctx }) => {
    // Find Slack integration connection
    const connection = await ctx.db.integrationConnection.findFirst({
      where: {
        organizationId: ctx.organizationId,
        provider: 'SLACK',
      },
      select: { id: true },
    });

    if (!connection) {
      return { mappings: [], connectionId: null };
    }

    // Get all Slack user links
    const externalLinks = await ctx.db.externalLink.findMany({
      where: {
        organizationId: ctx.organizationId,
        integrationConnectionId: connection.id,
        externalType: 'SLACK_USER',
      },
    });

    // Get org members
    const members = await ctx.db.member.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Build mapping with matched/unmatched status
    const linksByUserId = new Map(externalLinks.map(link => [link.entityId, link]));

    const mappings = members.map(member => {
      const link = linksByUserId.get(member.userId);
      return {
        userId: member.userId,
        user: member.user,
        role: member.role,
        slackLink: link
          ? {
              externalLinkId: link.id,
              externalId: link.externalId,
              externalUrl: link.externalUrl,
              metadata: link.metadataJson,
            }
          : null,
        status: link ? ('linked' as const) : ('unlinked' as const),
      };
    });

    return plain({ mappings, connectionId: connection.id });
  }),

  /**
   * Link an org user to a Slack user. Admin only.
   * Creates an ExternalLink mapping.
   */
  linkUser: tenantProcedure
    .use(requirePermission({ organization: ['update'] }))
    .input(slackUserLinkSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: 'SLACK',
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.INTEGRATION_NOT_CONNECTED,
        });
      }

      const link = await ctx.db.externalLink.create({
        data: {
          organizationId: ctx.organizationId,
          integrationConnectionId: connection.id,
          entityType: 'CONTRACTOR',
          entityId: input.userId,
          externalType: 'SLACK_USER',
          externalId: input.externalId,
        },
      });

      return plain(link);
    }),

  /**
   * Unlink a Slack user mapping. Admin only.
   * Deletes the ExternalLink by ID.
   */
  unlinkUser: tenantProcedure
    .use(requirePermission({ organization: ['update'] }))
    .input(slackUserUnlinkSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.externalLink.findFirst({
        where: {
          id: input.externalLinkId,
          organizationId: ctx.organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.INTEGRATION_LINK_NOT_FOUND,
        });
      }

      await ctx.db.externalLink.delete({
        where: { id: input.externalLinkId },
      });

      return { success: true };
    }),

  syncUsers: tenantProcedure
    .use(requirePermission({ organization: ['update'] }))
    .mutation(async ({ ctx }) => {
      const connection = await ctx.db.integrationConnection.findFirst({
        where: { organizationId: ctx.organizationId, provider: 'SLACK' },
        select: { id: true },
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.INTEGRATION_NOT_CONNECTED,
        });
      }

      return syncWorkspaceUsers(ctx.organizationId, connection.id);
    }),

  // -------------------------------------------------------------------------
  // Generic provider procedures (multi-provider support)
  // -------------------------------------------------------------------------

  /**
   * Get health status for all registered providers.
   * Returns one entry per adapter, including disconnected providers.
   */
  getAllHealth: tenantProcedure.query(async ({ ctx }) => {
    const results = await getAllProviderHealth(ctx.organizationId);
    return plain(results);
  }),

  /**
   * Get health status for a single provider.
   * Used for individual card refresh with 30-second polling.
   */
  getHealth: tenantProcedure.input(providerSlugSchema).query(async ({ ctx, input }) => {
    const result = await getProviderHealth(ctx.organizationId, input.provider);
    return plain(result);
  }),

  /**
   * Generate an OAuth authorization URL for any registered provider.
   * Admin only. Uses the adapter's OAuthConfig and HMAC-signed state.
   */
  getOAuthUrlGeneric: tenantProcedure
    .use(requirePermission({ organization: ['update'] }))
    .input(providerSlugSchema)
    .query(async ({ ctx, input }) => {
      const adapter = getAdapter(input.provider);
      if (!(adapter?.supportsOAuth && adapter.getOAuthConfig)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.INTEGRATION_NO_OAUTH,
        });
      }

      const oauthConfig = adapter.getOAuthConfig();
      const env = getServerEnvRecord();
      const clientId = env[oauthConfig.clientIdEnvVar];
      const clientSecret = env[oauthConfig.clientSecretEnvVar];
      const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;

      if (!(clientId && clientSecret && appUrl)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.INTEGRATION_NOT_CONFIGURED,
        });
      }

      const redirectUri = `${appUrl}${oauthConfig.redirectPath}`;
      const state = generateOAuthState(
        input.provider,
        ctx.organizationId,
        ctx.user.id,
        clientSecret,
      );

      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        scope: oauthConfig.scopes.join(' '),
        redirect_uri: redirectUri,
        state,
      });

      // Append provider-specific extra params (e.g., Google access_type=offline)
      if (oauthConfig.extraAuthParams) {
        for (const [key, value] of Object.entries(oauthConfig.extraAuthParams)) {
          params.set(key, value);
        }
      }

      const url = `${oauthConfig.authorizationUrl}?${params.toString()}`;
      return { url };
    }),

  /**
   * Disconnect any provider. Admin only.
   * Sets status to DISCONNECTED and clears credentials reference.
   */
  disconnectGeneric: tenantProcedure
    .use(requirePermission({ organization: ['update'] }))
    .input(disconnectProviderSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: input.provider.toUpperCase() as 'SLACK',
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.INTEGRATION_NOT_FOUND,
        });
      }

      await ctx.db.integrationConnection.update({
        where: { id: connection.id },
        data: {
          status: 'DISCONNECTED',
          credentialsRef: '',
        },
      });

      return { success: true };
    }),

  /**
   * Get paginated sync log for a provider connection.
   * Cursor-based pagination for the detail sheet.
   */
  getSyncLog: tenantProcedure.input(getSyncLogSchema).query(async ({ ctx, input }) => {
    const connection = await ctx.db.integrationConnection.findFirst({
      where: {
        organizationId: ctx.organizationId,
        provider: input.provider.toUpperCase() as 'SLACK',
      },
      select: { id: true },
    });

    if (!connection) {
      return { items: [], nextCursor: null };
    }

    const items = await ctx.db.integrationSyncLog.findMany({
      where: { integrationConnectionId: connection.id },
      orderBy: { startedAt: 'desc' },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        syncType: true,
        status: true,
        direction: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
      },
    });

    let nextCursor: string | null = null;
    if (items.length > input.limit) {
      const lastItem = items.pop();
      nextCursor = lastItem?.id ?? null;
    }

    return plain({ items, nextCursor });
  }),

  /**
   * Get paginated webhook delivery log for a provider.
   * Cursor-based pagination for the detail sheet.
   */
  getWebhookLog: tenantProcedure.input(getWebhookLogSchema).query(async ({ ctx, input }) => {
    const items = await ctx.db.webhookDelivery.findMany({
      where: {
        organizationId: ctx.organizationId,
        provider: input.provider.toUpperCase() as 'SLACK',
      },
      orderBy: { receivedAt: 'desc' },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        eventType: true,
        deliveryStatus: true,
        receivedAt: true,
        processedAt: true,
        errorMessage: true,
      },
    });

    let nextCursor: string | null = null;
    if (items.length > input.limit) {
      const lastItem = items.pop();
      nextCursor = lastItem?.id ?? null;
    }

    return plain({ items, nextCursor });
  }),
});
