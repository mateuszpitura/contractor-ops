import type { Prisma } from '@contractor-ops/db';
import { fetchWithTimeout } from '@contractor-ops/integrations';
import type { ClockifyRegion } from '@contractor-ops/integrations/adapters/clockify-adapter';
import { CLOCKIFY_REGIONS } from '@contractor-ops/integrations/adapters/clockify-adapter';
import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import { TRPCError } from '@trpc/server';
import {
  CLOCKIFY_CONFIG_INCOMPLETE,
  CLOCKIFY_CONNECTION_NOT_FOUND,
  CLOCKIFY_SYNC_FAILED,
} from '../errors';
import type { DbClient } from './types';

type PrismaClient = DbClient;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClockifyTimeEntry {
  id: string;
  description: string;
  timeInterval: {
    start: string; // ISO 8601
    end: string; // ISO 8601
    duration: string; // PT format e.g. "PT1H30M"
  };
  projectId: string | null;
  project?: { name: string } | null;
}

interface ClockifyConnectionConfig {
  workspaceId: string;
  userId: string;
  region: ClockifyRegion;
}

// ---------------------------------------------------------------------------
// Duration Parsing
// ---------------------------------------------------------------------------

/**
 * Parses an ISO 8601 duration string (PT format) into total minutes.
 * Handles hours, minutes, and seconds (seconds >= 30 round up to +1 minute).
 *
 * @example
 * parseDurationToMinutes("PT1H30M") // 90
 * parseDurationToMinutes("PT2H")     // 120
 * parseDurationToMinutes("PT45M30S") // 46
 * parseDurationToMinutes("PT0S")     // 0
 */
export function parseDurationToMinutes(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 60 + minutes + (seconds >= 30 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Clockify Sync Service
// ---------------------------------------------------------------------------

/**
 * Fetches time entries from Clockify for a given connection and date range,
 * then upserts them as TimeEntry records with source=CLOCKIFY.
 *
 * On-demand sync per D-09 — called when contractor or manager clicks
 * "Sync from Clockify" in the portal/admin UI.
 *
 * Deduplication: Uses @@unique(organizationId, contractorId, source, externalId)
 * to prevent duplicate imports on repeated syncs (Pitfall 5).
 *
 * @param prisma - Prisma client instance
 * @param organizationId - The organization ID
 * @param contractorId - The contractor importing entries
 * @param contractId - The contract to associate entries with (caller resolves)
 * @param timesheetId - The target timesheet for imported entries
 * @param connectionId - The IntegrationConnection ID for Clockify
 * @param startDate - Start of date range (YYYY-MM-DD)
 * @param endDate - End of date range (YYYY-MM-DD)
 * @returns Count of imported and skipped entries
 */
export async function syncClockifyEntries(
  prisma: PrismaClient,
  organizationId: string,
  contractorId: string,
  contractId: string,
  timesheetId: string,
  connectionId: string,
  startDate: string,
  endDate: string,
): Promise<{ imported: number; skipped: number }> {
  const { credentials, config, baseUrl } = await loadClockifyConnection(prisma, connectionId);

  const syncLog = await prisma.integrationSyncLog.create({
    data: {
      organizationId,
      integrationConnectionId: connectionId,
      direction: 'INBOUND',
      syncType: 'time_entries',
      status: 'STARTED',
    },
  });

  let imported = 0;
  let skipped = 0;

  try {
    const allEntries = await fetchAllClockifyEntries(
      baseUrl,
      config,
      credentials.accessToken,
      startDate,
      endDate,
    );

    for (const entry of allEntries) {
      const result = await upsertTimeEntry(prisma, entry, {
        organizationId,
        contractorId,
        contractId,
        timesheetId,
      });
      if (result === 'imported') imported++;
      else skipped++;
    }

    await recalculateTimesheetTotal(prisma, timesheetId);
    await markSyncSuccess(prisma, connectionId, syncLog.id, {
      totalFetched: allEntries.length,
      imported,
      skipped,
    });
  } catch (error) {
    await markSyncFailure(prisma, connectionId, syncLog.id, error);

    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: CLOCKIFY_SYNC_FAILED,
      cause: error,
    });
  }

  return { imported, skipped };
}

// ---------------------------------------------------------------------------
// Connection validation
// ---------------------------------------------------------------------------

async function loadClockifyConnection(prisma: PrismaClient, connectionId: string) {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new TRPCError({ code: 'NOT_FOUND', message: CLOCKIFY_CONNECTION_NOT_FOUND });
  }

  if (connection.status !== 'CONNECTED') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: CLOCKIFY_CONNECTION_NOT_FOUND,
    });
  }

  const credentials = decryptCredentials(connection.credentialsRef, 'clockify');
  const config = connection.configJson as unknown as ClockifyConnectionConfig;

  if (!(config?.workspaceId && config?.userId)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: CLOCKIFY_CONFIG_INCOMPLETE,
    });
  }

  const region = config.region || 'global';
  const baseUrl = CLOCKIFY_REGIONS[region] ?? CLOCKIFY_REGIONS.global;

  return { credentials, config, baseUrl };
}

// ---------------------------------------------------------------------------
// API pagination
// ---------------------------------------------------------------------------

async function fetchAllClockifyEntries(
  baseUrl: string,
  config: ClockifyConnectionConfig,
  apiKey: string,
  startDate: string,
  endDate: string,
): Promise<ClockifyTimeEntry[]> {
  const allEntries: ClockifyTimeEntry[] = [];
  let page = 1;
  const pageSize = 100;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const url = new URL(
      `${baseUrl}/workspaces/${config.workspaceId}/user/${config.userId}/time-entries`,
    );
    url.searchParams.set('start', `${startDate}T00:00:00Z`);
    url.searchParams.set('end', `${endDate}T23:59:59Z`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('page-size', String(pageSize));

    const response = await fetchWithTimeout(url.toString(), {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
    });

    if (response.status === 401) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message:
          'Clockify API key is invalid or expired. Please reconnect your Clockify integration.',
      });
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Clockify API rate limit exceeded. Retry after ${retryAfter ?? '60'} seconds.`,
      });
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Clockify API error (${response.status}): ${text}`);
    }

    const entries = (await response.json()) as ClockifyTimeEntry[];
    allEntries.push(...entries);

    if (entries.length < pageSize) break;
    page++;
  }

  return allEntries;
}

// ---------------------------------------------------------------------------
// Entry upsert
// ---------------------------------------------------------------------------

async function upsertTimeEntry(
  prisma: PrismaClient,
  entry: ClockifyTimeEntry,
  ctx: {
    organizationId: string;
    contractorId: string;
    contractId: string;
    timesheetId: string;
  },
): Promise<'imported' | 'skipped'> {
  const minutes = parseDurationToMinutes(entry.timeInterval.duration);
  const entryDate = entry.timeInterval.start.split('T')[0] ?? '';

  if (minutes === 0) return 'skipped';

  const metadataJson = {
    clockifyProjectId: entry.projectId,
    clockifyProjectName: entry.project?.name ?? null,
    clockifyDescription: entry.description,
  };

  const existingEntry = await prisma.timeEntry.findFirst({
    where: {
      organizationId: ctx.organizationId,
      contractorId: ctx.contractorId,
      source: 'CLOCKIFY',
      externalId: entry.id,
    },
    select: { id: true },
  });

  if (existingEntry) {
    await prisma.timeEntry.update({
      where: { id: existingEntry.id },
      data: { minutes, description: entry.description || null, metadataJson },
    });
    return 'skipped';
  }

  await prisma.timeEntry.create({
    data: {
      organizationId: ctx.organizationId,
      timesheetId: ctx.timesheetId,
      contractorId: ctx.contractorId,
      contractId: ctx.contractId,
      entryDate: new Date(entryDate),
      minutes,
      description: entry.description || null,
      source: 'CLOCKIFY',
      externalId: entry.id,
      metadataJson,
    },
  });
  return 'imported';
}

// ---------------------------------------------------------------------------
// Sync status helpers
// ---------------------------------------------------------------------------

async function recalculateTimesheetTotal(prisma: PrismaClient, timesheetId: string): Promise<void> {
  const totalResult = await prisma.timeEntry.aggregate({
    where: { timesheetId },
    _sum: { minutes: true },
  });

  await prisma.timesheet.update({
    where: { id: timesheetId },
    data: { totalMinutes: totalResult._sum.minutes ?? 0 },
  });
}

async function markSyncSuccess(
  prisma: PrismaClient,
  connectionId: string,
  syncLogId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: { lastSyncAt: new Date(), lastSuccessAt: new Date() },
  });

  await prisma.integrationSyncLog.update({
    where: { id: syncLogId },
    data: {
      status: 'SUCCESS',
      completedAt: new Date(),
      responsePayloadJson: payload as Prisma.InputJsonValue,
    },
  });
}

async function markSyncFailure(
  prisma: PrismaClient,
  connectionId: string,
  syncLogId: string,
  error: unknown,
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  await prisma.integrationSyncLog.update({
    where: { id: syncLogId },
    data: { status: 'FAILED', completedAt: new Date(), errorMessage },
  });

  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: { lastErrorAt: new Date(), lastErrorMessage: errorMessage },
  });
}
