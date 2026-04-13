import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import { TRPCError } from '@trpc/server';
import type { DbClient } from './types.js';

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
// Jira Worklog Sync Service
// ---------------------------------------------------------------------------

/**
 * Fetches worklogs from Jira Cloud for a given connection and date range,
 * then upserts them as TimeEntry records with source=JIRA.
 *
 * Two-step fetch per D-10 and Pitfall 4:
 * 1. JQL search for issues with user's worklogs in the date range
 * 2. Per-issue worklog fetch, filtered by author accountId
 *
 * Deduplication: Uses @@unique(organizationId, contractorId, source, externalId)
 * with externalId = worklog.id to prevent duplicate imports (Pitfall 5).
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
      message: 'Jira connection not found',
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
      message: 'Jira connection is missing cloudId. Please reconnect your Jira integration.',
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
        message:
          'Jira account ID not found. Please map your Jira user account in integration settings.',
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

      const searchResponse = await fetch(searchUrl.toString(), {
        headers: authHeaders,
      });

      if (searchResponse.status === 401) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message:
            'Jira access token is invalid or expired. Please reconnect your Jira integration.',
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

    // Step B: For each issue, fetch worklogs and filter by author
    const startDateObj = new Date(`${startDate}T00:00:00Z`);
    const endDateObj = new Date(`${endDate}T23:59:59Z`);

    for (const issue of allIssues) {
      let worklogStartAt = 0;
      const worklogMaxResults = 1000;

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const worklogUrl = new URL(`${baseUrl}/issue/${issue.key}/worklog`);
        worklogUrl.searchParams.set('startAt', String(worklogStartAt));
        worklogUrl.searchParams.set('maxResults', String(worklogMaxResults));

        const worklogResponse = await fetch(worklogUrl.toString(), {
          headers: authHeaders,
        });

        if (!worklogResponse.ok) {
          // Log but don't fail the entire sync for one issue
          console.error(
            `Failed to fetch worklogs for issue ${issue.key}: ${worklogResponse.status}`,
          );
          break;
        }

        const worklogData = (await worklogResponse.json()) as JiraWorklogResponse;

        // Filter worklogs by author and date range
        const userWorklogs = worklogData.worklogs.filter(wl => {
          if (wl.author.accountId !== accountId) return false;
          const worklogDate = new Date(wl.started);
          return worklogDate >= startDateObj && worklogDate <= endDateObj;
        });

        // Step C: Map worklogs to TimeEntry
        for (const worklog of userWorklogs) {
          const minutes = Math.round(worklog.timeSpentSeconds / 60);
          const entryDate = worklog.started.split('T')[0] ?? '';

          // Skip zero-duration worklogs
          if (minutes === 0) {
            skipped++;
            continue;
          }

          // Build description from comment or issue key + summary
          const commentText = extractCommentText(worklog.comment);
          const description = commentText ?? `${issue.key}: ${issue.fields.summary}`;

          const existingEntry = await prisma.timeEntry.findFirst({
            where: {
              organizationId,
              contractorId,
              source: 'JIRA',
              externalId: String(worklog.id),
            },
            select: { id: true },
          });

          if (existingEntry) {
            // Update existing entry (duration may have changed in Jira)
            await prisma.timeEntry.update({
              where: { id: existingEntry.id },
              data: {
                minutes,
                description,
                metadataJson: {
                  issueKey: issue.key,
                  issueSummary: issue.fields.summary,
                  worklogId: worklog.id,
                  authorDisplayName: worklog.author.displayName,
                  timeSpentSeconds: worklog.timeSpentSeconds,
                },
              },
            });
            skipped++;
          } else {
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
                metadataJson: {
                  issueKey: issue.key,
                  issueSummary: issue.fields.summary,
                  worklogId: worklog.id,
                  authorDisplayName: worklog.author.displayName,
                  timeSpentSeconds: worklog.timeSpentSeconds,
                },
              },
            });
            imported++;
          }
        }

        // Check if there are more worklog pages
        if (worklogStartAt + worklogData.worklogs.length >= worklogData.total) break;
        worklogStartAt += worklogMaxResults;
      }
    }

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
    // Update sync log with failure
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

    // Re-throw TRPCErrors as-is, wrap others
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to sync Jira worklogs',
      cause: error,
    });
  }

  return { imported, skipped };
}
