import type { Prisma } from '@contractor-ops/db';
import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import type { JiraIssueMetadata } from '@contractor-ops/validators';
import { getServerEnv, jiraWebhookPayloadSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { lookupWorkflowStatus } from './jira-status-mapping.js';
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

interface JiraConnectionConfig {
  cloudId: string;
  webhookIds?: number[];
  webhookRegisteredAt?: string;
  webhookSecret?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildJiraApiContext(
  configJson: unknown,
  credentialsRef: string,
): { baseUrl: string; authHeaders: Record<string, string> } {
  const config = configJson as JiraConnectionConfig;

  if (!config?.cloudId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Jira connection is missing cloudId.',
    });
  }

  const credentials = decryptCredentials(credentialsRef, 'jira');

  return {
    baseUrl: `https://api.atlassian.com/ex/jira/${config.cloudId}/rest/api/3`,
    authHeaders: {
      Authorization: `Bearer ${credentials.accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  };
}

// ---------------------------------------------------------------------------
// Process Inbound Webhook
// ---------------------------------------------------------------------------

/**
 * Processes an inbound Jira webhook payload for issue status changes.
 *
 * Flow:
 * 1. Parse and validate the webhook payload
 * 2. Extract status change from changelog
 * 3. Find linked ExternalLink by issue key
 * 4. Check loop prevention (skip if origin is "APP" within 30s)
 * 5. Deduplicate rapid-fire webhooks (same issue + status within 5s)
 * 6. Reverse-lookup workflow status from Jira status name
 * 7. Update WorkflowTaskRun status
 * 8. Update ExternalLink metadata
 * 9. Log to IntegrationSyncLog
 *
 * @param prisma - Prisma client instance
 * @param organizationId - The organization ID
 * @param connectionId - The IntegrationConnection ID
 * @param payload - The raw webhook payload
 */
export async function processJiraWebhook(
  prisma: PrismaClient,
  organizationId: string,
  connectionId: string,
  payload: unknown,
): Promise<void> {
  // 1. Parse and validate payload
  const parsed = jiraWebhookPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    // Not a valid issue_updated event — log and return
    await prisma.integrationSyncLog.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        direction: 'INBOUND',
        syncType: 'webhook-invalid',
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: `Invalid Jira webhook payload: ${parsed.error.message}`,
      },
    });
    return;
  }

  const webhookPayload = parsed.data;

  // 2. Extract status change from changelog
  const statusChange = webhookPayload.changelog.items.find(item => item.field === 'status');

  if (!statusChange) {
    // Not a status change — ignore
    return;
  }

  const issueKey = webhookPayload.issue.key;
  const newJiraStatusName = statusChange.toString ?? '';

  // 3. Find ExternalLink by issue key
  const externalLink = await prisma.externalLink.findFirst({
    where: {
      organizationId,
      externalType: 'JIRA_ISSUE',
      externalId: issueKey,
    },
  });

  if (!externalLink) {
    // Issue not linked to any task in our system — log and return
    await prisma.integrationSyncLog.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        direction: 'INBOUND',
        syncType: 'webhook-unlinked',
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: {
          issueKey,
          newStatus: newJiraStatusName,
          reason: 'No ExternalLink found for this Jira issue',
        },
      },
    });
    return;
  }

  // 4. Loop prevention (D-08): Check if this is a bounce-back from our own outbound sync
  const metadata = (externalLink.metadataJson as Record<string, unknown>) ?? {};
  const lastSyncOrigin = metadata.lastSyncOrigin as string | undefined;
  const lastSyncAt = metadata.lastSyncAt as string | undefined;

  if (lastSyncOrigin === 'APP' && lastSyncAt) {
    const syncAge = Date.now() - new Date(lastSyncAt).getTime();
    if (syncAge < LOOP_PREVENTION_WINDOW_MS) {
      // This is a bounce-back from our own change — skip processing
      await prisma.integrationSyncLog.create({
        data: {
          organizationId,
          integrationConnectionId: connectionId,
          direction: 'INBOUND',
          syncType: 'webhook-loop-suppressed',
          status: 'SUCCESS',
          completedAt: new Date(),
          responsePayloadJson: {
            issueKey,
            newStatus: newJiraStatusName,
            reason: `Suppressed bounce-back (origin=APP, age=${syncAge}ms)`,
          },
        },
      });
      return;
    }
  }

  // 5. Deduplication: Check for duplicate webhook within 5s window (Pitfall 4)
  const deduplicationCutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
  const recentDuplicate = await prisma.integrationSyncLog.findFirst({
    where: {
      organizationId,
      integrationConnectionId: connectionId,
      direction: 'INBOUND',
      syncType: 'issue-status-change',
      startedAt: { gte: deduplicationCutoff },
      responsePayloadJson: {
        path: ['issueKey'],
        equals: issueKey,
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  if (recentDuplicate) {
    const recentPayload = recentDuplicate.responsePayloadJson as Record<string, unknown> | null;
    if (recentPayload?.newStatus === newJiraStatusName) {
      // Duplicate webhook — skip
      return;
    }
  }

  // 6. Get project ID and look up workflow status mapping
  const projectId = webhookPayload.issue.fields.project.id;
  const mappedWorkflowStatus = await lookupWorkflowStatus(
    prisma,
    connectionId,
    projectId,
    newJiraStatusName,
  );

  if (!mappedWorkflowStatus) {
    // No mapping for this Jira status — log and return
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
          issueKey,
          jiraStatus: newJiraStatusName,
          projectId,
          reason: 'No workflow status mapping found for this Jira status',
        },
      },
    });
    return;
  }

  // 7. Create sync log
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
        issueKey,
        fromStatus: statusChange.fromString,
        toStatus: newJiraStatusName,
        projectId,
      },
    },
  });

  try {
    // 8. Update WorkflowTaskRun status
    await prisma.workflowTaskRun.update({
      where: { id: externalLink.entityId },
      data: {
        status: mappedWorkflowStatus as Prisma.WorkflowTaskRunUpdateInput['status'],
      },
    });

    // 9. Update ExternalLink metadata
    const updatedMetadata: JiraIssueMetadata = {
      key: issueKey,
      summary: webhookPayload.issue.fields.summary,
      status: newJiraStatusName,
      statusCategory: webhookPayload.issue.fields.status.statusCategory.key,
      url: (metadata.url as string) ?? externalLink.externalUrl ?? '',
      lastSyncOrigin: 'JIRA',
      lastSyncAt: new Date().toISOString(),
    };

    await prisma.externalLink.update({
      where: { id: externalLink.id },
      data: {
        metadataJson: updatedMetadata,
      },
    });

    // 10. Update sync log to success
    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: {
          issueKey,
          newStatus: newJiraStatusName,
          mappedWorkflowStatus,
          statusCategory: webhookPayload.issue.fields.status.statusCategory.key,
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
      message: 'Failed to process Jira webhook',
      cause: error,
    });
  }
}

// ---------------------------------------------------------------------------
// Webhook Registration
// ---------------------------------------------------------------------------

/**
 * Registers Jira webhooks for the specified project keys.
 *
 * Uses a single webhook registration with combined JQL filter (Pitfall 5:
 * 5-per-app limit). Stores webhook IDs in connection configJson for
 * later refresh/deregistration.
 *
 * @param prisma - Prisma client instance
 * @param connectionId - The IntegrationConnection ID
 * @param projectKeys - Array of Jira project keys to monitor
 */
export async function registerJiraWebhooks(
  prisma: PrismaClient,
  connectionId: string,
  projectKeys: string[],
): Promise<void> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.status !== 'CONNECTED') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Jira connection is not active',
    });
  }

  const { baseUrl, authHeaders } = buildJiraApiContext(
    connection.configJson,
    connection.credentialsRef,
  );

  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;

  // Build JQL filter combining all project keys
  const jqlFilter =
    projectKeys.length === 1
      ? `project = ${projectKeys[0]}`
      : `project IN (${projectKeys.join(', ')})`;

  const webhookBody = {
    url: `${appUrl}/api/webhooks/jira`,
    webhooks: [
      {
        jqlFilter,
        events: ['jira:issue_updated'],
      },
    ],
  };

  const response = await fetch(`${baseUrl}/webhook`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(webhookBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to register Jira webhook: ${text}`,
    });
  }

  const result = (await response.json()) as {
    webhookRegistrationResult: Array<{ createdWebhookId: number }>;
  };

  // Store webhook IDs in connection config
  const config = (connection.configJson as JiraConnectionConfig) ?? {};
  const webhookIds = result.webhookRegistrationResult.map(r => r.createdWebhookId);

  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      configJson: {
        ...config,
        webhookIds: [...(config.webhookIds ?? []), ...webhookIds],
        webhookRegisteredAt: new Date().toISOString(),
      },
    },
  });
}

/**
 * Deregisters all Jira webhooks for a connection.
 *
 * Called when disconnecting a Jira integration to prevent orphaned
 * webhooks from hitting a dead endpoint.
 *
 * @param prisma - Prisma client instance
 * @param connectionId - The IntegrationConnection ID
 */
export async function deregisterJiraWebhooks(
  prisma: PrismaClient,
  connectionId: string,
): Promise<void> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) return;

  const config = (connection.configJson as JiraConnectionConfig) ?? {};
  const webhookIds = config.webhookIds ?? [];

  if (webhookIds.length === 0) return;

  let baseUrl: string;
  let authHeaders: Record<string, string>;

  try {
    const ctx = buildJiraApiContext(connection.configJson, connection.credentialsRef);
    baseUrl = ctx.baseUrl;
    authHeaders = ctx.authHeaders;
  } catch {
    // Cannot build API context (e.g., expired/revoked token)
    // Clear webhook IDs anyway to prevent stale state
    const { webhookIds: _removed, webhookRegisteredAt: _ts, ...rest } = config;
    await prisma.integrationConnection.update({
      where: { id: connectionId },
      data: { configJson: rest as Prisma.InputJsonValue },
    });
    return;
  }

  // Delete each webhook (best effort — some may already be expired)
  for (const webhookId of webhookIds) {
    try {
      await fetch(`${baseUrl}/webhook`, {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ webhookIds: [webhookId] }),
      });
    } catch {
      // Best effort — continue with remaining webhooks
    }
  }

  // Clear webhook IDs from config
  const { webhookIds: _removed, webhookRegisteredAt: _ts, ...rest } = config;
  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: { configJson: rest as Prisma.InputJsonValue },
  });
}

/**
 * Refreshes Jira webhook registrations to extend their 30-day expiry.
 *
 * Should be called via cron every ~25 days per Pitfall 2.
 *
 * @param prisma - Prisma client instance
 * @param connectionId - The IntegrationConnection ID
 */
export async function refreshJiraWebhooks(
  prisma: PrismaClient,
  connectionId: string,
): Promise<void> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.status !== 'CONNECTED') return;

  const config = (connection.configJson as JiraConnectionConfig) ?? {};
  const webhookIds = config.webhookIds ?? [];

  if (webhookIds.length === 0) return;

  const { baseUrl, authHeaders } = buildJiraApiContext(
    connection.configJson,
    connection.credentialsRef,
  );

  const response = await fetch(`${baseUrl}/webhook/refresh`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ webhookIds }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to refresh Jira webhooks: ${text}`,
    });
  }

  // Update timestamp
  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      configJson: {
        ...config,
        webhookRegisteredAt: new Date().toISOString(),
      },
    },
  });
}
