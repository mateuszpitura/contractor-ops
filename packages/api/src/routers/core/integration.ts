import {
  getAdapter,
  getAllProviderHealth,
  getProviderHealth,
  loadHeavyAdapters,
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
import * as E from '../../errors';
import { router } from '../../init';
import {
  loadOrgIntegrationConnection,
  type IntegrationProviderSlug,
} from '../../lib/integration-connection.js';
import { cursorClause, paginateByLastKept } from '../../lib/pagination';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { syncWorkspaceUsers } from '../../services/slack-client';

// Ensure all provider adapters are registered before any procedure runs
registerAllAdapters();

function toIntegrationProvider(slug: string): IntegrationProviderSlug {
  return slug.toUpperCase() as IntegrationProviderSlug;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

    return {
      connected: connection.status === 'CONNECTED',
      status: connection.status,
      displayName: connection.displayName,
      connectedAt: connection.connectedAt,
      connectedByUser: connection.connectedBy,
    };
  }),

  /**
   * List user mappings between org members and Slack users.
   * Shows matched and unmatched users with their Slack info.
   */
  listUserMappings: tenantProcedure.query(async ({ ctx }) => {
    const connection = await loadOrgIntegrationConnection(
      ctx.db,
      ctx.organizationId,
      'SLACK',
      { status: 'any', optional: true },
    );

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

    return { mappings, connectionId: connection.id };
  }),

  /**
   * Link an org user to a Slack user. Admin only.
   * Creates an ExternalLink mapping.
   */
  linkUser: tenantProcedure
    .use(requirePermission({ organization: ['update'] }))
    .input(slackUserLinkSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await loadOrgIntegrationConnection(
        ctx.db,
        ctx.organizationId,
        'SLACK',
        { notFoundMessage: E.INTEGRATION_NOT_CONNECTED },
      );

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

      // F-OBS-05 — linking external identities expands the surface for
      // outbound notifications and DM-based actions.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'INTEGRATION_USER_LINK',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        newValues: {
          provider: 'SLACK',
          userId: input.userId,
          externalId: input.externalId,
          externalLinkId: link.id,
        },
      });

      return link;
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

      // F-OBS-05 — symmetric with INTEGRATION_USER_LINK.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'INTEGRATION_USER_UNLINK',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        oldValues: {
          externalLinkId: existing.id,
          externalType: existing.externalType,
          externalId: existing.externalId,
          entityId: existing.entityId,
        },
      });

      return { success: true };
    }),

  syncUsers: tenantProcedure
    .use(requirePermission({ organization: ['update'] }))
    .mutation(async ({ ctx }) => {
      const connection = await loadOrgIntegrationConnection(
        ctx.db,
        ctx.organizationId,
        'SLACK',
        { notFoundMessage: E.INTEGRATION_NOT_CONNECTED },
      );

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
    return results;
  }),

  /**
   * Get health status for a single provider.
   * Used for individual card refresh with 30-second polling.
   */
  getHealth: tenantProcedure.input(providerSlugSchema).query(async ({ ctx, input }) => {
    const result = await getProviderHealth(ctx.organizationId, input.provider);
    return result;
  }),

  /**
   * Resolve an OAuth start URL for any registered provider. Admin only.
   *
   * Returns the local `/api/oauth/[provider]/start` URL — NOT the IdP
   * authorization URL directly. The local start route mints a single-use
   * `OAuthChallenge` row, sets the `__Host-oauth_state` cookie, and
   * 302-redirects to the IdP (F-SEC-05 + F-SEC-21).
   *
   * We still validate that the adapter is registered + the credentials are
   * configured here so the UI can short-circuit with a clear error before
   * sending the user through the redirect chain.
   */
  getOAuthUrlGeneric: tenantProcedure
    .use(requirePermission({ organization: ['update'] }))
    .input(providerSlugSchema)
    .query(async ({ input }) => {
      // Every OAuth provider except Slack is a HEAVY adapter that registers
      // lazily after registerAllAdapters() kicks off its background load. A
      // cold first request can reach getAdapter() before that resolves, so
      // await it here — otherwise an unregistered-yet adapter is reported as
      // a false `integrationNoOauth` 400.
      await loadHeavyAdapters();
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
      const apiUrl = getServerEnv().API_URL;

      if (!(clientId && clientSecret && apiUrl)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.INTEGRATION_NOT_CONFIGURED,
        });
      }

      // Hand the client the API-host OAuth start URL. The browser navigation
      // MUST go through /api/oauth/{provider}/start on the API host so the
      // cookie binding is established before the IdP round-trip.
      const url = `${apiUrl}/api/oauth/${encodeURIComponent(input.provider)}/start`;
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
      const connection = await loadOrgIntegrationConnection(
        ctx.db,
        ctx.organizationId,
        toIntegrationProvider(input.provider),
        { status: 'any' },
      );

      await ctx.db.integrationConnection.update({
        where: { id: connection.id },
        data: {
          status: 'DISCONNECTED',
          credentialsRef: '',
        },
      });

      // F-OBS-05 — disconnect tears down the OAuth grant and stops syncing;
      // forensics needs to see who pulled the plug + when.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'INTEGRATION_DISCONNECT',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        oldValues: { provider: connection.provider, status: connection.status },
        newValues: { status: 'DISCONNECTED' },
        metadata: { connectionId: connection.id },
      });

      return { success: true };
    }),

  /**
   * Get paginated sync log for a provider connection.
   * Cursor-based pagination for the detail sheet.
   */
  getSyncLog: tenantProcedure.input(getSyncLogSchema).query(async ({ ctx, input }) => {
    const connection = await loadOrgIntegrationConnection(
      ctx.db,
      ctx.organizationId,
      toIntegrationProvider(input.provider),
      { status: 'any', optional: true },
    );

    if (!connection) {
      return { items: [], nextCursor: null };
    }

    const rows = await ctx.db.integrationSyncLog.findMany({
      where: { integrationConnectionId: connection.id },
      orderBy: { startedAt: 'desc' },
      ...cursorClause(input, 10),
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

    return paginateByLastKept(rows, input, 10);
  }),

  /**
   * Get paginated webhook delivery log for a provider.
   * Cursor-based pagination for the detail sheet.
   */
  getWebhookLog: tenantProcedure.input(getWebhookLogSchema).query(async ({ ctx, input }) => {
    const rows = await ctx.db.webhookDelivery.findMany({
      where: {
        organizationId: ctx.organizationId,
        provider: input.provider.toUpperCase() as 'SLACK',
      },
      orderBy: { receivedAt: 'desc' },
      ...cursorClause(input, 10),
      select: {
        id: true,
        eventType: true,
        deliveryStatus: true,
        receivedAt: true,
        processedAt: true,
        errorMessage: true,
      },
    });

    return paginateByLastKept(rows, input, 10);
  }),
});
