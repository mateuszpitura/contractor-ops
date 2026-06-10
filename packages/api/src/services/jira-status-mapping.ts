import type { JiraStatusMappingEntry } from '@contractor-ops/validators';
import { jiraStatusMappingEntrySchema } from '@contractor-ops/validators';
import { z } from 'zod';
import {
  getIntegrationStatusMapping,
  saveIntegrationStatusMapping,
} from './integration-status-mapping.js';
import type { DbClient } from './types';

type PrismaClient = DbClient;

// ---------------------------------------------------------------------------
// Jira Status Mapping Service
// ---------------------------------------------------------------------------

export async function saveStatusMapping(
  prisma: PrismaClient,
  organizationId: string,
  connectionId: string,
  projectId: string,
  mappings: JiraStatusMappingEntry[],
): Promise<void> {
  return saveIntegrationStatusMapping(
    prisma,
    organizationId,
    connectionId,
    projectId,
    mappings,
  );
}

export async function getStatusMapping(
  prisma: PrismaClient,
  organizationId: string,
  connectionId: string,
  projectId: string,
): Promise<JiraStatusMappingEntry[] | null> {
  const raw = await getIntegrationStatusMapping<JiraStatusMappingEntry>(
    prisma,
    organizationId,
    connectionId,
    projectId,
  );

  if (!raw) return null;

  const parsed = z.array(jiraStatusMappingEntrySchema).safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Looks up the Jira transition ID for a given workflow status.
 *
 * Used during outbound sync (app -> Jira) to find which Jira transition
 * to execute when a WorkflowTaskRun status changes.
 */
export async function lookupJiraTransitionId(
  prisma: PrismaClient,
  organizationId: string,
  connectionId: string,
  projectId: string,
  workflowStatus: string,
): Promise<{
  transitionId: string;
  targetStatusName: string;
  targetStatusCategory: string;
} | null> {
  const mappings = await getStatusMapping(prisma, organizationId, connectionId, projectId);
  if (!mappings) return null;

  const entry = mappings.find(m => m.workflowStatus === workflowStatus);
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
 */
export async function lookupWorkflowStatus(
  prisma: PrismaClient,
  organizationId: string,
  connectionId: string,
  projectId: string,
  jiraStatusName: string,
): Promise<string | null> {
  const mappings = await getStatusMapping(prisma, organizationId, connectionId, projectId);
  if (!mappings) return null;

  const entry = mappings.find(m => m.jiraTargetStatusName === jiraStatusName);

  return entry?.workflowStatus ?? null;
}
