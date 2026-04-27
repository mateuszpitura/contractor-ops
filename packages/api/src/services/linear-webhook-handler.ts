import type { Prisma } from '@contractor-ops/db';
import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import type { LinearIssueMetadata } from '@contractor-ops/validators';
import { getServerEnv, linearWebhookPayloadSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { linearGraphQL } from './linear-issue-sync.js';
import { resolveInternalStatus } from './linear-status-mapping.js';
import type { DbClient } from './types.js';

type PrismaClient = DbClient;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Time window (ms) to suppress bounce-back webhooks from our own changes */
const LOOP_PREVENTION_WINDOW_MS = 30_000;

/** Time window (ms) for deduplication of rapid-fire webhooks */
const DEDUP_WINDOW_MS = 5_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LinearConnectionConfig {
  stateCache?: Record<string, Record<string, { name: string; type: string }>>;
  webhooks?: Record<string, string>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Sync log helper
// ---------------------------------------------------------------------------

/**
 * Creates an inbound IntegrationSyncLog entry with common fields pre-filled.
 */
function logInboundSync(
  prisma: PrismaClient,
  organizationId: string,
  connectionId: string,
  syncType: string,
  data: {
    status?: string;
    entityType?: string;
    entityId?: string;
    errorMessage?: string;
    responsePayloadJson?: Record<string, unknown>;
    requestPayloadJson?: Record<string, unknown>;
  },
) {
  return prisma.integrationSyncLog.create({
    data: {
      organizationId,
      integrationConnectionId: connectionId,
      direction: 'INBOUND',
      syncType,
      status: (data.status ?? 'SUCCESS') as Prisma.IntegrationSyncLogCreateInput['status'],
      completedAt: data.status === 'STARTED' ? undefined : new Date(),
      entityType: data.entityType as Prisma.IntegrationSyncLogCreateInput['entityType'],
      entityId: data.entityId,
      errorMessage: data.errorMessage,
      responsePayloadJson: data.responsePayloadJson as Prisma.InputJsonValue | undefined,
      requestPayloadJson: data.requestPayloadJson as Prisma.InputJsonValue | undefined,
    },
  });
}

/**
 * Checks if an ExternalLink was recently synced from our app (loop prevention).
 */
function isBounceBack(metadata: Record<string, unknown>, windowMs: number): boolean {
  const origin = metadata.lastSyncOrigin as string | undefined;
  const syncAt = metadata.lastSyncAt as string | undefined;
  if (origin !== 'APP' || !syncAt) return false;
  return Date.now() - new Date(syncAt).getTime() < windowMs;
}

/**
 * Resolves a Linear workflow state name and type from the connection's cache
 * or by querying the Linear API. Updates the cache on miss.
 */
async function resolveStateName(
  prisma: PrismaClient,
  connection: { id: string; credentialsRef: string; configJson: unknown },
  teamId: string,
  stateId: string,
): Promise<{ stateName: string; stateType: string }> {
  const config = (connection.configJson as LinearConnectionConfig) ?? {};
  const cached = config.stateCache?.[teamId]?.[stateId];
  if (cached?.name && cached?.type) {
    return { stateName: cached.name, stateType: cached.type };
  }

  try {
    const credentials = decryptCredentials(connection.credentialsRef, 'linear');
    const result = await linearGraphQL<{
      workflowState: { id: string; name: string; type: string };
    }>(
      credentials.accessToken,
      `query GetState($id: String!) { workflowState(id: $id) { id name type } }`,
      { id: stateId },
    );

    const { name, type } = result.workflowState;

    // Update cache
    const updatedConfig = { ...config };
    if (!updatedConfig.stateCache) updatedConfig.stateCache = {};
    if (!updatedConfig.stateCache[teamId]) updatedConfig.stateCache[teamId] = {};
    updatedConfig.stateCache[teamId][stateId] = { name, type };
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: { configJson: updatedConfig as Prisma.InputJsonValue },
    });

    return { stateName: name, stateType: type };
  } catch {
    return { stateName: 'Unknown', stateType: 'unstarted' };
  }
}

// ---------------------------------------------------------------------------
// Process Inbound Webhook
// ---------------------------------------------------------------------------

/**
 * Processes an inbound Linear webhook payload for issue state changes.
 *
 * Flow:
 * 1. Parse and validate the webhook payload
 * 2. Only process action: "update" with updatedFrom.stateId (state changes)
 * 3. Find linked ExternalLink by issue identifier
 * 4. Check loop prevention (skip if origin is "APP" within 30s)
 * 5. Check dedup (skip if same status change within 5s)
 * 6. Resolve internal status from Linear stateId
 * 7. Resolve state name from cache or API
 * 8. Update WorkflowTaskRun status
 * 9. Update ExternalLink metadata
 * 10. Log to IntegrationSyncLog
 *
 * @param prisma - Prisma client instance
 * @param organizationId - The organization ID
 * @param connectionId - The IntegrationConnection ID
 * @param payload - The raw webhook payload
 */
export async function processLinearWebhook(
  prisma: PrismaClient,
  organizationId: string,
  connectionId: string,
  payload: unknown,
): Promise<void> {
  // 1. Parse and validate payload
  const parsed = linearWebhookPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    await logInboundSync(prisma, organizationId, connectionId, 'webhook-invalid', {
      status: 'FAILED',
      errorMessage: `Invalid Linear webhook payload: ${parsed.error.message}`,
    });
    return;
  }

  const webhookPayload = parsed.data;

  // 2. Only process state change updates
  if (webhookPayload.action !== 'update' || !webhookPayload.updatedFrom?.stateId) {
    await logInboundSync(prisma, organizationId, connectionId, 'webhook-ignored', {
      responsePayloadJson: {
        action: webhookPayload.action,
        identifier: webhookPayload.data.identifier,
        reason:
          webhookPayload.action === 'update'
            ? 'No state change detected (updatedFrom.stateId missing)'
            : `Action '${webhookPayload.action}' not processed`,
      },
    });
    return;
  }

  const issueIdentifier = webhookPayload.data.identifier;
  const newStateId = webhookPayload.data.stateId;
  const teamId = webhookPayload.data.teamId;

  // 3. Find ExternalLink by issue identifier
  const externalLink = await prisma.externalLink.findFirst({
    where: { organizationId, externalType: 'LINEAR_ISSUE', externalId: issueIdentifier },
  });

  if (!externalLink) {
    await logInboundSync(prisma, organizationId, connectionId, 'webhook-unlinked', {
      responsePayloadJson: {
        identifier: issueIdentifier,
        reason: 'No ExternalLink found for this Linear issue',
      },
    });
    return;
  }

  // 4. Loop prevention: Check if this is a bounce-back from our own outbound sync
  const metadata = (externalLink.metadataJson as Record<string, unknown>) ?? {};

  if (isBounceBack(metadata, LOOP_PREVENTION_WINDOW_MS)) {
    const syncAge = Date.now() - new Date(metadata.lastSyncAt as string).getTime();
    await logInboundSync(prisma, organizationId, connectionId, 'webhook-loop-suppressed', {
      responsePayloadJson: {
        identifier: issueIdentifier,
        reason: `Suppressed bounce-back (origin=APP, age=${syncAge}ms)`,
      },
    });
    return;
  }

  // 5. Deduplication: Check for duplicate webhook within 5s window
  const deduplicationCutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
  const recentDuplicate = await prisma.integrationSyncLog.findFirst({
    where: {
      organizationId,
      integrationConnectionId: connectionId,
      direction: 'INBOUND',
      syncType: 'issue-status-change',
      startedAt: { gte: deduplicationCutoff },
      responsePayloadJson: {
        path: ['identifier'],
        equals: issueIdentifier,
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  if (recentDuplicate) {
    const recentPayload = recentDuplicate.responsePayloadJson as Record<string, unknown> | null;
    if (recentPayload?.newStateId === newStateId) {
      // Duplicate webhook -- skip
      return;
    }
  }

  // 6. Resolve internal status from Linear stateId
  const mappedWorkflowStatus = await resolveInternalStatus(
    prisma,
    connectionId,
    teamId,
    newStateId,
  );

  if (!mappedWorkflowStatus) {
    await logInboundSync(prisma, organizationId, connectionId, 'webhook-status-unmapped', {
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: externalLink.entityId,
      responsePayloadJson: {
        identifier: issueIdentifier,
        stateId: newStateId,
        teamId,
        reason: 'No workflow status mapping found for this Linear state',
      },
    });
    return;
  }

  // 7. Resolve state name from cache or API
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) return;

  const { stateName, stateType } = await resolveStateName(prisma, connection, teamId, newStateId);

  // 8. Create sync log
  const syncLog = await logInboundSync(
    prisma,
    organizationId,
    connectionId,
    'issue-status-change',
    {
      status: 'STARTED',
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: externalLink.entityId,
      requestPayloadJson: {
        identifier: issueIdentifier,
        fromStateId: webhookPayload.updatedFrom.stateId,
        toStateId: newStateId,
        teamId,
      },
    },
  );

  try {
    // 9. Update WorkflowTaskRun status
    await prisma.workflowTaskRun.update({
      where: { id: externalLink.entityId },
      data: {
        status: mappedWorkflowStatus as Prisma.WorkflowTaskRunUpdateInput['status'],
      },
    });

    // 10. Update ExternalLink metadata
    const updatedMetadata: LinearIssueMetadata = {
      identifier: issueIdentifier,
      linearIssueId: (metadata.linearIssueId as string) ?? webhookPayload.data.id,
      title: webhookPayload.data.title,
      status: stateName,
      statusType: stateType as LinearIssueMetadata['statusType'],
      url: (metadata.url as string) ?? externalLink.externalUrl ?? webhookPayload.data.url,
      lastSyncOrigin: 'LINEAR',
      lastSyncAt: new Date().toISOString(),
    };

    await prisma.externalLink.update({
      where: { id: externalLink.id },
      data: {
        metadataJson: updatedMetadata,
      },
    });

    // 11. Update sync log to success
    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: {
          identifier: issueIdentifier,
          newStateId,
          newStateName: stateName,
          mappedWorkflowStatus,
        },
      },
    });
  } catch (error) {
    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to process Linear webhook',
      cause: error,
    });
  }
}

// ---------------------------------------------------------------------------
// Webhook Registration
// ---------------------------------------------------------------------------

/**
 * Registers a Linear webhook for the specified team.
 *
 * Uses Linear's webhookCreate mutation. Stores webhook ID in
 * configJson.webhooks[teamId] for later deregistration.
 *
 * @param prisma - Prisma client instance
 * @param connectionId - The IntegrationConnection ID
 * @param teamId - The Linear team ID to monitor
 * @returns The created webhook ID
 */
export async function registerLinearWebhook(
  prisma: PrismaClient,
  connectionId: string,
  teamId: string,
): Promise<string> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!(connection && ['CONNECTED', 'PENDING_MAPPING'].includes(connection.status))) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Linear connection is not active',
    });
  }

  const credentials = decryptCredentials(connection.credentialsRef, 'linear');

  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;

  const webhookUrl = `${appUrl}/api/webhooks/linear`;

  const result = await linearGraphQL<{
    webhookCreate: {
      success: boolean;
      webhook: { id: string; enabled: boolean };
    };
  }>(
    credentials.accessToken,
    `mutation CreateWebhook($input: WebhookCreateInput!) {
      webhookCreate(input: $input) {
        success
        webhook { id enabled }
      }
    }`,
    {
      input: {
        url: webhookUrl,
        teamId,
        resourceTypes: ['Issue'],
        enabled: true,
      },
    },
  );

  if (!result.webhookCreate.success) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Linear webhookCreate returned success=false',
    });
  }

  const webhookId = result.webhookCreate.webhook.id;

  // Store webhook ID in connection config
  const config = (connection.configJson as LinearConnectionConfig) ?? {};
  const webhooks = config.webhooks ?? {};
  webhooks[teamId] = webhookId;

  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      configJson: {
        ...config,
        webhooks,
      },
    },
  });

  return webhookId;
}

/**
 * Deregisters a Linear webhook for the specified team.
 *
 * @param prisma - Prisma client instance
 * @param connectionId - The IntegrationConnection ID
 * @param teamId - The Linear team ID
 */
export async function deregisterLinearWebhook(
  prisma: PrismaClient,
  connectionId: string,
  teamId: string,
): Promise<void> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) return;

  const config = (connection.configJson as LinearConnectionConfig) ?? {};
  const webhookId = config.webhooks?.[teamId];

  if (!webhookId) return;

  // Best-effort delete
  try {
    const credentials = decryptCredentials(connection.credentialsRef, 'linear');

    await linearGraphQL(
      credentials.accessToken,
      `mutation DeleteWebhook($id: String!) {
        webhookDelete(id: $id) { success }
      }`,
      { id: webhookId },
    );
  } catch {
    // best-effort cleanup
  }

  // Remove from config
  const webhooks = { ...config.webhooks };
  delete webhooks[teamId];

  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      configJson: {
        ...config,
        webhooks,
      },
    },
  });
}
