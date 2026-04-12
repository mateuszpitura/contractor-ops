import type { ClockifyRegion } from "@contractor-ops/integrations/adapters/clockify-adapter";
import { CLOCKIFY_REGIONS } from "@contractor-ops/integrations/adapters/clockify-adapter";
import { decryptCredentials } from "@contractor-ops/integrations/services/credential-service";
import { TRPCError } from "@trpc/server";
import type { DbClient } from "./types.js";

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
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
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
  // 1. Get connection + decrypt credentials
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Clockify connection not found",
    });
  }

  if (connection.status !== "CONNECTED") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Clockify connection is not active (status: ${connection.status})`,
    });
  }

  const credentials = decryptCredentials(connection.credentialsRef, "clockify");
  const config = connection.configJson as unknown as ClockifyConnectionConfig;

  if (!config?.workspaceId || !config?.userId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Clockify connection is missing workspaceId or userId in config",
    });
  }

  // 2. Build base URL from region
  const region = config.region || "global";
  const baseUrl = CLOCKIFY_REGIONS[region] ?? CLOCKIFY_REGIONS.global;

  // 3. Create sync log
  const syncLog = await prisma.integrationSyncLog.create({
    data: {
      organizationId,
      integrationConnectionId: connectionId,
      direction: "INBOUND",
      syncType: "time_entries",
      status: "STARTED",
    },
  });

  let imported = 0;
  let skipped = 0;

  try {
    // 4. Paginate through Clockify time entries
    const allEntries: ClockifyTimeEntry[] = [];
    let page = 1;
    const pageSize = 100;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const url = new URL(
        `${baseUrl}/workspaces/${config.workspaceId}/user/${config.userId}/time-entries`,
      );
      url.searchParams.set("start", `${startDate}T00:00:00Z`);
      url.searchParams.set("end", `${endDate}T23:59:59Z`);
      url.searchParams.set("page", String(page));
      url.searchParams.set("page-size", String(pageSize));

      const response = await fetch(url.toString(), {
        headers: {
          "X-Api-Key": credentials.accessToken,
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Clockify API key is invalid or expired. Please reconnect your Clockify integration.",
        });
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Clockify API rate limit exceeded. Retry after ${retryAfter ?? "60"} seconds.`,
        });
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Clockify API error (${response.status}): ${text}`);
      }

      const entries = (await response.json()) as ClockifyTimeEntry[];
      allEntries.push(...entries);

      // Check if this is the last page
      if (entries.length < pageSize) break;
      page++;
    }

    // 5. Upsert entries into TimeEntry table
    for (const entry of allEntries) {
      const minutes = parseDurationToMinutes(entry.timeInterval.duration);
      const entryDate = entry.timeInterval.start.split("T")[0]!; // Date portion

      // Skip entries with zero duration
      if (minutes === 0) {
        skipped++;
        continue;
      }

      const existingEntry = await prisma.timeEntry.findFirst({
        where: {
          organizationId,
          contractorId,
          source: "CLOCKIFY",
          externalId: entry.id,
        },
        select: { id: true },
      });

      if (existingEntry) {
        // Update existing entry (hours may have changed in Clockify)
        await prisma.timeEntry.update({
          where: { id: existingEntry.id },
          data: {
            minutes,
            description: entry.description || null,
            metadataJson: {
              clockifyProjectId: entry.projectId,
              clockifyProjectName: entry.project?.name ?? null,
              clockifyDescription: entry.description,
            },
          },
        });
        skipped++;
      } else {
        // Create new entry
        await prisma.timeEntry.create({
          data: {
            organizationId,
            timesheetId,
            contractorId,
            contractId,
            entryDate: new Date(entryDate),
            minutes,
            description: entry.description || null,
            source: "CLOCKIFY",
            externalId: entry.id,
            metadataJson: {
              clockifyProjectId: entry.projectId,
              clockifyProjectName: entry.project?.name ?? null,
              clockifyDescription: entry.description,
            },
          },
        });
        imported++;
      }
    }

    // 6. Recalculate timesheet totalMinutes
    const totalResult = await prisma.timeEntry.aggregate({
      where: { timesheetId },
      _sum: { minutes: true },
    });

    await prisma.timesheet.update({
      where: { id: timesheetId },
      data: { totalMinutes: totalResult._sum.minutes ?? 0 },
    });

    // 7. Update connection and sync log
    await prisma.integrationConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSuccessAt: new Date(),
      },
    });

    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "SUCCESS",
        completedAt: new Date(),
        responsePayloadJson: {
          totalFetched: allEntries.length,
          imported,
          skipped,
        },
      },
    });
  } catch (error) {
    // Update sync log with failure
    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });

    await prisma.integrationConnection.update({
      where: { id: connectionId },
      data: {
        lastErrorAt: new Date(),
        lastErrorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });

    // Re-throw TRPCErrors as-is, wrap others
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to sync Clockify time entries",
      cause: error,
    });
  }

  return { imported, skipped };
}
