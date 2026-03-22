import { createHmac } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { prisma } from "@contractor-ops/db";
import {
  slackUserLinkSchema,
  slackUserUnlinkSchema,
} from "@contractor-ops/validators";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

/**
 * Generate HMAC-signed state parameter for Slack OAuth.
 * Contains orgId + userId + timestamp for CSRF protection.
 * Per research pitfall 6: HMAC-signed state prevents CSRF attacks.
 */
function generateOAuthState(
  orgId: string,
  userId: string,
  secret: string,
): string {
  const payload = `${orgId}:${userId}:${Date.now()}`;
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  const signature = hmac.digest("hex");
  return `${payload}:${signature}`;
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
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        organizationId: ctx.organizationId,
        provider: "SLACK",
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
      connected: connection.status === "CONNECTED",
      status: connection.status,
      displayName: connection.displayName,
      connectedAt: connection.connectedAt,
      connectedByUser: connection.connectedBy,
    });
  }),

  /**
   * Generate a Slack OAuth authorization URL.
   * Admin only. State parameter is HMAC-signed for CSRF protection.
   */
  getOAuthUrl: tenantProcedure
    .use(requirePermission({ organization: ["update"] }))
    .query(async ({ ctx }) => {
      const clientId = process.env.SLACK_CLIENT_ID;
      const redirectUri = process.env.SLACK_REDIRECT_URI;
      const signingSecret =
        process.env.SLACK_SIGNING_SECRET ?? process.env.SLACK_CLIENT_SECRET;

      if (!clientId || !redirectUri || !signingSecret) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Slack integration is not configured. Missing SLACK_CLIENT_ID, SLACK_REDIRECT_URI, or SLACK_SIGNING_SECRET.",
        });
      }

      const state = generateOAuthState(
        ctx.organizationId,
        ctx.user!.id,
        signingSecret,
      );

      const scopes = [
        "chat:write",
        "users:read",
        "users:read.email",
        "im:write",
      ].join(",");

      const params = new URLSearchParams({
        client_id: clientId,
        scope: scopes,
        redirect_uri: redirectUri,
        state,
      });

      const url = `https://slack.com/oauth/v2/authorize?${params.toString()}`;

      return { url };
    }),

  /**
   * Disconnect Slack integration. Admin only.
   * Sets status to DISCONNECTED and clears credentials reference.
   */
  disconnect: tenantProcedure
    .use(requirePermission({ organization: ["update"] }))
    .mutation(async ({ ctx }) => {
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: "SLACK",
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Slack integration found",
        });
      }

      await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          status: "DISCONNECTED",
          credentialsRef: "",
        },
      });

      return { success: true };
    }),

  /**
   * List user mappings between org members and Slack users.
   * Shows matched and unmatched users with their Slack info.
   */
  listUserMappings: tenantProcedure.query(async ({ ctx }) => {
    // Find Slack integration connection
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        organizationId: ctx.organizationId,
        provider: "SLACK",
      },
      select: { id: true },
    });

    if (!connection) {
      return { mappings: [], connectionId: null };
    }

    // Get all Slack user links
    const externalLinks = await prisma.externalLink.findMany({
      where: {
        organizationId: ctx.organizationId,
        integrationConnectionId: connection.id,
        externalType: "SLACK_USER",
      },
    });

    // Get org members
    const members = await prisma.member.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Build mapping with matched/unmatched status
    const linksByUserId = new Map(
      externalLinks.map((link) => [link.entityId, link]),
    );

    const mappings = members.map((member) => {
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
        status: link ? ("linked" as const) : ("unlinked" as const),
      };
    });

    return plain({ mappings, connectionId: connection.id });
  }),

  /**
   * Link an org user to a Slack user. Admin only.
   * Creates an ExternalLink mapping.
   */
  linkUser: tenantProcedure
    .use(requirePermission({ organization: ["update"] }))
    .input(slackUserLinkSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: "SLACK",
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Slack integration is not connected",
        });
      }

      const link = await prisma.externalLink.create({
        data: {
          organizationId: ctx.organizationId,
          integrationConnectionId: connection.id,
          entityType: "CONTRACTOR",
          entityId: input.userId,
          externalType: "SLACK_USER",
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
    .use(requirePermission({ organization: ["update"] }))
    .input(slackUserUnlinkSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.externalLink.findFirst({
        where: {
          id: input.externalLinkId,
          organizationId: ctx.organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "External link not found",
        });
      }

      await prisma.externalLink.delete({
        where: { id: input.externalLinkId },
      });

      return { success: true };
    }),

  /**
   * Placeholder for Slack user sync (auto-match by email).
   * Will be called after OAuth callback to auto-match org members.
   * Per D-10: auto-match by email, manual override for mismatches.
   */
  syncUsers: tenantProcedure
    .use(requirePermission({ organization: ["update"] }))
    .mutation(async () => {
      // TODO: Plan 02 implements actual Slack API call to list users + match by email
      return { matched: 0, total: 0 };
    }),
});
