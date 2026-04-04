import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma, type Prisma } from "@contractor-ops/db";
import { decryptCredentials } from "@contractor-ops/integrations/services/credential-service";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";
import * as E from "../errors.js";
import { getTeamsChannels, getJoinedTeams } from "../services/teams/teams-graph-client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TeamsConnectionConfig {
  channelMapping?: Record<string, string>;
  conversationReferences?: Record<string, unknown>;
  teamConversationReferences?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Loads the MICROSOFT_TEAMS IntegrationConnection for the current org.
 * Accepts CONNECTED status.
 */
async function loadTeamsConnection(organizationId: string) {
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: "MICROSOFT_TEAMS",
      status: "CONNECTED",
    },
  });

  if (!connection) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: E.INTEGRATION_NOT_FOUND,
    });
  }

  return connection;
}

/**
 * Decrypts Teams credentials and returns the access token.
 */
function getTeamsAccessToken(credentialsRef: string): string {
  const credentials = decryptCredentials(credentialsRef, "microsoft_teams");
  return credentials.accessToken;
}

// ---------------------------------------------------------------------------
// Channel mapping validation schema
// ---------------------------------------------------------------------------

const channelMappingSchema = z.object({
  mapping: z.record(
    z.enum(["approvals", "invoices", "contracts", "tasks", "equipment"]),
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
  connectionStatus: tenantProcedure.query(async ({ ctx }) => {
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        organizationId: ctx.organizationId,
        provider: "MICROSOFT_TEAMS",
      },
      select: {
        id: true,
        status: true,
        configJson: true,
      },
    });

    if (!connection) return null;

    return {
      id: connection.id,
      status: connection.status,
      configJson: connection.configJson as Record<string, unknown> | null,
    };
  }),

  /**
   * Fetch joined Teams for the connected workspace.
   * Uses Graph API to list teams the bot has access to.
   */
  getTeams: tenantProcedure.query(async ({ ctx }) => {
    const connection = await loadTeamsConnection(ctx.organizationId);
    const accessToken = getTeamsAccessToken(connection.credentialsRef);

    const teams = await getJoinedTeams(accessToken);
    return teams;
  }),

  /**
   * Fetch channels for a specific team.
   * Uses Graph API to list channels in the given team.
   */
  getChannels: tenantProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connection = await loadTeamsConnection(ctx.organizationId);
      const accessToken = getTeamsAccessToken(connection.credentialsRef);

      const channels = await getTeamsChannels(accessToken, input.teamId);
      return channels;
    }),

  /**
   * Get the saved channel mapping for notification categories.
   * Returns the mapping object or an empty object if not configured.
   */
  getChannelMapping: tenantProcedure.query(async ({ ctx }) => {
    const connection = await loadTeamsConnection(ctx.organizationId);
    const config = (connection.configJson as TeamsConnectionConfig) ?? {};
    return config.channelMapping ?? {};
  }),

  /**
   * Save channel mapping for notification categories.
   * Maps notification categories (approvals, invoices, etc.) to channel IDs.
   */
  saveChannelMapping: tenantProcedure
    .use(requirePermission({ settings: ["update"] }))
    .input(channelMappingSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await loadTeamsConnection(ctx.organizationId);
      const config = (connection.configJson as TeamsConnectionConfig) ?? {};

      await prisma.integrationConnection.update({
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
});
