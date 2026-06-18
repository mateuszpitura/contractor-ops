import type { Prisma } from '@contractor-ops/db';
import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { loadOrgIntegrationConnection } from '../../lib/integration-connection.js';
import { integrationSettingsProcedure } from '../../lib/integration-procedure';
import { getJoinedTeams, getTeamsChannels } from '../../services/teams/teams-graph-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TeamsConnectionConfig {
  channelMapping?: Record<string, string>;
  conversationReferences?: Record<string, unknown>;
  teamConversationReferences?: Record<string, unknown>;
  defaultTeamId?: string;
  defaultFallbackApproverId?: string | null;
  [key: string]: unknown;
}

/**
 * Project a Teams connection's `configJson` down to fields that are safe to
 * expose to any member with `settings:['read']`. The raw blob stores Bot
 * Framework `conversationReferences` / `teamConversationReferences` (per-user
 * and per-channel routing state with service URLs and conversation IDs) which
 * must not leak to read-only members; only the channel mapping and default
 * routing config the UI needs are surfaced.
 */
function publicTeamsConfig(configJson: unknown): Record<string, unknown> | null {
  if (!configJson || typeof configJson !== 'object' || Array.isArray(configJson)) return null;
  const config = configJson as TeamsConnectionConfig;
  return {
    channelMapping: config.channelMapping,
    defaultTeamId: config.defaultTeamId,
    defaultFallbackApproverId: config.defaultFallbackApproverId,
  };
}

/**
 * Decrypts Teams credentials and returns the access token.
 */
function getTeamsAccessToken(credentialsRef: string): string {
  const credentials = decryptCredentials(credentialsRef, 'microsoft_teams');
  return credentials.accessToken;
}

// ---------------------------------------------------------------------------
// Channel mapping validation schema
// ---------------------------------------------------------------------------

const channelMappingSchema = z.object({
  mapping: z.record(
    z.enum(['approvals', 'invoices', 'contracts', 'tasks', 'equipment']),
    z.string(),
  ),
});

// ---------------------------------------------------------------------------
// Teams Router
// ---------------------------------------------------------------------------

// teams: Microsoft Teams integration -- channel discovery, channel mapping, connection status
export const teamsRouter = router({
  /**
   * Get Teams connection status for the current org.
   * Returns connection info or null if not connected.
   */
  connectionStatus: integrationSettingsProcedure('read').query(async ({ ctx }) => {
    const connection = await loadOrgIntegrationConnection(
      ctx.db,
      ctx.organizationId,
      'MICROSOFT_TEAMS',
      { status: 'any', optional: true },
    );

    if (!connection) return null;

    return {
      id: connection.id,
      status: connection.status,
      configJson: publicTeamsConfig(connection.configJson),
    };
  }),

  /**
   * Fetch joined Teams for the connected workspace.
   * Uses Graph API to list teams the bot has access to.
   */
  getTeams: integrationSettingsProcedure('read').query(async ({ ctx }) => {
    const connection = await loadOrgIntegrationConnection(
      ctx.db,
      ctx.organizationId,
      'MICROSOFT_TEAMS',
    );
    const accessToken = getTeamsAccessToken(connection.credentialsRef);

    const teams = await getJoinedTeams(accessToken);
    return teams;
  }),

  /**
   * Fetch channels for a specific team.
   * Uses Graph API to list channels in the given team.
   */
  getChannels: integrationSettingsProcedure('read')
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connection = await loadOrgIntegrationConnection(
        ctx.db,
        ctx.organizationId,
        'MICROSOFT_TEAMS',
      );
      const accessToken = getTeamsAccessToken(connection.credentialsRef);

      const channels = await getTeamsChannels(accessToken, input.teamId);
      return channels;
    }),

  /**
   * Get the saved channel mapping for notification categories.
   * Returns the mapping object or an empty object if not configured.
   */
  getChannelMapping: integrationSettingsProcedure('read').query(async ({ ctx }) => {
    const connection = await loadOrgIntegrationConnection(
      ctx.db,
      ctx.organizationId,
      'MICROSOFT_TEAMS',
    );
    const config = (connection.configJson as TeamsConnectionConfig) ?? {};
    return config.channelMapping ?? {};
  }),

  /**
   * Save channel mapping for notification categories.
   * Maps notification categories (approvals, invoices, etc.) to channel IDs.
   */
  saveChannelMapping: integrationSettingsProcedure('update', 'PRO')
    .input(channelMappingSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await loadOrgIntegrationConnection(
        ctx.db,
        ctx.organizationId,
        'MICROSOFT_TEAMS',
      );
      const config = (connection.configJson as TeamsConnectionConfig) ?? {};

      await ctx.db.integrationConnection.update({
        where: { id: connection.id },
        data: {
          configJson: {
            ...config,
            channelMapping: input.mapping,
          } as Prisma.InputJsonValue,
        },
      });

      return { success: true };
    }),

  /**
   * Set Team.fallbackApproverId for the offboarding workflow's PTO-aware
   * fallback chain. Called from the per-team Settings page.
   *
   * Although this router is named after Microsoft Teams integration (the
   * collaboration product), it co-locates here because the mutation acts on
   * the per-org `Team` model (organizational structure unit), NOT the
   * Microsoft Teams workspace.
   */
  setFallbackApprover: integrationSettingsProcedure('update')
    .input(
      z.object({
        teamId: z.string().min(1),
        fallbackApproverId: z.string().min(1).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tenant isolation — only update teams within the current org
      const existing = await ctx.db.team.findFirst({
        where: { id: input.teamId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.TEAM_NOT_FOUND });
      }
      await ctx.db.team.update({
        where: { id: input.teamId },
        data: { fallbackApproverId: input.fallbackApproverId },
      });
      return { teamId: input.teamId };
    }),
});
