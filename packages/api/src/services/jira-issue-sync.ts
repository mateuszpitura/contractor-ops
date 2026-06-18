import { fetchWithTimeout } from '@contractor-ops/integrations';
import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import type { JiraIssueMetadata, JiraTaskConfig } from '@contractor-ops/validators';
import { jiraTaskConfigSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import * as E from '../errors';
import { lookupJiraTransitionId } from './jira-status-mapping';
import type { DbClient } from './types';

type PrismaClient = DbClient;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JiraConnectionConfig {
  cloudId: string;
  siteName?: string;
  siteUrl?: string;
  [key: string]: unknown;
}

interface JiraCreateIssueResponse {
  id: string;
  key: string;
  self: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds the Jira Cloud REST API base URL and authorization headers
 * from a connection's decrypted credentials and config.
 */
function buildJiraApiContext(
  configJson: unknown,
  credentialsRef: string,
): { baseUrl: string; authHeaders: Record<string, string>; siteUrl: string } {
  const config = configJson as JiraConnectionConfig;

  if (!config?.cloudId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.JIRA_MISSING_CLOUD_ID,
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
    siteUrl: `https://api.atlassian.com/ex/jira/${config.cloudId}`,
  };
}

// ---------------------------------------------------------------------------
// Issue Creation (Outbound)
// ---------------------------------------------------------------------------

/**
 * Creates a Jira issue from a WorkflowTaskRun.
 *
 * Flow:
 * 1. Load task run + template configJson with Jira project/issue type mapping
 * 2. Decrypt credentials, build API URL
 * 3. POST to Jira issue creation endpoint with ADF description
 * 4. Update WorkflowTaskRun with externalRefType/externalRefId
 * 5. Create ExternalLink with cached metadata
 * 6. Log to IntegrationSyncLog
 *
 * @param prisma - Prisma client instance
 * @param organizationId - The organization ID
 * @param connectionId - The IntegrationConnection ID for Jira
 * @param taskRunId - The WorkflowTaskRun ID to create a Jira issue for
 * @returns The created issue key and ID
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sequential Jira issue creation: load task run → resolve config → build payload → POST → persist mapping → audit; cohesive flow.
export async function createJiraIssue(
  prisma: PrismaClient,
  organizationId: string,
  connectionId: string,
  taskRunId: string,
): Promise<{ issueKey: string; issueId: string }> {
  // 1. Load task run with template and workflow run
  const taskRun = await prisma.workflowTaskRun.findUnique({
    where: { id: taskRunId },
    include: {
      workflowRun: {
        select: { contractorId: true },
      },
    },
  });

  if (!taskRun) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: E.WORKFLOW_TASK_RUN_NOT_FOUND,
    });
  }

  // Load the task template for Jira config
  let jiraConfig: JiraTaskConfig | null = null;
  if (taskRun.workflowTaskTemplateId) {
    const template = await prisma.workflowTaskTemplate.findUnique({
      where: { id: taskRun.workflowTaskTemplateId },
      select: { configJson: true },
    });

    if (template?.configJson) {
      const parsed = jiraTaskConfigSchema.safeParse(template.configJson);
      if (parsed.success) {
        jiraConfig = parsed.data;
      }
    }
  }

  if (!(jiraConfig?.jiraEnabled && jiraConfig.jiraProjectId && jiraConfig.jiraIssueTypeId)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.JIRA_TASK_NOT_CONFIGURED,
    });
  }

  // 2. Get connection + build API context
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.status !== 'CONNECTED') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: E.JIRA_CONNECTION_NOT_ACTIVE,
    });
  }

  const { baseUrl, authHeaders } = buildJiraApiContext(
    connection.configJson,
    connection.credentialsRef,
  );

  // siteUrl is set during OAuth discovery (discoverCloudId returns { cloudId, siteName, siteUrl }).
  // Fall back to cloudId-based browsable URL if siteUrl/siteName missing.
  const config = connection.configJson as JiraConnectionConfig;
  const siteUrl =
    config.siteUrl ?? (config.siteName ? `https://${config.siteName}.atlassian.net` : null);

  // 3. Create sync log
  const syncLog = await prisma.integrationSyncLog.create({
    data: {
      organizationId,
      integrationConnectionId: connectionId,
      direction: 'OUTBOUND',
      syncType: 'issue-create',
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: taskRunId,
      status: 'STARTED',
    },
  });

  try {
    // 4. POST to Jira issue creation
    const descriptionText = taskRun.description ?? taskRun.title;
    const issueBody = {
      fields: {
        project: { id: jiraConfig.jiraProjectId },
        issuetype: { id: jiraConfig.jiraIssueTypeId },
        summary: taskRun.title,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: descriptionText }],
            },
          ],
        },
      },
    };

    const response = await fetchWithTimeout(`${baseUrl}/issue`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(issueBody),
    });

    if (response.status === 401) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: E.JIRA_TOKEN_INVALID,
      });
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jira issue creation failed (${response.status}): ${text}`);
    }

    const created = (await response.json()) as JiraCreateIssueResponse;

    // 5. Update WorkflowTaskRun with external reference
    await prisma.workflowTaskRun.update({
      where: { id: taskRunId },
      data: {
        externalRefType: 'JIRA_ISSUE',
        externalRefId: created.key,
      },
    });

    // 6. Create ExternalLink with cached metadata
    const issueUrl = siteUrl ? `${siteUrl}/browse/${created.key}` : null;
    const metadata: JiraIssueMetadata = {
      key: created.key,
      summary: taskRun.title,
      status: 'To Do',
      statusCategory: 'new',
      url: issueUrl ?? '',
      lastSyncOrigin: 'APP',
      lastSyncAt: new Date().toISOString(),
    };

    await prisma.externalLink.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        entityType: 'WORKFLOW_TASK_RUN',
        entityId: taskRunId,
        externalType: 'JIRA_ISSUE',
        externalId: created.key,
        externalUrl: issueUrl ?? '',
        metadataJson: metadata,
      },
    });

    // 7. Update sync log to success
    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: {
          issueKey: created.key,
          issueId: created.id,
          issueUrl,
        },
      },
    });

    return { issueKey: created.key, issueId: created.id };
  } catch (error) {
    // Update sync log with failure
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
      message: E.JIRA_CREATE_FAILED,
      cause: error,
    });
  }
}

// ---------------------------------------------------------------------------
// Issue Transition (Outbound)
// ---------------------------------------------------------------------------

/**
 * Transitions a linked Jira issue when a WorkflowTaskRun status changes.
 *
 * Flow:
 * 1. Find ExternalLink for the task run (JIRA_ISSUE type)
 * 2. Look up the Jira transition ID from the status mapping
 * 3. Set lastSyncOrigin="APP" to prevent webhook loop
 * 4. POST transition to Jira REST API
 * 5. Update ExternalLink metadata with new status
 * 6. Log to IntegrationSyncLog
 *
 * @param prisma - Prisma client instance
 * @param organizationId - The organization ID
 * @param connectionId - The IntegrationConnection ID for Jira
 * @param taskRunId - The WorkflowTaskRun ID
 * @param newWorkflowStatus - The new WorkflowTaskStatus value
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sequential Jira transition: resolve external link → map workflow status → find valid transition → POST → audit; cohesive flow.
export async function transitionJiraIssue(
  prisma: PrismaClient,
  organizationId: string,
  connectionId: string,
  taskRunId: string,
  newWorkflowStatus: string,
): Promise<void> {
  // 1. Find ExternalLink for this task run
  const externalLink = await prisma.externalLink.findFirst({
    where: {
      organizationId,
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: taskRunId,
      externalType: 'JIRA_ISSUE',
    },
  });

  if (!externalLink) {
    // No linked Jira issue — nothing to sync
    return;
  }

  const issueKey = externalLink.externalId;

  // 2. Get project ID from metadata or task template config
  let projectId: string | null = null;

  // Try to get from task template configJson
  const taskRun = await prisma.workflowTaskRun.findUnique({
    where: { id: taskRunId },
    select: { workflowTaskTemplateId: true },
  });

  if (taskRun?.workflowTaskTemplateId) {
    const template = await prisma.workflowTaskTemplate.findUnique({
      where: { id: taskRun.workflowTaskTemplateId },
      select: { configJson: true },
    });

    if (template?.configJson) {
      const parsed = jiraTaskConfigSchema.safeParse(template.configJson);
      if (parsed.success && parsed.data.jiraProjectId) {
        projectId = parsed.data.jiraProjectId;
      }
    }
  }

  if (!projectId) {
    // Cannot determine project for mapping lookup
    await prisma.integrationSyncLog.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        direction: 'OUTBOUND',
        syncType: 'issue-transition-unmapped',
        entityType: 'WORKFLOW_TASK_RUN',
        entityId: taskRunId,
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: `Cannot determine Jira project ID for task run ${taskRunId}`,
      },
    });
    return;
  }

  // 3. Look up the Jira transition ID for the new workflow status
  const mapping = await lookupJiraTransitionId(
    prisma,
    organizationId,
    connectionId,
    projectId,
    newWorkflowStatus,
  );

  if (!mapping) {
    // No mapping configured — log and return
    await prisma.integrationSyncLog.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        direction: 'OUTBOUND',
        syncType: 'issue-transition-unmapped',
        entityType: 'WORKFLOW_TASK_RUN',
        entityId: taskRunId,
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: {
          issueKey,
          workflowStatus: newWorkflowStatus,
          reason: 'No Jira transition mapping found for this workflow status',
        },
      },
    });
    return;
  }

  // 4. Get connection + build API context
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.status !== 'CONNECTED') {
    return;
  }

  const { baseUrl, authHeaders } = buildJiraApiContext(
    connection.configJson,
    connection.credentialsRef,
  );

  // 5. Set lastSyncOrigin="APP" BEFORE transition (loop prevention)
  const existingMetadata = (externalLink.metadataJson as Record<string, unknown>) ?? {};
  await prisma.externalLink.update({
    where: { id: externalLink.id },
    data: {
      metadataJson: {
        ...existingMetadata,
        lastSyncOrigin: 'APP',
        lastSyncAt: new Date().toISOString(),
      },
    },
  });

  // 6. Create sync log
  const syncLog = await prisma.integrationSyncLog.create({
    data: {
      organizationId,
      integrationConnectionId: connectionId,
      direction: 'OUTBOUND',
      syncType: 'issue-transition',
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: taskRunId,
      status: 'STARTED',
      requestPayloadJson: {
        issueKey,
        transitionId: mapping.transitionId,
        targetStatus: mapping.targetStatusName,
        workflowStatus: newWorkflowStatus,
      },
    },
  });

  try {
    // 7. POST transition to Jira
    const response = await fetchWithTimeout(`${baseUrl}/issue/${issueKey}/transitions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        transition: { id: mapping.transitionId },
      }),
    });

    if (response.status === 401) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: E.JIRA_TOKEN_INVALID,
      });
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jira transition failed (${response.status}): ${text}`);
    }

    // 8. Update ExternalLink metadata with new status
    await prisma.externalLink.update({
      where: { id: externalLink.id },
      data: {
        metadataJson: {
          ...existingMetadata,
          status: mapping.targetStatusName,
          statusCategory: mapping.targetStatusCategory,
          lastSyncOrigin: 'APP',
          lastSyncAt: new Date().toISOString(),
        },
      },
    });

    // 9. Update sync log to success
    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: {
          issueKey,
          transitionId: mapping.transitionId,
          newStatus: mapping.targetStatusName,
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

    await prisma.integrationConnection.update({
      where: { id: connectionId },
      data: {
        lastErrorAt: new Date(),
        lastErrorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: E.JIRA_TRANSITION_FAILED,
      cause: error,
    });
  }
}

// ---------------------------------------------------------------------------
// Scope Expansion Detection
// ---------------------------------------------------------------------------

/**
 * Detects whether a stored OAuth scope string is missing required scopes
 * for full Jira integration (issue creation + webhook management).
 *
 * Used to prompt admins to reconnect when upgrading from read-only worklog
 * import to full issue lifecycle sync.
 *
 * @param storedScope - The scope string stored in credentials
 * @returns true if the stored scope needs expansion
 */
export function detectScopeExpansionNeeded(storedScope: string): boolean {
  const requiredScopes = ['write:jira-work', 'manage:jira-webhook'];
  const currentScopes = storedScope.split(' ');

  return requiredScopes.some(scope => !currentScopes.includes(scope));
}
