import type { Prisma } from '@contractor-ops/db';
import { fetchWithTimeout } from '@contractor-ops/integrations';
import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import * as E from '../errors';
import type { DbClient } from './types';

const log = createLogger({ service: 'jira-worklog-sync' });

type PrismaClient = DbClient;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
  };
}

interface JiraSearchResponse {
  issues: JiraIssue[];
  startAt: number;
  maxResults: number;
  total: number;
}

interface JiraWorklog {
  id: string;
  author: {
    accountId: string;
    displayName: string;
  };
  started: string; // ISO 8601
  timeSpentSeconds: number;
  comment?: {
    type: string;
    content?: Array<{
      type: string;
      content?: Array<{
        type: string;
        text?: string;
      }>;
    }>;
  };
}

interface JiraWorklogResponse {
  worklogs: JiraWorklog[];
  startAt: number;
  maxResults: number;
  total: number;
}

interface JiraConnectionConfig {
  cloudId: string;
  accountId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts plain text from Jira's Atlassian Document Format (ADF) comment.
 * ADF uses a nested content structure; we extract all text nodes.
 */
function extractCommentText(comment: JiraWorklog['comment']): string | null {
  if (!comment?.content) return null;

  const texts: string[] = [];
  for (const block of comment.content) {
    if (block.content) {
      for (const inline of block.content) {
        if (inline.text) {
          texts.push(inline.text);
        }
      }
    }
  }

  return texts.length > 0 ? texts.join(' ') : null;
}

// ---------------------------------------------------------------------------
// Worklog fetch + upsert helpers
// ---------------------------------------------------------------------------

/**
 * Fetches all worklogs for a given issue, filtered by author and date range.
 * Handles pagination internally.
 */
async function fetchIssueWorklogs(
  baseUrl: string,
  authHeaders: Record<string, string>,
  issueKey: string,
  accountId: string,
  startDateObj: Date,
  endDateObj: Date,
): Promise<JiraWorklog[]> {
  const filtered: JiraWorklog[] = [];
  let worklogStartAt = 0;
  const worklogMaxResults = 1000;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const worklogUrl = new URL(`${baseUrl}/issue/${issueKey}/worklog`);
    worklogUrl.searchParams.set('startAt', String(worklogStartAt));
    worklogUrl.searchParams.set('maxResults', String(worklogMaxResults));

    const worklogResponse = await fetchWithTimeout(worklogUrl.toString(), {
      headers: authHeaders,
    });

    if (!worklogResponse.ok) {
      log.error({ issueKey, status: worklogResponse.status }, 'failed to fetch worklogs for issue');
      break;
    }

    const worklogData = (await worklogResponse.json()) as JiraWorklogResponse;

    for (const wl of worklogData.worklogs) {
      if (wl.author.accountId !== accountId) continue;
      const worklogDate = new Date(wl.started);
      if (worklogDate >= startDateObj && worklogDate <= endDateObj) {
        filtered.push(wl);
      }
    }

    if (worklogStartAt + worklogData.worklogs.length >= worklogData.total) break;
    worklogStartAt += worklogMaxResults;
  }

  return filtered;
}

/**
 * Builds the metadataJson object for a Jira worklog time entry.
 */
function buildWorklogMetadata(issue: JiraIssue, worklog: JiraWorklog): Record<string, unknown> {
  return {
    issueKey: issue.key,
    issueSummary: issue.fields.summary,
    worklogId: worklog.id,
    authorDisplayName: worklog.author.displayName,
    timeSpentSeconds: worklog.timeSpentSeconds,
  };
}

/**
 * Upserts a single Jira worklog as a TimeEntry. Returns 'imported' for new
 * entries, 'skipped' for zero-duration or updated entries.
 */
async function upsertWorklogEntry(
  prisma: PrismaClient,
  params: {
    organizationId: string;
    contractorId: string;
    contractId: string;
    timesheetId: string;
    issue: JiraIssue;
    worklog: JiraWorklog;
  },
): Promise<'imported' | 'skipped'> {
  const { organizationId, contractorId, contractId, timesheetId, issue, worklog } = params;
  const minutes = Math.round(worklog.timeSpentSeconds / 60);
  if (minutes === 0) return 'skipped';

  const entryDate = worklog.started.split('T')[0] ?? '';
  const commentText = extractCommentText(worklog.comment);
  const description = commentText ?? `${issue.key}: ${issue.fields.summary}`;
  const metadataJson = buildWorklogMetadata(issue, worklog);

  const existingEntry = await prisma.timeEntry.findFirst({
    where: { organizationId, contractorId, source: 'JIRA', externalId: String(worklog.id) },
    select: { id: true },
  });

  if (existingEntry) {
    await prisma.timeEntry.update({
      where: { id: existingEntry.id },
      data: { minutes, description, metadataJson: metadataJson as Prisma.InputJsonValue },
    });
    return 'skipped';
  }

  await prisma.timeEntry.create({
    data: {
      organizationId,
      timesheetId,
      contractorId,
      contractId,
      entryDate: new Date(entryDate),
      minutes,
      description,
      source: 'JIRA',
      externalId: String(worklog.id),
      metadataJson: metadataJson as Prisma.InputJsonValue,
    },
  });
  return 'imported';
}

// ---------------------------------------------------------------------------
// Jira Worklog Sync Service
// ---------------------------------------------------------------------------

/**
 * Fetches worklogs from Jira Cloud for a given connection and date range,
 * then upserts them as TimeEntry records with source=JIRA.
 *
 * Two-step fetch:
 * 1. JQL search for issues with user's worklogs in the date range
 * 2. Per-issue worklog fetch, filtered by author accountId
 *
 * Deduplication: Uses @@unique(organizationId, contractorId, source, externalId)
 * with externalId = worklog.id to prevent duplicate imports.
 *
 * @param prisma - Prisma client instance
 * @param organizationId - The organization ID
 * @param contractorId - The contractor importing worklogs
 * @param contractId - The contract to associate entries with (caller resolves)
 * @param timesheetId - The target timesheet for imported entries
 * @param connectionId - The IntegrationConnection ID for Jira
 * @param startDate - Start of date range (YYYY-MM-DD)
 * @param endDate - End of date range (YYYY-MM-DD)
 * @returns Count of imported and skipped entries
 */
/** Per-issue worklog fetch + upsert across the date range; tallies imported vs skipped. */
async function importWorklogEntries(
  prisma: PrismaClient,
  args: {
    baseUrl: string;
    authHeaders: Record<string, string>;
    accountId: string;
    issues: JiraIssue[];
    startDate: string;
    endDate: string;
    organizationId: string;
    contractorId: string;
    contractId: string;
    timesheetId: string;
  },
): Promise<{ imported: number; skipped: number }> {
  const startDateObj = new Date(`${args.startDate}T00:00:00Z`);
  const endDateObj = new Date(`${args.endDate}T23:59:59Z`);

  let imported = 0;
  let skipped = 0;

  for (const issue of args.issues) {
    const worklogs = await fetchIssueWorklogs(
      args.baseUrl,
      args.authHeaders,
      issue.key,
      args.accountId,
      startDateObj,
      endDateObj,
    );

    for (const worklog of worklogs) {
      const result = await upsertWorklogEntry(prisma, {
        organizationId: args.organizationId,
        contractorId: args.contractorId,
        contractId: args.contractId,
        timesheetId: args.timesheetId,
        issue,
        worklog,
      });
      if (result === 'imported') imported++;
      else skipped++;
    }
  }

  return { imported, skipped };
}

/** Marks the sync log + connection as failed. Does not re-throw. */
async function recordSyncFailure(
  prisma: PrismaClient,
  syncLogId: string,
  connectionId: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unknown error';
  await prisma.integrationSyncLog.update({
    where: { id: syncLogId },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      errorMessage: message,
    },
  });

  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      lastErrorAt: new Date(),
      lastErrorMessage: message,
    },
  });
}

/**
 * JQL-paginates all issues with the author's worklogs in the date range.
 * Throws a {@link TRPCError} on 401 (invalid token) / 429 (rate limit) and a
 * plain Error on any other non-OK status.
 */
async function searchJiraIssues(
  baseUrl: string,
  authHeaders: Record<string, string>,
  accountId: string,
  startDate: string,
  endDate: string,
): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let startAt = 0;
  const maxResults = 100;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const jql = `worklogDate>="${startDate}" AND worklogDate<="${endDate}" AND worklogAuthor="${accountId}"`;
    const searchUrl = new URL(`${baseUrl}/search`);
    searchUrl.searchParams.set('jql', jql);
    searchUrl.searchParams.set('fields', 'key,summary');
    searchUrl.searchParams.set('maxResults', String(maxResults));
    searchUrl.searchParams.set('startAt', String(startAt));

    const searchResponse = await fetchWithTimeout(searchUrl.toString(), {
      headers: authHeaders,
    });

    if (searchResponse.status === 401) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: E.JIRA_TOKEN_INVALID,
      });
    }

    if (searchResponse.status === 429) {
      const retryAfter = searchResponse.headers.get('Retry-After');
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Jira API rate limit exceeded. Retry after ${retryAfter ?? '60'} seconds.`,
      });
    }

    if (!searchResponse.ok) {
      const text = await searchResponse.text();
      throw new Error(`Jira search API error (${searchResponse.status}): ${text}`);
    }

    const searchData = (await searchResponse.json()) as JiraSearchResponse;
    allIssues.push(...searchData.issues);

    // Check if there are more pages
    if (startAt + searchData.issues.length >= searchData.total) break;
    startAt += maxResults;
  }

  return allIssues;
}

export async function syncJiraWorklogs(
  prisma: PrismaClient,
  organizationId: string,
  contractorId: string,
  contractId: string,
  timesheetId: string,
  connectionId: string,
  startDate: string,
  endDate: string,
): Promise<{ imported: number; skipped: number }> {
  // 1. Get connection + decrypt credentials (OAuth access token)
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: E.JIRA_CONNECTION_NOT_FOUND,
    });
  }

  if (connection.status !== 'CONNECTED') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Jira connection is not active (status: ${connection.status})`,
    });
  }

  const credentials = decryptCredentials(connection.credentialsRef, 'jira');
  const config = connection.configJson as unknown as JiraConnectionConfig;

  if (!config?.cloudId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.JIRA_MISSING_CLOUD_ID,
    });
  }

  // 2. Resolve accountId from ExternalLink or config
  let accountId = config.accountId;

  if (!accountId) {
    // Look up from ExternalLink (entityType=CONTRACTOR, externalType=JIRA_USER)
    const externalLink = await prisma.externalLink.findFirst({
      where: {
        organizationId,
        integrationConnectionId: connectionId,
        entityType: 'CONTRACTOR',
        entityId: contractorId,
        externalType: 'JIRA_USER',
      },
    });

    if (!externalLink) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: E.JIRA_ACCOUNT_NOT_MAPPED,
      });
    }

    accountId = externalLink.externalId;
  }

  // 3. Build base URL
  const baseUrl = `https://api.atlassian.com/ex/jira/${config.cloudId}/rest/api/3`;
  const authHeaders = {
    Authorization: `Bearer ${credentials.accessToken}`,
    Accept: 'application/json',
  };

  // 4. Create sync log
  const syncLog = await prisma.integrationSyncLog.create({
    data: {
      organizationId,
      integrationConnectionId: connectionId,
      direction: 'INBOUND',
      syncType: 'worklogs',
      status: 'STARTED',
    },
  });

  let imported = 0;
  let skipped = 0;

  try {
    // Step A: JQL search for issues with user's worklogs in date range
    const allIssues = await searchJiraIssues(baseUrl, authHeaders, accountId, startDate, endDate);

    // Step B: For each issue, fetch worklogs and filter by author
    ({ imported, skipped } = await importWorklogEntries(prisma, {
      baseUrl,
      authHeaders,
      accountId,
      issues: allIssues,
      startDate,
      endDate,
      organizationId,
      contractorId,
      contractId,
      timesheetId,
    }));

    // 5. Recalculate timesheet totalMinutes
    const totalResult = await prisma.timeEntry.aggregate({
      where: { timesheetId },
      _sum: { minutes: true },
    });

    await prisma.timesheet.update({
      where: { id: timesheetId },
      data: { totalMinutes: totalResult._sum.minutes ?? 0 },
    });

    // 6. Update connection and sync log
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
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: {
          issuesScanned: allIssues.length,
          imported,
          skipped,
        },
      },
    });
  } catch (error) {
    await recordSyncFailure(prisma, syncLog.id, connectionId, error);

    // Re-throw TRPCErrors as-is, wrap others
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: E.JIRA_WORKLOG_SYNC_FAILED,
      cause: error,
    });
  }

  return { imported, skipped };
}
