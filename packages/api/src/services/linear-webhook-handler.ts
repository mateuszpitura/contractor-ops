import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import type { LinearIssueMetadata } from '@contractor-ops/validators';
import { linearWebhookPayloadSchema } from '@contractor-ops/validators';
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
    await prisma.integrationSyncLog.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        direction: 'INBOUND',
        syncType: 'webhook-invalid',
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: `Invalid Linear webhook payload: ${parsed.error.message}`,
      },
    });
    return;
  }

  const webhookPayload = parsed.data;

  // 2. Only process state change updates
  if (webhookPayload.action !== 'update' || !webhookPayload.updatedFrom?.stateId) {
    // Not a state change -- log and return early
    await prisma.integrationSyncLog.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        direction: 'INBOUND',
        syncType: 'webhook-ignored',
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: {
          action: webhookPayload.action,
          identifier: webhookPayload.data.identifier,
          reason:
            webhookPayload.action === 'update'
              ? 'No state change detected (updatedFrom.stateId missing)'
              : `Action '${webhookPayload.action}' not processed`,
        },
      },
    });
    return;
  }

  const issueIdentifier = webhookPayload.data.identifier;
  const newStateId = webhookPayload.data.stateId;
  const teamId = webhookPayload.data.teamId;

  // 3. Find ExternalLink by issue identifier
  const externalLink = await prisma.externalLink.findFirst({
    where: {
      organizationId,
      externalType: 'LINEAR_ISSUE',
      externalId: issueIdentifier,
    },
  });

  if (!externalLink) {
    // Issue not linked to any task -- normal per Pitfall 5
    await prisma.integrationSyncLog.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        direction: 'INBOUND',
        syncType: 'webhook-unlinked',
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: {
          identifier: issueIdentifier,
          reason: 'No ExternalLink found for this Linear issue',
        },
      },
    });
    return;
  }

  // 4. Loop prevention: Check if this is a bounce-back from our own outbound sync
  const metadata = (externalLink.metadataJson as Record<string, unknown>) ?? {};
  const lastSyncOrigin = metadata.lastSyncOrigin as string | undefined;
  const lastSyncAt = metadata.lastSyncAt as string | undefined;

  if (lastSyncOrigin === 'APP' && lastSyncAt) {
    const syncAge = Date.now() - new Date(lastSyncAt).getTime();
    if (syncAge < LOOP_PREVENTION_WINDOW_MS) {
      await prisma.integrationSyncLog.create({
        data: {
          organizationId,
          integrationConnectionId: connectionId,
          direction: 'INBOUND',
          syncType: 'webhook-loop-suppressed',
          status: 'SUCCESS',
          completedAt: new Date(),
          responsePayloadJson: {
            identifier: issueIdentifier,
            reason: `Suppressed bounce-back (origin=APP, age=${syncAge}ms)`,
          },
        },
      });
      return;
    }
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
    // No mapping for this Linear state -- log unmapped per D-04
    await prisma.integrationSyncLog.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        direction: 'INBOUND',
        syncType: 'webhook-status-unmapped',
        entityType: 'WORKFLOW_TASK_RUN',
        entityId: externalLink.entityId,
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: {
          identifier: issueIdentifier,
          stateId: newStateId,
          teamId,
          reason: 'No workflow status mapping found for this Linear state',
        },
      },
    });
    return;
  }

  // 7. Resolve state name from cache or API
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) return;

  const config = (connection.configJson as LinearConnectionConfig) ?? {};
  let stateName = config.stateCache?.[teamId]?.[newStateId]?.name;
  let stateType = config.stateCache?.[teamId]?.[newStateId]?.type;

  if (!(stateName && stateType)) {
    // Not in cache -- fetch from Linear API
    try {
      const credentials = decryptCredentials(connection.credentialsRef, 'linear');
      const stateResult = await linearGraphQL<{
        workflowState: { id: string; name: string; type: string };
      }>(
        credentials.accessToken,
        `query GetState($id: String!) {
          workflowState(id: $id) { id name type }
        }`,
        { id: newStateId },
      );

      stateName = stateResult.workflowState.name;
      stateType = stateResult.workflowState.type;

      // Update cache
      const updatedConfig = { ...config };
      if (!updatedConfig.stateCache) updatedConfig.stateCache = {};
      if (!updatedConfig.stateCache[teamId]) updatedConfig.stateCache[teamId] = {};
      updatedConfig.stateCache[teamId][newStateId] = {
        name: stateName,
        type: stateType,
      };

      await prisma.integrationConnection.update({
        where: { id: connectionId },
        data: { configJson: updatedConfig },
      });
    } catch {
      // Use fallback values if API call fails
      stateName = 'Unknown';
      stateType = 'unstarted';
    }
  }

  // 8. Create sync log
  const syncLog = await prisma.integrationSyncLog.create({
    data: {
      organizationId,
      integrationConnectionId: connectionId,
      direction: 'INBOUND',
      syncType: 'issue-status-change',
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: externalLink.entityId,
      status: 'STARTED',
      requestPayloadJson: {
        identifier: issueIdentifier,
        fromStateId: webhookPayload.updatedFrom.stateId,
        toStateId: newStateId,
        teamId,
      },
    },
  });

  try {
    // 9. Update WorkflowTaskRun status
    await prisma.workflowTaskRun.update({
      where: { id: externalLink.entityId },
      data: {
        status: mappedWorkflowStatus,
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (!appUrl) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'NEXT_PUBLIC_APP_URL environment variable is required for webhook registration',
    });
  }

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
    // Best effort -- continue to clean up config
    console.warn(`[Linear] Failed to delete webhook ${webhookId} for team ${teamId}`);
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
