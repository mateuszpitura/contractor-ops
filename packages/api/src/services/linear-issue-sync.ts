import { createHash } from 'node:crypto';
import type { Prisma } from '@contractor-ops/db';
import { fetchWithTimeout } from '@contractor-ops/integrations';
import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import { createLogger } from '@contractor-ops/logger';
import type { LinearIssueMetadata } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { resolveLinearStateId } from './linear-status-mapping';
import type { DbClient } from './types';

const log = createLogger({ service: 'linear-issue-sync' });

/**
 * F-OBS-17 — turn an email address into a non-PII identifier suitable for
 * structured logs. We keep the domain (operationally useful — "is the
 * problem isolated to one company?") and a short stable SHA-256 of the
 * local-part so the same address renders the same hash across log lines
 * without exposing the raw PII to Axiom retention.
 */
function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf('@');
  if (at <= 0) {
    return `[REDACTED]@${createHash('sha256').update(trimmed).digest('hex').slice(0, 8)}`;
  }
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const hash = createHash('sha256').update(local).digest('hex').slice(0, 8);
  return `${local.slice(0, 1)}*${hash}@${domain}`;
}

type PrismaClient = DbClient;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Time window (ms) to suppress bounce-back from our own changes */
const LOOP_PREVENTION_WINDOW_MS = 30_000;

/** Time window (ms) for deduplication of rapid-fire events */
const _DEDUP_WINDOW_MS = 5_000;

/** Linear GraphQL API endpoint */
const LINEAR_API_URL = 'https://api.linear.app/graphql';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateLinearIssueParams {
  organizationId: string;
  connectionId: string;
  taskRunId: string;
  title: string;
  description: string;
  assigneeEmail?: string;
  teamId: string;
  teamKey: string;
}

// ---------------------------------------------------------------------------
// Linear GraphQL Helper
// ---------------------------------------------------------------------------

/**
 * Executes a GraphQL query or mutation against the Linear API.
 *
 * @param accessToken - The decrypted Linear OAuth access token
 * @param query - The GraphQL query or mutation string
 * @param variables - Optional variables for the query
 * @returns The parsed response data
 * @throws TRPCError on API errors
 */
export async function linearGraphQL<T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetchWithTimeout(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();

    if (response.status === 401) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message:
          'Linear access token is invalid or expired. Please reconnect your Linear integration.',
      });
    }

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Linear API error (${response.status}): ${text}`,
    });
  }

  const result = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (result.errors && result.errors.length > 0) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Linear GraphQL error: ${result.errors.map(e => e.message).join(', ')}`,
    });
  }

  if (!result.data) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Linear GraphQL returned no data',
    });
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// Issue Creation (Outbound)
// ---------------------------------------------------------------------------

/**
 * Creates a Linear issue from a WorkflowTaskRun.
 *
 * Flow:
 * 1. Load connection and decrypt credentials
 * 2. Look up assignee by email (D-07: fall back to unassigned if no match)
 * 3. Run issueCreate mutation with title, description, assigneeId
 * 4. Create ExternalLink with LINEAR_ISSUE type and cached metadata
 * 5. Log to IntegrationSyncLog
 *
 * @param prisma - Prisma client instance
 * @param params - Issue creation parameters
 * @returns The created ExternalLink record
 */
export async function createLinearIssue(
  prisma: PrismaClient,
  params: CreateLinearIssueParams,
): Promise<{ identifier: string; linearIssueId: string }> {
  const { organizationId, connectionId, taskRunId, title, description, assigneeEmail, teamId } =
    params;

  // 1. Get connection + decrypt credentials
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.status !== 'CONNECTED') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Linear connection is not active',
    });
  }

  const credentials = decryptCredentials(connection.credentialsRef, 'linear');
  const accessToken = credentials.accessToken;

  // 2. Create sync log
  const syncLog = await prisma.integrationSyncLog.create({
    data: {
      organizationId,
      integrationConnectionId: connectionId,
      direction: 'OUTBOUND',
      syncType: 'ISSUE_CREATE',
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: taskRunId,
      status: 'STARTED',
    },
  });

  try {
    // 3. Look up assignee by email (D-07: fall back to unassigned)
    let assigneeId: string | undefined;

    if (assigneeEmail) {
      try {
        const usersResult = await linearGraphQL<{
          users: { nodes: Array<{ id: string; name: string; email: string }> };
        }>(
          accessToken,
          `query LookupUserByEmail($email: String!) {
            users(filter: { email: { eq: $email } }) {
              nodes { id name email }
            }
          }`,
          { email: assigneeEmail },
        );

        const matchedUser = usersResult.users.nodes[0];
        if (matchedUser) {
          assigneeId = matchedUser.id;
        } else {
          // F-OBS-17 — log only a masked email so PII does not land in Axiom.
          log.warn(
            { assigneeEmailMasked: maskEmail(assigneeEmail) },
            'no user found for email, creating issue unassigned (D-07)',
          );
        }
      } catch (lookupError) {
        log.warn({ err: lookupError }, 'user lookup by email failed, creating issue unassigned');
      }
    }

    // 4. Create issue via issueCreate mutation (D-06: title + description only)
    const createResult = await linearGraphQL<{
      issueCreate: {
        success: boolean;
        issue: {
          id: string;
          number: number;
          identifier: string;
          title: string;
          url: string;
          state: {
            id: string;
            name: string;
            type: string;
          };
        };
      };
    }>(
      accessToken,
      `mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            number
            identifier
            title
            url
            state { id name type }
          }
        }
      }`,
      {
        input: {
          teamId,
          title,
          description,
          ...(assigneeId ? { assigneeId } : {}),
        },
      },
    );

    if (!createResult.issueCreate.success) {
      throw new Error('Linear issueCreate returned success=false');
    }

    const issue = createResult.issueCreate.issue;

    // 5. Create ExternalLink with cached metadata
    const metadata: LinearIssueMetadata = {
      identifier: issue.identifier,
      linearIssueId: issue.id,
      title: issue.title,
      status: issue.state.name,
      statusType: issue.state.type as LinearIssueMetadata['statusType'],
      url: issue.url,
      lastSyncOrigin: 'APP',
      lastSyncAt: new Date().toISOString(),
    };

    await prisma.externalLink.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        entityType: 'WORKFLOW_TASK_RUN',
        entityId: taskRunId,
        externalType: 'LINEAR_ISSUE',
        externalId: issue.identifier,
        externalUrl: issue.url,
        metadataJson: metadata,
      },
    });

    // 6. Update sync log to success
    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: {
          identifier: issue.identifier,
          linearIssueId: issue.id,
          url: issue.url,
        },
      },
    });

    return { identifier: issue.identifier, linearIssueId: issue.id };
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
      message: 'Failed to create Linear issue',
      cause: error,
    });
  }
}

// ---------------------------------------------------------------------------
// Outbound Status Sync
// ---------------------------------------------------------------------------

/**
 * Syncs a workflow task status change to the linked Linear issue.
 *
 * Flow:
 * 1. Find ExternalLink for the task run (LINEAR_ISSUE type)
 * 2. Check loop prevention (skip if origin is LINEAR within 30s)
 * 3. Resolve target stateId from status mapping
 * 4. Call issueUpdate mutation with new stateId
 * 5. Update ExternalLink metadata
 * 6. Log to IntegrationSyncLog
 *
 * @param prisma - Prisma client instance
 * @param taskRunId - The WorkflowTaskRun ID
 * @param newStatus - The new workflow task status
 */
export async function syncTaskStatusToLinear(
  prisma: PrismaClient,
  taskRunId: string,
  newStatus: string,
): Promise<void> {
  // 1. Find ExternalLink for this task run
  const externalLink = await prisma.externalLink.findFirst({
    where: {
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: taskRunId,
      externalType: 'LINEAR_ISSUE',
    },
  });

  if (!externalLink) {
    // No linked Linear issue -- nothing to sync
    return;
  }

  // 2. Parse metadata and check loop prevention
  const metadata = (externalLink.metadataJson as Record<string, unknown>) ?? {};
  const lastSyncOrigin = metadata.lastSyncOrigin as string | undefined;
  const lastSyncAt = metadata.lastSyncAt as string | undefined;

  if (lastSyncOrigin === 'LINEAR' && lastSyncAt) {
    const syncAge = Date.now() - new Date(lastSyncAt).getTime();
    if (syncAge < LOOP_PREVENTION_WINDOW_MS) {
      log.info({ taskRunId, syncAge }, 'suppressing outbound sync (origin=LINEAR)');
      return;
    }
  }

  // 3. Get connection
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: externalLink.integrationConnectionId },
  });

  if (!connection || connection.status !== 'CONNECTED') {
    return;
  }

  // 4. Determine teamId from metadata or connection config
  const linearIssueId = metadata.linearIssueId as string;
  if (!linearIssueId) {
    log.warn({ externalLinkId: externalLink.id }, 'externalLink missing linearIssueId in metadata');
    return;
  }

  // Find teamId: check task template configJson for linearTeamId
  const taskRun = await prisma.workflowTaskRun.findUnique({
    where: { id: taskRunId },
    select: { workflowTaskTemplateId: true },
  });

  let teamId: string | null = null;
  if (taskRun?.workflowTaskTemplateId) {
    const template = await prisma.workflowTaskTemplate.findUnique({
      where: { id: taskRun.workflowTaskTemplateId },
      select: { configJson: true },
    });
    if (template?.configJson) {
      const config = template.configJson as Record<string, unknown>;
      teamId = (config.linearTeamId as string) ?? null;
    }
  }

  if (!teamId) {
    log.warn({ taskRunId }, 'cannot determine teamId for task, skipping outbound sync');
    return;
  }

  // 5. Resolve target stateId from status mapping
  const targetStateId = await resolveLinearStateId(prisma, connection.id, teamId, newStatus);

  if (!targetStateId) {
    // No mapping for this workflow status -- log and return
    await prisma.integrationSyncLog.create({
      data: {
        organizationId: connection.organizationId,
        integrationConnectionId: connection.id,
        direction: 'OUTBOUND',
        syncType: 'STATUS_UPDATE_UNMAPPED',
        entityType: 'WORKFLOW_TASK_RUN',
        entityId: taskRunId,
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: {
          identifier: metadata.identifier,
          workflowStatus: newStatus,
          reason: 'No Linear state mapping found for this workflow status',
        } as Prisma.InputJsonValue,
      },
    });
    return;
  }

  // 6. Decrypt credentials and call issueUpdate
  const credentials = decryptCredentials(connection.credentialsRef, 'linear');

  const syncLog = await prisma.integrationSyncLog.create({
    data: {
      organizationId: connection.organizationId,
      integrationConnectionId: connection.id,
      direction: 'OUTBOUND',
      syncType: 'STATUS_UPDATE',
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: taskRunId,
      status: 'STARTED',
      requestPayloadJson: {
        linearIssueId,
        targetStateId,
        workflowStatus: newStatus,
      },
    },
  });

  try {
    const updateResult = await linearGraphQL<{
      issueUpdate: {
        success: boolean;
        issue: {
          state: { id: string; name: string; type: string };
        };
      };
    }>(
      credentials.accessToken,
      `mutation UpdateIssueState($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            state { id name type }
          }
        }
      }`,
      {
        id: linearIssueId,
        input: { stateId: targetStateId },
      },
    );

    if (!updateResult.issueUpdate.success) {
      throw new Error('Linear issueUpdate returned success=false');
    }

    const newState = updateResult.issueUpdate.issue.state;

    // 7. Update ExternalLink metadata
    await prisma.externalLink.update({
      where: { id: externalLink.id },
      data: {
        metadataJson: {
          ...metadata,
          status: newState.name,
          statusType: newState.type,
          lastSyncOrigin: 'APP',
          lastSyncAt: new Date().toISOString(),
        },
      },
    });

    // 8. Update sync log to success
    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: {
          linearIssueId,
          newState: newState.name,
          newStateType: newState.type,
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
      where: { id: connection.id },
      data: {
        lastErrorAt: new Date(),
        lastErrorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to sync task status to Linear',
      cause: error,
    });
  }
}

// ---------------------------------------------------------------------------
// Scope Expansion Detection
// ---------------------------------------------------------------------------

/**
 * Checks if a Linear connection's stored scopes include required scopes.
 *
 * @param storedScope - The scope string stored in credentials
 * @returns true if scope expansion is needed
 */
export function detectScopeExpansionNeeded(storedScope: string): boolean {
  const requiredScopes = ['read', 'write'];
  const currentScopes = storedScope.split(',').map(s => s.trim());
  return requiredScopes.some(scope => !currentScopes.includes(scope));
}
