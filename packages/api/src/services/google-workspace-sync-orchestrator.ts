import { prisma } from "@contractor-ops/db";
import {
  decryptCredentials,
  encryptCredentials,
  getAdapter,
} from "@contractor-ops/integrations";
import type { GoogleWorkspaceAdapter } from "@contractor-ops/integrations/adapters/google-workspace-adapter";
import { dispatch } from "./notification-service.js";

// ---------------------------------------------------------------------------
// Google Workspace Directory Sync Orchestrator
// ---------------------------------------------------------------------------

/**
 * Processes a periodic or manual Google Workspace directory sync.
 *
 * Compares the current Google Workspace directory against org members and
 * a previously synced email snapshot to detect:
 * - **New hires** (D-13): users in Google directory but not in org members
 *   and not previously synced -- dispatches DIRECTORY_NEW_HIRE notifications
 * - **Departures** (D-14): previously synced users no longer in Google
 *   directory but still in org members -- dispatches DIRECTORY_DEPARTURE
 *   notifications
 *
 * IMPORTANT: This service does NOT auto-create or auto-delete users.
 * All changes are surfaced as admin notifications for manual review.
 *
 * Uses IntegrationSyncLog for audit trail and IntegrationConnection for
 * status tracking.
 */
export async function processDirectorySync(params: {
  organizationId: string;
  connectionId: string;
}): Promise<{
  newHires: number;
  departures: number;
  totalUsers: number;
}> {
  const { organizationId, connectionId } = params;

  // -----------------------------------------------------------------------
  // Step 1: Create sync log entry
  // -----------------------------------------------------------------------

  const syncLog = await prisma.integrationSyncLog.create({
    data: {
      organizationId,
      integrationConnectionId: connectionId,
      direction: "INBOUND",
      syncType: "directory_sync",
      status: "STARTED",
      startedAt: new Date(),
    },
  });

  try {
    // -----------------------------------------------------------------------
    // Step 2: Load connection and validate ownership
    // -----------------------------------------------------------------------

    const connection = await prisma.integrationConnection.findUniqueOrThrow({
      where: { id: connectionId },
    });

    if (connection.organizationId !== organizationId) {
      throw new Error(
        "Connection does not belong to the specified organization",
      );
    }

    if (connection.status !== "CONNECTED") {
      throw new Error(
        `Connection is not active (status: ${connection.status})`,
      );
    }

    // -----------------------------------------------------------------------
    // Step 3: Decrypt credentials and refresh token if expired
    // -----------------------------------------------------------------------

    let credentials = decryptCredentials(
      connection.credentialsRef,
      "google_workspace",
    );

    const adapter = getAdapter("google_workspace") as GoogleWorkspaceAdapter;

    // Check if token is expired (with 5-minute buffer)
    const tokenExpired =
      credentials.expiresAt &&
      new Date(credentials.expiresAt).getTime() < Date.now() + 5 * 60 * 1000;

    if (tokenExpired) {
      credentials = await adapter.refreshToken(credentials);

      // Persist refreshed credentials
      const encryptedCreds = encryptCredentials(
        credentials,
        "google_workspace",
      );
      await prisma.integrationConnection.update({
        where: { id: connectionId },
        data: {
          credentialsRef: encryptedCreds,
          tokenExpiresAt: credentials.expiresAt
            ? new Date(credentials.expiresAt)
            : null,
        },
      });
    }

    // -----------------------------------------------------------------------
    // Step 4: Fetch current Google Workspace directory
    // -----------------------------------------------------------------------

    const googleUsers = await adapter.listAllDirectoryUsers(
      credentials.accessToken,
    );

    // Build email -> GoogleDirectoryUser map (lowercase for case-insensitive compare)
    const googleEmailMap = new Map(
      googleUsers.map((u) => [u.primaryEmail.toLowerCase(), u]),
    );

    // -----------------------------------------------------------------------
    // Step 5: Fetch current org members
    // -----------------------------------------------------------------------

    const orgMembers = await prisma.member.findMany({
      where: { organizationId },
      include: { user: { select: { email: true, name: true } } },
    });

    const memberEmailSet = new Set(
      orgMembers
        .map((m) => m.user.email?.toLowerCase())
        .filter((e): e is string => !!e),
    );

    // -----------------------------------------------------------------------
    // Step 6: Load previously synced emails from configJson
    // -----------------------------------------------------------------------

    const configJson =
      (connection.configJson as Record<string, unknown> | null) ?? {};
    const previouslySyncedEmails = new Set<string>(
      Array.isArray(configJson.syncedEmails)
        ? (configJson.syncedEmails as string[]).map((e) => e.toLowerCase())
        : [],
    );

    // -----------------------------------------------------------------------
    // Step 7: Get admin user IDs for notifications
    // -----------------------------------------------------------------------

    const adminUserIds = await getOrgAdminUserIds(organizationId);

    // -----------------------------------------------------------------------
    // Step 8: Detect new hires (D-13)
    // Google users NOT in orgMembers AND NOT in previouslySyncedEmails
    // -----------------------------------------------------------------------

    let newHireCount = 0;

    for (const [email, googleUser] of googleEmailMap) {
      if (!memberEmailSet.has(email) && !previouslySyncedEmails.has(email)) {
        newHireCount++;

        if (adminUserIds.length > 0) {
          await dispatch({
            organizationId,
            type: "DIRECTORY_NEW_HIRE",
            recipientUserIds: adminUserIds,
            title: `New team member detected: ${googleUser.name.fullName}`,
            body: `${googleUser.name.fullName} (${googleUser.primaryEmail}) was added to Google Workspace.`,
            entityType: "ORGANIZATION",
            entityId: organizationId,
            metadata: {
              googleUserId: googleUser.id,
              email: googleUser.primaryEmail,
            },
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 9: Detect departures (D-14)
    // Previously synced emails NOT in Google directory AND in orgMembers
    // -----------------------------------------------------------------------

    let departureCount = 0;

    for (const email of previouslySyncedEmails) {
      if (!googleEmailMap.has(email) && memberEmailSet.has(email)) {
        departureCount++;

        // Find the member name for the notification
        const member = orgMembers.find(
          (m) => m.user.email?.toLowerCase() === email,
        );
        const memberName = member?.user.name ?? email;

        if (adminUserIds.length > 0) {
          await dispatch({
            organizationId,
            type: "DIRECTORY_DEPARTURE",
            recipientUserIds: adminUserIds,
            title: `${memberName} may have left the organization`,
            body: `${memberName} (${email}) was removed or suspended in Google Workspace.`,
            entityType: "ORGANIZATION",
            entityId: organizationId,
            metadata: { email },
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 10: Update synced emails snapshot in configJson
    // -----------------------------------------------------------------------

    await prisma.integrationConnection.update({
      where: { id: connectionId },
      data: {
        configJson: {
          ...configJson,
          syncedEmails: Array.from(googleEmailMap.keys()),
          lastSyncUserCount: googleUsers.length,
        },
        lastSyncAt: new Date(),
        lastSuccessAt: new Date(),
      },
    });

    // -----------------------------------------------------------------------
    // Step 11: Complete sync log
    // -----------------------------------------------------------------------

    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "SUCCESS",
        completedAt: new Date(),
        responsePayloadJson: {
          newHires: newHireCount,
          departures: departureCount,
          totalUsers: googleUsers.length,
        },
      },
    });

    return {
      newHires: newHireCount,
      departures: departureCount,
      totalUsers: googleUsers.length,
    };
  } catch (error) {
    // -----------------------------------------------------------------------
    // Error handling: update sync log and connection status
    // -----------------------------------------------------------------------

    const errorMessage =
      error instanceof Error ? error.message : String(error);

    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage,
      },
    });

    await prisma.integrationConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastErrorAt: new Date(),
        lastErrorMessage: errorMessage,
        status: "ERROR",
      },
    });

    // Re-throw so the route handler returns 500 (QStash will retry)
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns user IDs of org admins and owners for notification dispatch.
 */
async function getOrgAdminUserIds(
  organizationId: string,
): Promise<string[]> {
  const admins = await prisma.member.findMany({
    where: {
      organizationId,
      role: { in: ["owner", "admin"] },
    },
    select: { userId: true },
  });

  return admins.map((a) => a.userId);
}
