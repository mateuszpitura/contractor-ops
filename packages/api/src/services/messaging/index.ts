import { prisma } from "@contractor-ops/db";
import type { MessagingProvider } from "./types.js";
import { SlackMessagingProvider } from "./slack-messaging-provider.js";
import { TeamsMessagingProvider } from "./teams-messaging-provider.js";

// ---------------------------------------------------------------------------
// Provider Factory
// ---------------------------------------------------------------------------
// Resolves all connected messaging providers for an organization.
// notification-service.ts calls this once per dispatch and iterates
// the returned providers — no platform-specific branching needed.
// ---------------------------------------------------------------------------

/**
 * Returns an array of MessagingProvider instances for all connected
 * messaging integrations in the given organization.
 *
 * Supports: SLACK, MICROSOFT_TEAMS.
 */
export async function getConnectedMessagingProviders(
  organizationId: string,
): Promise<MessagingProvider[]> {
  const connections = await prisma.integrationConnection.findMany({
    where: {
      organizationId,
      provider: { in: ["SLACK", "MICROSOFT_TEAMS"] },
      status: "CONNECTED",
    },
    select: { provider: true },
  });

  const providers: MessagingProvider[] = [];

  for (const conn of connections) {
    switch (conn.provider) {
      case "SLACK":
        providers.push(new SlackMessagingProvider());
        break;
      case "MICROSOFT_TEAMS":
        providers.push(new TeamsMessagingProvider());
        break;
    }
  }

  return providers;
}

// Re-export all types
export type {
  MessagingProvider,
  ApprovalCardParams,
  ReminderDMParams,
  ChannelAlertParams,
} from "./types.js";
