import { prisma } from '@contractor-ops/db';
import { decryptCredentials, encryptCredentials, getAdapter } from '@contractor-ops/integrations';
import type {
  GoogleDirectoryUser,
  GoogleWorkspaceAdapter,
} from '@contractor-ops/integrations/adapters/google-workspace-adapter';
import { releaseAdvisoryLock, tryAcquireAdvisoryLock } from '../lib/advisory-lock';
import { dispatch } from './notification-service';

// ---------------------------------------------------------------------------
// Google Workspace Directory Sync Orchestrator
// ---------------------------------------------------------------------------

type IntegrationConnectionRow = Awaited<
  ReturnType<typeof prisma.integrationConnection.findUniqueOrThrow>
>;
type DecryptedGoogleCredentials = ReturnType<typeof decryptCredentials>;

interface DirectorySnapshot {
  googleUsers: GoogleDirectoryUser[];
  googleEmailMap: Map<string, GoogleDirectoryUser>;
  memberEmailSet: Set<string>;
  orgMembers: Array<{ user: { email: string | null; name: string | null } }>;
  previouslySyncedEmails: Set<string>;
  configJson: Record<string, unknown>;
}

interface DiffCounts {
  newHires: number;
  departures: number;
}

// ---------------------------------------------------------------------------
// Phase helpers (pure / single-purpose)
// ---------------------------------------------------------------------------

/**
 * Loads + validates the integration connection. Throws if the connection
 * doesn't belong to the org or isn't in CONNECTED state.
 */
async function loadAndValidateConnection(
  organizationId: string,
  connectionId: string,
): Promise<IntegrationConnectionRow> {
  const connection = await prisma.integrationConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  if (connection.organizationId !== organizationId) {
    throw new Error('Connection does not belong to the specified organization');
  }

  if (connection.status !== 'CONNECTED') {
    throw new Error(`Connection is not active (status: ${connection.status})`);
  }

  return connection;
}

/**
 * Returns true if the OAuth access token is expired (with a 5-minute buffer).
 */
function isTokenExpired(credentials: DecryptedGoogleCredentials): boolean {
  return Boolean(
    credentials.expiresAt && new Date(credentials.expiresAt).getTime() < Date.now() + 5 * 60 * 1000,
  );
}

/**
 * Refreshes the OAuth token if needed and persists the encrypted refreshed
 * credentials. Returns the (possibly refreshed) credentials.
 */
async function ensureFreshCredentials(
  adapter: GoogleWorkspaceAdapter,
  connectionId: string,
  credentials: DecryptedGoogleCredentials,
): Promise<DecryptedGoogleCredentials> {
  if (!isTokenExpired(credentials)) return credentials;

  const refreshed = await adapter.refreshToken(credentials);
  const encryptedCreds = encryptCredentials(refreshed, 'google_workspace');
  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      credentialsRef: encryptedCreds,
      tokenExpiresAt: refreshed.expiresAt ? new Date(refreshed.expiresAt) : null,
    },
  });
  return refreshed;
}

/**
 * Builds the canonical directory snapshot used for diffing: the upstream
 * Google directory, local org-member emails, and the previously-synced
 * snapshot persisted in `connection.configJson`.
 */
async function buildDirectorySnapshot(
  adapter: GoogleWorkspaceAdapter,
  connection: IntegrationConnectionRow,
  credentials: DecryptedGoogleCredentials,
  organizationId: string,
): Promise<DirectorySnapshot> {
  const googleUsers = await adapter.listAllDirectoryUsers(credentials.accessToken);

  // email -> GoogleDirectoryUser (lowercased for case-insensitive compare)
  const googleEmailMap = new Map(googleUsers.map(u => [u.primaryEmail.toLowerCase(), u]));

  const orgMembers = await prisma.member.findMany({
    where: { organizationId },
    include: { user: { select: { email: true, name: true } } },
  });

  const memberEmailSet = new Set(
    orgMembers.map(m => m.user.email?.toLowerCase()).filter((e): e is string => !!e),
  );

  const configJson = (connection.configJson as Record<string, unknown> | null) ?? {};
  const previouslySyncedEmails = new Set<string>(
    Array.isArray(configJson.syncedEmails)
      ? (configJson.syncedEmails as string[]).map(e => e.toLowerCase())
      : [],
  );

  return {
    googleUsers,
    googleEmailMap,
    memberEmailSet,
    orgMembers,
    previouslySyncedEmails,
    configJson,
  };
}

/**
 * D-13: emits new-hire notifications for Google users not in the org and not
 * previously synced. Returns the count of detected new hires.
 */
async function detectAndNotifyNewHires(
  snapshot: DirectorySnapshot,
  organizationId: string,
  adminUserIds: string[],
): Promise<number> {
  let count = 0;

  for (const [email, googleUser] of snapshot.googleEmailMap) {
    if (snapshot.memberEmailSet.has(email) || snapshot.previouslySyncedEmails.has(email)) {
      continue;
    }
    count++;

    if (adminUserIds.length === 0) continue;

    await dispatch({
      organizationId,
      type: 'DIRECTORY_NEW_HIRE',
      recipientUserIds: adminUserIds,
      title: `New team member detected: ${googleUser.name.fullName}`,
      body: `${googleUser.name.fullName} (${googleUser.primaryEmail}) was added to Google Workspace.`,
      entityType: 'ORGANIZATION',
      entityId: organizationId,
      metadata: {
        googleUserId: googleUser.id,
        email: googleUser.primaryEmail,
      },
    });
  }

  return count;
}

/**
 * D-14: emits departure notifications for previously-synced emails no longer
 * in Google but still org members. Returns the count of detected departures.
 */
async function detectAndNotifyDepartures(
  snapshot: DirectorySnapshot,
  organizationId: string,
  adminUserIds: string[],
): Promise<number> {
  let count = 0;

  for (const email of snapshot.previouslySyncedEmails) {
    if (snapshot.googleEmailMap.has(email) || !snapshot.memberEmailSet.has(email)) {
      continue;
    }
    count++;

    if (adminUserIds.length === 0) continue;

    const member = snapshot.orgMembers.find(m => m.user.email?.toLowerCase() === email);
    const memberName = member?.user.name ?? email;

    await dispatch({
      organizationId,
      type: 'DIRECTORY_DEPARTURE',
      recipientUserIds: adminUserIds,
      title: `${memberName} may have left the organization`,
      body: `${memberName} (${email}) was removed or suspended in Google Workspace.`,
      entityType: 'ORGANIZATION',
      entityId: organizationId,
      metadata: { email },
    });
  }

  return count;
}

/**
 * Persists the new synced-email snapshot + bumps last-sync timestamps on the
 * connection row.
 */
async function persistSyncSuccess(
  connectionId: string,
  snapshot: DirectorySnapshot,
): Promise<void> {
  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      configJson: {
        ...snapshot.configJson,
        syncedEmails: Array.from(snapshot.googleEmailMap.keys()),
        lastSyncUserCount: snapshot.googleUsers.length,
      },
      lastSyncAt: new Date(),
      lastSuccessAt: new Date(),
    },
  });
}

/**
 * Records the failure on both the sync log and the connection row.
 */
async function recordSyncFailure(
  syncLogId: string,
  connectionId: string,
  errorMessage: string,
): Promise<void> {
  await prisma.integrationSyncLog.update({
    where: { id: syncLogId },
    data: {
      status: 'FAILED',
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
      status: 'ERROR',
    },
  });
}

// ---------------------------------------------------------------------------
// Public orchestrator
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

  const syncLog = await prisma.integrationSyncLog.create({
    data: {
      organizationId,
      integrationConnectionId: connectionId,
      direction: 'INBOUND',
      syncType: 'directory_sync',
      status: 'STARTED',
      startedAt: new Date(),
    },
  });

  // Per-connection sync lock under the `'sync'` namespace (see
  // packages/api/src/lib/advisory-lock.ts). The connection id is the natural
  // key — we serialize syncs per integration connection, not per org.
  const lockKey = `google-workspace:${connectionId}`;
  const lockAcquired = await tryAcquireAdvisoryLock(prisma, 'sync', lockKey);
  if (!lockAcquired) {
    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: { skipped: true, reason: 'already-running' },
      },
    });
    return { newHires: 0, departures: 0, totalUsers: 0 };
  }

  try {
    const connection = await loadAndValidateConnection(organizationId, connectionId);

    const adapter = getAdapter('google_workspace') as GoogleWorkspaceAdapter;
    const credentials = await ensureFreshCredentials(
      adapter,
      connectionId,
      decryptCredentials(connection.credentialsRef, 'google_workspace'),
    );

    const snapshot = await buildDirectorySnapshot(adapter, connection, credentials, organizationId);
    const adminUserIds = await getOrgAdminUserIds(organizationId);

    const diff: DiffCounts = {
      newHires: await detectAndNotifyNewHires(snapshot, organizationId, adminUserIds),
      departures: await detectAndNotifyDepartures(snapshot, organizationId, adminUserIds),
    };

    await persistSyncSuccess(connectionId, snapshot);

    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: {
          newHires: diff.newHires,
          departures: diff.departures,
          totalUsers: snapshot.googleUsers.length,
        },
      },
    });

    return {
      newHires: diff.newHires,
      departures: diff.departures,
      totalUsers: snapshot.googleUsers.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await recordSyncFailure(syncLog.id, connectionId, errorMessage);
    // Re-throw so the route handler returns 500 (QStash will retry)
    throw error;
  } finally {
    // Best-effort unlock; the lock is connection-scoped so it is safe to ignore unlock failures.
    // safe-swallow: pre-existing — see goals/production-hardening/ phase B.7.b
    await releaseAdvisoryLock(prisma, 'sync', lockKey).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns user IDs of org admins and owners for notification dispatch.
 */
async function getOrgAdminUserIds(organizationId: string): Promise<string[]> {
  const admins = await prisma.member.findMany({
    where: {
      organizationId,
      role: { in: ['owner', 'admin'] },
    },
    select: { userId: true },
  });

  return admins.map(a => a.userId);
}
