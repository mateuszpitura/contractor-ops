import type { Prisma } from '@contractor-ops/db';
import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import type { LinearIssueMetadata } from '@contractor-ops/validators';
import { getServerEnv, linearWebhookPayloadSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import * as E from '../errors';
import {
  unblockDependentsAndRecomputeRun,
  validateTransition,
} from '../routers/workflow/workflow-shared';
import { linearGraphQL } from './linear-issue-sync';
import { resolveInternalStatus } from './linear-status-mapping';
import type { DbClient } from './types';

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
/**
 * Mark a sync log FAILED and rethrow: passes `TRPCError`s through untouched,
 * otherwise wraps in an INTERNAL_SERVER_ERROR with the original cause.
 */
async function failInboundSync(
  prisma: PrismaClient,
  syncLogId: string,
  error: unknown,
): Promise<never> {
  await prisma.integrationSyncLog.update({
    where: { id: syncLogId },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    },
  });

  if (error instanceof TRPCError) throw error;
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: E.LINEAR_WEBHOOK_PROCESSING_FAILED,
    cause: error,
  });
}

/** Build the refreshed ExternalLink metadata for an inbound Linear update. */
function buildUpdatedLinearMetadata(args: {
  issueIdentifier: string;
  metadata: Record<string, unknown>;
  data: { id: string; title: string; url: string };
  externalUrl: string | null;
  stateName: string;
  stateType: string;
}): LinearIssueMetadata {
  const { issueIdentifier, metadata, data, externalUrl, stateName, stateType } = args;
  return {
    identifier: issueIdentifier,
    linearIssueId: (metadata.linearIssueId as string) ?? data.id,
    title: data.title,
    status: stateName,
    statusType: stateType as LinearIssueMetadata['statusType'],
    url: (metadata.url as string) ?? externalUrl ?? data.url,
    lastSyncOrigin: 'LINEAR',
    lastSyncAt: new Date().toISOString(),
  };
}

/**
 * Whether a webhook for the same issue + target state arrived within the dedup
 * window — Linear occasionally double-delivers the same state change.
 */
async function isDuplicateLinearWebhook(
  prisma: PrismaClient,
  organizationId: string,
  connectionId: string,
  issueIdentifier: string,
  newStateId: string,
): Promise<boolean> {
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

  if (!recentDuplicate) return false;
  const recentPayload = recentDuplicate.responsePayloadJson as Record<string, unknown> | null;
  return recentPayload?.newStateId === newStateId;
}

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

  // 5. Deduplication: skip a duplicate webhook within the 5s window
  if (
    await isDuplicateLinearWebhook(
      prisma,
      organizationId,
      connectionId,
      issueIdentifier,
      newStateId,
    )
  ) {
    return;
  }

  // 6. Resolve internal status from Linear stateId
  const mappedWorkflowStatus = await resolveInternalStatus(
    prisma,
    organizationId,
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
    await prisma.$transaction(async tx => {
      const task = await tx.workflowTaskRun.findFirst({
        where: { id: externalLink.entityId, organizationId },
        select: { id: true, status: true, workflowRunId: true },
      });

      if (!task) {
        throw new Error('Linked workflow task not found');
      }

      if (!validateTransition(task.status, mappedWorkflowStatus)) {
        throw new Error(`Invalid task transition ${task.status} -> ${mappedWorkflowStatus}`);
      }

      const now = new Date();
      const updateData: Prisma.WorkflowTaskRunUpdateInput = {
        status: mappedWorkflowStatus as Prisma.WorkflowTaskRunUpdateInput['status'],
      };
      if (mappedWorkflowStatus === 'DONE') {
        updateData.completedAt = now;
      }

      await tx.workflowTaskRun.update({
        where: { id: task.id, organizationId },
        data: updateData,
      });

      if (mappedWorkflowStatus === 'DONE' || mappedWorkflowStatus === 'SKIPPED') {
        await unblockDependentsAndRecomputeRun(
          tx,
          { id: task.id, workflowRun: { id: task.workflowRunId } },
          now,
          { organizationId },
        );
      }

      const updatedMetadata = buildUpdatedLinearMetadata({
        issueIdentifier,
        metadata,
        data: webhookPayload.data,
        externalUrl: externalLink.externalUrl,
        stateName,
        stateType,
      });

      await tx.externalLink.update({
        where: { id: externalLink.id },
        data: {
          metadataJson: updatedMetadata,
        },
      });

      await tx.integrationSyncLog.update({
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
    });
  } catch (error) {
    await failInboundSync(prisma, syncLog.id, error);
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
      message: E.LINEAR_CONNECTION_NOT_ACTIVE,
    });
  }

  const credentials = decryptCredentials(connection.credentialsRef, 'linear');

  const apiUrl = getServerEnv().API_URL;

  const webhookUrl = `${apiUrl}/webhooks/linear`;

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
      message: E.LINEAR_WEBHOOK_CREATE_FAILED,
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
    // safe-swallow: the Linear webhook may already be deleted upstream; we remove it from local config below regardless
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
