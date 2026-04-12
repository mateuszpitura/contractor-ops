import type { LinearStatusMappingEntry } from '@contractor-ops/validators';
import { linearStatusMappingEntrySchema } from '@contractor-ops/validators';
import { z } from 'zod';
import type { DbClient } from './types.js';

type PrismaClient = DbClient;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectionConfigJson {
  statusMappings?: Record<string, LinearStatusMappingEntry[]>;
  stateCache?: Record<string, Record<string, { name: string; type: string }>>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Linear Status Mapping Service
// ---------------------------------------------------------------------------

/**
 * Retrieves the status mapping for a given Linear team on a connection.
 *
 * Mappings are stored in IntegrationConnection.configJson.statusMappings[teamId].
 *
 * @param prisma - Prisma client instance
 * @param connectionId - The IntegrationConnection ID
 * @param teamId - The Linear team ID
 * @returns Array of status mapping entries, or empty array if none configured
 */
export async function getStatusMapping(
  prisma: PrismaClient,
  connectionId: string,
  teamId: string,
): Promise<LinearStatusMappingEntry[]> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
    select: { configJson: true },
  });

  const config = (connection?.configJson ?? {}) as ConnectionConfigJson;
  const raw = config.statusMappings?.[teamId];

  if (!raw) return [];

  // Validate each entry to ensure schema compliance
  const parsed = z.array(linearStatusMappingEntrySchema).safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/**
 * Saves a status mapping for a given Linear team on a connection.
 *
 * Mappings are stored in IntegrationConnection.configJson.statusMappings[teamId].
 * Also builds a stateCache for fast webhook reverse-lookup.
 *
 * **CRITICAL (D-03 PENDING_MAPPING transition):** After saving the mappings,
 * if the connection's current status is PENDING_MAPPING, it transitions to
 * CONNECTED. This completes the D-03 flow:
 * OAuth sets PENDING_MAPPING -> admin saves status mapping -> connection
 * becomes CONNECTED and bidirectional sync activates.
 *
 * @param prisma - Prisma client instance
 * @param connectionId - The IntegrationConnection ID
 * @param teamId - The Linear team ID
 * @param mappings - Array of status mapping entries
 */
export async function saveStatusMapping(
  prisma: PrismaClient,
  connectionId: string,
  teamId: string,
  mappings: LinearStatusMappingEntry[],
): Promise<void> {
  const connection = await prisma.integrationConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  const existingConfig = (connection.configJson as ConnectionConfigJson) ?? {};

  // Merge status mappings, preserving other teams
  const updatedStatusMappings = {
    ...(existingConfig.statusMappings ?? {}),
    [teamId]: mappings,
  };

  // Build state cache for webhook reverse-lookup (stateId -> { name, type })
  const existingStateCache = existingConfig.stateCache ?? {};
  const teamStateCache: Record<string, { name: string; type: string }> = {};
  for (const mapping of mappings) {
    teamStateCache[mapping.linearStateId] = {
      name: mapping.linearStateName,
      type: mapping.linearStateType,
    };
  }

  const updatedConfig = {
    ...existingConfig,
    statusMappings: updatedStatusMappings,
    stateCache: {
      ...existingStateCache,
      [teamId]: teamStateCache,
    },
  };

  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      configJson: updatedConfig,
      // Transition PENDING_MAPPING -> CONNECTED on first mapping save (D-03)
      ...(connection.status === 'PENDING_MAPPING' ? { status: 'CONNECTED' } : {}),
    },
  });
}

/**
 * Resolves a Linear stateId from an internal workflow status.
 *
 * Used during outbound sync (app -> Linear) to find which Linear state
 * to set when a WorkflowTaskRun status changes.
 *
 * @param prisma - Prisma client instance
 * @param connectionId - The IntegrationConnection ID
 * @param teamId - The Linear team ID
 * @param workflowStatus - The WorkflowTaskStatus value (e.g., "IN_PROGRESS")
 * @returns The Linear stateId, or null if unmapped
 */
export async function resolveLinearStateId(
  prisma: PrismaClient,
  connectionId: string,
  teamId: string,
  workflowStatus: string,
): Promise<string | null> {
  const mappings = await getStatusMapping(prisma, connectionId, teamId);
  const entry = mappings.find(m => m.workflowStatus === workflowStatus);
  return entry?.linearStateId ?? null;
}

/**
 * Reverse-lookups an internal workflow status from a Linear stateId.
 *
 * Used during inbound sync (Linear -> app) to find which WorkflowTaskStatus
 * to set when a Linear issue state changes via webhook.
 *
 * If the stateId is not mapped, logs the unmapped state per D-04.
 *
 * @param prisma - Prisma client instance
 * @param connectionId - The IntegrationConnection ID
 * @param teamId - The Linear team ID
 * @param linearStateId - The Linear workflow state ID
 * @returns The WorkflowTaskStatus value, or null if unmapped
 */
export async function resolveInternalStatus(
  prisma: PrismaClient,
  connectionId: string,
  teamId: string,
  linearStateId: string,
): Promise<string | null> {
  const mappings = await getStatusMapping(prisma, connectionId, teamId);
  const entry = mappings.find(m => m.linearStateId === linearStateId);

  if (entry) {
    return entry.workflowStatus;
  }

  // Check stateCache for the state name and log as unmapped (D-04)
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
    select: { configJson: true },
  });

  const config = (connection?.configJson ?? {}) as ConnectionConfigJson;
  const cachedState = config.stateCache?.[teamId]?.[linearStateId];

  if (cachedState) {
    console.warn(
      `[Linear] Unmapped state received: ${cachedState.name} (${cachedState.type}) for team ${teamId}, stateId=${linearStateId}`,
    );
  } else {
    console.warn(
      `[Linear] Unknown unmapped stateId=${linearStateId} for team ${teamId} (not in stateCache)`,
    );
  }

  return null;
}
