import type { JiraStatusMappingEntry } from "@contractor-ops/validators";
import type { DbClient } from "./types.js";

type PrismaClient = DbClient;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectionConfigJson {
  cloudId?: string;
  statusMappings?: Record<string, JiraStatusMappingEntry[]>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Jira Status Mapping Service
// ---------------------------------------------------------------------------

/**
 * Saves a status mapping for a given Jira project on a connection.
 *
 * Mappings are stored in IntegrationConnection.configJson.statusMappings[projectId].
 * This is per-project scoped (D-05) so different Jira projects can have
 * different workflow status <-> Jira transition mappings.
 *
 * @param prisma - Prisma client instance
 * @param connectionId - The IntegrationConnection ID
 * @param projectId - The Jira project ID (e.g., "10000")
 * @param mappings - Array of status mapping entries
 */
export async function saveStatusMapping(
  prisma: PrismaClient,
  connectionId: string,
  projectId: string,
  mappings: JiraStatusMappingEntry[],
): Promise<void> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
    select: { configJson: true },
  });

  const config = (connection?.configJson ?? {}) as ConnectionConfigJson;
  const statusMappings = config.statusMappings ?? {};
  statusMappings[projectId] = mappings;

  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      configJson: {
        ...config,
        statusMappings,
      },
    },
  });
}

/**
 * Retrieves the status mapping for a given Jira project on a connection.
 *
 * @param prisma - Prisma client instance
 * @param connectionId - The IntegrationConnection ID
 * @param projectId - The Jira project ID
 * @returns Array of status mapping entries, or null if none configured
 */
export async function getStatusMapping(
  prisma: PrismaClient,
  connectionId: string,
  projectId: string,
): Promise<JiraStatusMappingEntry[] | null> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
    select: { configJson: true },
  });

  const config = (connection?.configJson ?? {}) as ConnectionConfigJson;
  const mappings = config.statusMappings?.[projectId];

  return mappings ?? null;
}

/**
 * Looks up the Jira transition ID for a given workflow status.
 *
 * Used during outbound sync (app -> Jira) to find which Jira transition
 * to execute when a WorkflowTaskRun status changes.
 *
 * @param prisma - Prisma client instance
 * @param connectionId - The IntegrationConnection ID
 * @param projectId - The Jira project ID
 * @param workflowStatus - The WorkflowTaskStatus value (e.g., "IN_PROGRESS")
 * @returns The transition ID and target status info, or null if unmapped
 */
export async function lookupJiraTransitionId(
  prisma: PrismaClient,
  connectionId: string,
  projectId: string,
  workflowStatus: string,
): Promise<{
  transitionId: string;
  targetStatusName: string;
  targetStatusCategory: string;
} | null> {
  const mappings = await getStatusMapping(prisma, connectionId, projectId);
  if (!mappings) return null;

  const entry = mappings.find((m) => m.workflowStatus === workflowStatus);
  if (!entry) return null;

  return {
    transitionId: entry.jiraTransitionId,
    targetStatusName: entry.jiraTargetStatusName,
    targetStatusCategory: entry.jiraTargetStatusCategory,
  };
}

/**
 * Reverse-lookups a workflow status from a Jira status name.
 *
 * Used during inbound sync (Jira -> app) to find which WorkflowTaskStatus
 * to set when a Jira issue status changes via webhook.
 *
 * @param prisma - Prisma client instance
 * @param connectionId - The IntegrationConnection ID
 * @param projectId - The Jira project ID
 * @param jiraStatusName - The Jira target status name (e.g., "In Progress")
 * @returns The WorkflowTaskStatus value, or null if unmapped
 */
export async function lookupWorkflowStatus(
  prisma: PrismaClient,
  connectionId: string,
  projectId: string,
  jiraStatusName: string,
): Promise<string | null> {
  const mappings = await getStatusMapping(prisma, connectionId, projectId);
  if (!mappings) return null;

  const entry = mappings.find((m) => m.jiraTargetStatusName === jiraStatusName);

  return entry?.workflowStatus ?? null;
}
